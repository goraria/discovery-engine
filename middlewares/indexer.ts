import type { ApiEnv } from "@/types/auth";
import type { MiddlewareHandler } from "hono";
import type { ApiContext } from "@/types/auth";
import { HTTPError } from "nitro/h3";
import { requireServiceMachineBinding } from "@/utils/sso-directory";
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from "better-auth/oauth2";
import {
  serviceAuthFailure,
  serviceTokenConfiguration,
} from "@/lib/auth/verification";
import { applications } from "@/types/auth";

/** SSO's administrative machine-scope ceiling authorizes publishers. */
export function requireIndexer(): MiddlewareHandler<ApiEnv> {
  return async (context: ApiContext, next) => {
    try {
      const config = await serviceTokenConfiguration();
      if (
        ["cookie", "origin", "sec-fetch-site"].some((header) =>
          context.req.raw.headers.has(header),
        )
      )
        throw new HTTPError({ status: 403 });
      const input = requestToResourceInput(context.req.raw);
      if (
        !input.authorizationHeader ||
        !/^Bearer [^\s]+$/i.test(input.authorizationHeader)
      )
        throw new HTTPError({ status: 401 });
      input.authorizationHeader =
        "Bearer " + input.authorizationHeader.slice(7);
      const scopes = applications.map(
        (application) => `${application}:discovery:write`,
      );
      const claims = await verifyAccessTokenRequest(input, {
        jwksUrl: config.jwksUrl,
        requiredScopes: scopes,
        isScopeSatisfied: (_required, granted) =>
          scopes.some((scope) => granted.has(scope)),
        verifyOptions: {
          issuer: config.issuer,
          audience: config.audience,
          typ: "at+jwt",
          algorithms: ["RS256", "ES256", "EdDSA"],
          requiredClaims: ["iss", "aud", "sub", "client_id", "iat", "exp"],
          maxTokenAge: 600,
        },
      });
      const granted =
        typeof claims.scope === "string" ? claims.scope.split(" ") : [];
      const permitted = applications.filter((application) =>
        granted.includes(`${application}:discovery:write`),
      );
      if (
        permitted.length !== 1 ||
        typeof claims.client_id !== "string" ||
        !claims.client_id ||
        claims.sub !== claims.client_id ||
        claims.sid !== undefined ||
        typeof claims.iat !== "number" ||
        typeof claims.exp !== "number" ||
        claims.exp <= claims.iat ||
        claims.exp - claims.iat > 600 ||
        (claims.status !== undefined && claims.status !== "active")
      )
        throw new HTTPError({ status: 403 });
      await requireServiceMachineBinding("discovery", config.audience, claims.client_id);
      context.set("application", permitted[0]);
      context.set("subject", claims.client_id);
    } catch (error) {
      return serviceAuthFailure(error);
    }
    return await next();
  };
}
