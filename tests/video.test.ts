import { expect, it, vi } from "vitest";
const query = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]) => ({ rows: [{ resourceId: "video" }] })),
);
vi.mock("@/database", () => ({ pool: { query } }));
import { rawSearchVideoContent } from "@/services/video";
import { parseVideoSearch } from "@/schemas/video";
it("returns only scoped candidate IDs for Video to recheck, never public/private document payloads", async () => {
  expect(await rawSearchVideoContent({ query: "original", limit: 20 })).toEqual({
    data: [{ resourceId: "video" }],
  });
  const sql = query.mock.calls[0]![0];
  expect(sql).toContain("i.application='video'");
  expect(sql).toContain("d.visibility='private'");
});
it("bounds keyword and batch size", () => {
  expect(() => parseVideoSearch({ query: "", limit: 20 })).toThrow();
  expect(() => parseVideoSearch({ query: "title", limit: 1000 })).toThrow();
});
