import { readRequestBody } from "@/modules/principle/request";
import { HTTPError } from "nitro/h3";
import type { Event } from "@/utils/interface";
import { parseSocialSearch } from "@/schemas/social";
import { rawSearchSocialPosts as searchSocialPostsServices } from "@/services/social";
export async function actSearchSocialPosts(e: Event) {
  if (e.get("app") !== "social")
    throw new HTTPError({ status: 403, message: "social_backend_required" });
  return e.json(
    await searchSocialPostsServices(parseSocialSearch(await readRequestBody(e.req))),
  );
}
