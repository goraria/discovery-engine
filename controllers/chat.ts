import { readRequestBody } from "@/utils/request";
import { HTTPError } from "nitro/h3";
import type { ApiContext } from "@/types/auth";
import { parseChatSearch } from "@/schemas/chat";
import { rawSearchChatMessages as searchChatMessagesServices } from "@/services/chat";
export async function actSearchChatMessages(event: ApiContext) {
  if (event.get("application") !== "chat")
    throw new HTTPError({ status: 403, message: "chat_backend_required" });
  return event.json(
    await searchChatMessagesServices(parseChatSearch(await readRequestBody(event.req))),
  );
}
