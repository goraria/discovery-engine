import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/database", () => ({
  pool: {
    query: state.query,
    connect: async () => ({ query: state.query, release: state.release }),
  },
}));
vi.mock("@/models/search-document", () => ({ rawUpsertDocument: state.upsert }));
import { parseSyncEvents } from "@/schemas/sync";
import {
  rawAggregateTrending,
  rawIngestDocuments,
  rawSyncNextDocument,
} from "@/models/discovery-sync-event";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const event = () => ({
  id,
  resourceType: "video",
  resourceId: "v1",
  revision: 1,
  operation: "upsert",
  document: { title: "Title", visibility: "public", keywords: ["gorth"] },
});
beforeEach(() => {
  vi.clearAllMocks();
  state.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
});
it("validates bounded upsert/delete batches", () => {
  expect(parseSyncEvents([event()])).toHaveLength(1);
  expect(
    parseSyncEvents([{ ...event(), operation: "delete", document: undefined }]),
  ).toHaveLength(1);
});
it("defaults a new document to private and does not retain arbitrary top-level fields", () => {
  const result = parseSyncEvents([
    {
      ...event(),
      document: { title: "private", secret: "not-an-index-field" },
    },
  ]);
  expect(result[0]!.document!.visibility).toBe("private");
  expect(result[0]!.document).not.toHaveProperty("secret");
});
it.each([
  [],
  Array(101).fill(event()),
  [{ ...event(), revision: -1 }],
  [{ ...event(), revision: 1.5 }],
  [
    {
      ...event(),
      document: { title: "x", canonicalUrl: "file:///etc/passwd" },
    },
  ],
  [{ ...event(), document: { title: "x", facets: { tag: "wrong" } } }],
])("rejects invalid or unbounded sync input", (raw) => {
  expect(() => parseSyncEvents(raw)).toThrow();
});
it("stores the authenticated application, not a browser-provided application", async () => {
  await rawIngestDocuments(parseSyncEvents([event()]), "video");
  expect(state.query.mock.calls[1]![1][0]).toBe("video");
  expect(state.query.mock.calls[1]![0]).toContain(
    "discovery_sync_event.document=EXCLUDED.document",
  );
  expect(state.query).toHaveBeenLastCalledWith("COMMIT");
});
it("does not resurrect a document when an older upsert follows a newer delete", async () => {
  state.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [
        {
          event_id: id,
          application: "video",
          resource_type: "video",
          resource_id: "v1",
          revision: "4",
          operation: "upsert",
          document: { title: "old" },
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ revision: "5" }] });
  expect(await rawSyncNextDocument()).toEqual({ processed: 1 });
  expect(state.upsert).not.toHaveBeenCalled();
  expect(state.query.mock.calls.at(-2)![0]).toContain("status='completed'");
});
it("publishes trending only after a distinct-subject threshold", async () => {
  await rawAggregateTrending();
  expect(state.query.mock.calls[0]![0]).toContain(
    "HAVING count(DISTINCT e.session_id)>=3",
  );
  expect(state.query.mock.calls[0]![0]).toContain("ON CONFLICT");
});
