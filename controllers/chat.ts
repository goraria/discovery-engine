import { readRequestBody } from "@/utils/request";
import { HTTPError } from "nitro/h3";
import type { Event } from "@/utils/interface";
import { parseChatSearch } from "@/schemas/chat";
import { rawSearchChatMessages as searchChatMessagesServices } from "@/services/chat";
export async function actSearchChatMessages(event: Event) {
  if (event.get("app") !== "chat")
    throw new HTTPError({ status: 403, message: "chat_backend_required" });
  return event.json(
    await searchChatMessagesServices(parseChatSearch(await readRequestBody(event.req))),
  );
}
