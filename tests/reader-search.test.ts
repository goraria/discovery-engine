import { Context } from "hono"
import type { ApiEnv, AppContext } from "@/types/auth"
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/database", () => ({ pool: { query: f.query } }));
import { actSearchReaderContent } from "@/controllers/reader";
import { parseReaderSearch } from "@/schemas/reader";
beforeEach(() => {
  vi.clearAllMocks();
  f.query.mockResolvedValue({ rows: [{ resourceId: "post" }] });
});
it("rejects another application backend before querying the private index", async () => {
  await expect(
    actSearchReaderContent(searchContext("task", new Request("https://discovery.test", {
        method: "POST",
        body: JSON.stringify({ query: "hello" }),
      }))),
  ).rejects.toMatchObject({ status: 403 });
  expect(f.query).not.toHaveBeenCalled();
});
it("returns only IDs from a Reader private index with bounded input", async () => {
  const result = await actSearchReaderContent(searchContext("reader", new Request("https://discovery.test", {
      method: "POST",
      body: JSON.stringify({ query: "hello", limit: 10 }),
    })));
  expect(await result.json()).toEqual({ data: [{ resourceId: "post" }] });
  expect(f.query.mock.calls[0]![0]).toContain("i.application='reader'");
  expect(f.query.mock.calls[0]![0]).toContain("d.visibility='private'");
  expect(f.query.mock.calls[0]![1]).toEqual(["hello", 10]);
  expect(() => parseReaderSearch({ query: "x".repeat(201) })).toThrow();
});

function searchContext(application: AppContext["application"], request: Request) {
  const context = new Context<ApiEnv>(request)
  context.set("application", application)
  return context
}
