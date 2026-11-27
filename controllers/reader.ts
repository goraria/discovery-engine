import { readRequestBody } from "@/utils/request";
import { HTTPError } from "nitro/h3";
import type { Event } from "@/utils/interface";
import { parseReaderSearch } from "@/schemas/reader";
import { rawSearchReaderContent as searchReaderContentServices } from "@/services/reader";
export async function actSearchReaderContent(e: Event) {
  if (e.get("app") !== "reader")
    throw new HTTPError({ status: 403, message: "reader_backend_required" });
  return e.json(
    await searchReaderContentServices(parseReaderSearch(await readRequestBody(e.req))),
  );
}
