import { readRequestBody } from "@/utils/request";
import type { Event } from "@/utils/interface";
import { parseSyncEvents } from "@/schemas/sync";
import { rawIngestDocuments as ingestDocumentsServices } from "@/models/discovery-sync-event";
import { rawPersonalizedRecommendations as personalizedRecommendationsServices } from "@/services/personalization";

export async function actIngestDocuments(context: Event) {
  return context.json(
    await ingestDocumentsServices(
      parseSyncEvents(await readRequestBody(context.req)),
      context.get("app")!,
    ),
    {
      status: 202,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actPersonalizedRecommendations(context: Event) {
  return context.json(
    await personalizedRecommendationsServices(
      context.get("app")!,
      context.get("sub")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
