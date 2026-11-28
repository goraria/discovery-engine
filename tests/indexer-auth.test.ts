import { Hono } from "hono";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
} from "@gorth-com/principle/cores/jose";
vi.mock("@/modules/structure/sso-directory", () => ({
  requireServiceMachineBinding: async (_service: string, _audience: string, clientId: string) => {
    if (clientId !== "video-index-server") throw new Error("unlinked machine fixture");
  },
  getServiceOrigin: async (key: string) => {
    const origins: Record<string, string> = {
      discovery: "https://index.example",
    };
    if (!origins[key]) throw new Error("Unregistered fixture service");
    return origins[key];
  },
  getApplicationOrigin: async (key: string) => {
    const origins: Record<string, string> = {
      discovery: "https://index.example",
    };
    if (!origins[key]) throw new Error("Unregistered fixture application");
    return origins[key];
  },
}));
vi.mock("@/utils/environment", () => ({
  oauthClientBindings: undefined,
  authUrl: "https://index-sso.example",
  serviceUrl: "https://index.example",
  nodeEnv: "production",
}));
import { requireIndexer } from "@/middlewares/indexer";

let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let key: Awaited<ReturnType<typeof exportJWK>>;
beforeAll(async () => {
  pair = await generateKeyPair("ES256");
  key = { ...(await exportJWK(pair.publicKey)), kid: "worker", alg: "ES256" };
});
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) !== "https://index-sso.example/auth/jwks")
      throw new Error("unexpected auth network request");
    return Response.json({ keys: [key] });
  });
});
async function token(
  claims: Record<string, unknown> = {},
  audience = "https://index.example",
  age = 0,
) {
  const now = Math.floor(Date.now() / 1000) - age;
  return new SignJWT({
    sub: "video-index-server",
    client_id: "video-index-server",
    scope: "video:discovery:write",
    ...claims,
  })
    .setProtectedHeader({ alg: "ES256", kid: "worker", typ: "at+jwt" })
    .setIssuer("https://index-sso.example/auth")
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(typeof claims.exp === "number" ? claims.exp : now + 600)
    .sign(pair.privateKey);
}
async function response(credential?: string) {
  return new Hono()
    .post("/sync", requireIndexer(), (c) =>
      Response.json(
        { application: c.get("app")! },
        { headers: { "content-type": "application/json; charset=UTF-8" } },
      ),
    )
    .request("/sync", {
      method: "POST",
      headers: credential ? { Authorization: `Bearer ${credential}` } : {},
    });
}
it("uses Better Auth signature/audience verification for a bound machine grant", async () => {
  const result = await response(await token());
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ application: "video" });
});
it.each([
  { sub: "user", sid: "session" },
  { client_id: "gorth-video-streaming-platform" },
  { scope: "video:write" },
  { scope: "chat:discovery:write video:discovery:write" },
])("rejects user/public-client/wrong-scope token %o", async (claims) => {
  expect((await response(await token(claims))).status).toBe(403);
});
it("rejects expired, foreign-audience and missing credentials", async () => {
  expect((await response()).status).toBe(401);
  expect(
    (await response(await token({}, "https://foreign.example"))).status,
  ).toBe(401);
  expect(
    (await response(await token({}, "https://index.example", 601))).status,
  ).toBe(401);
});

it("uses the exact SSO-granted application scope with the existing client identity", async () => {
  const result = await response(await token({ scope: "task:discovery:write" }));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ application: "task" });
});
it.each([
  { status: "suspended" },
  { exp: Math.floor(Date.now() / 1000) + 3600 },
  { client_id: "" },
])(
  "rejects inactive, overlong or incomplete machine grants %j",
  async (claims) => {
    expect((await response(await token(claims))).status).toBeGreaterThanOrEqual(
      400,
    );
  },
);
