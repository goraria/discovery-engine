import { readRequestBody } from "@/utils/request";
import { HTTPError } from "nitro/h3";
import type { ApiContext } from "@/types/auth";
import { parseSocialSearch } from "@/schemas/social";
import { rawSearchSocialPosts as searchSocialPostsServices } from "@/services/social";
export async function actSearchSocialPosts(e: ApiContext) {
  if (e.get("application") !== "social")
    throw new HTTPError({ status: 403, message: "social_backend_required" });
  return e.json(
    await searchSocialPostsServices(parseSocialSearch(await readRequestBody(e.req))),
  );
}
