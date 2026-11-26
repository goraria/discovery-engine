import { HTTPError } from "nitro/h3";
export interface ChatSearchInput {
  conversationId: string;
  query: string;
  joinedAfter: string;
  limit: number;
}
export function parseChatSearch(raw: unknown): ChatSearchInput {
  const input = raw as Partial<ChatSearchInput> | null;
  if (
    !input ||
    typeof input.conversationId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(input.conversationId) ||
    typeof input.query !== "string" ||
    !input.query.trim() ||
    input.query.length > 200 ||
    typeof input.joinedAfter !== "string" ||
    !Number.isFinite(Date.parse(input.joinedAfter)) ||
    !Number.isInteger(input.limit) ||
    input.limit! < 1 ||
    input.limit! > 100
  )
    throw new HTTPError({ status: 400, message: "invalid_chat_search" });
  return input as ChatSearchInput;
}
