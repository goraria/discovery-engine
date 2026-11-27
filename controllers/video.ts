import { readRequestBody } from "@/utils/request";
import { HTTPError } from "nitro/h3";
import type { Event } from "@/utils/interface";
import { parseVideoSearch } from "@/schemas/video";
import { rawSearchVideoContent as searchVideoContentServices } from "@/services/video";
export async function actSearchVideoContent(e: Event) {
  if (e.get("app") !== "video")
    throw new HTTPError({ status: 403, message: "video_backend_required" });
  return e.json(
    await searchVideoContentServices(parseVideoSearch(await readRequestBody(e.req))),
  );
}
