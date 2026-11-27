import { Context } from "hono"
import type { Binding, Session } from "@/utils/interface"
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/database", () => ({ pool: { query: state.query } }));
import { parseChatSearch } from "@/schemas/chat";
import { rawSearchChatMessages } from "@/services/chat";
import { actSearchChatMessages as controller } from "@/controllers/chat";
const input = {
  conversationId: "d2096c8e-830d-4e10-91ae-29b5a1c86e71",
  query: "hello",
  joinedAfter: "2026-10-28T00:00:00Z",
  limit: 50,
};
beforeEach(() =>
  state.query
    .mockReset()
    .mockResolvedValue({ rows: [{ resourceId: "result" }] }),
);
it("confines private search to Chat, the conversation facet and membership start", async () => {
  expect(await rawSearchChatMessages(input)).toEqual({
    data: [{ resourceId: "result" }],
  });
  const [query, values] = state.query.mock.calls[0]!;
  expect(query).toContain("i.application='chat'");
  expect(query).toContain("d.visibility='private'");
  expect(query).toContain("f.name='conversationId'");
  expect(values).toEqual([
    input.conversationId,
    input.joinedAfter,
    input.query,
    50,
  ]);
});
it("rejects another app even if its generic indexer machine grant is valid", async () => {
  await expect(
    controller(searchContext("task", new Request("https://discovery.test", {
        method: "POST",
        body: JSON.stringify(input),
      }))),
  ).rejects.toMatchObject({ status: 403 });
  expect(state.query).not.toHaveBeenCalled();
});
it("validates membership cutoff, query and result bounds", () => {
  expect(parseChatSearch(input)).toEqual(input);
  for (const patch of [
    { limit: 101 },
    { query: "" },
    { joinedAfter: "bad" },
    { conversationId: "wrong" },
  ])
    expect(() => parseChatSearch({ ...input, ...patch })).toThrow();
});

function searchContext(application: Session["app"], request: Request) {
  const context = new Context<Binding>(request)
  context.set("app", application)
  return context
}
