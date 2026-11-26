import { readRequestBody } from "@/utils/request";
import type { ApiContext } from "@/types/auth";
import { parseSyncEvents } from "@/schemas/sync";
import { rawIngestDocuments as ingestDocumentsServices } from "@/models/discovery-sync-event";
import { rawPersonalizedRecommendations as personalizedRecommendationsServices } from "@/services/personalization";

export async function actIngestDocuments(context: ApiContext) {
  return context.json(
    await ingestDocumentsServices(
      parseSyncEvents(await readRequestBody(context.req)),
      context.get("application")!,
    ),
    {
      status: 202,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actPersonalizedRecommendations(context: ApiContext) {
  return context.json(
    await personalizedRecommendationsServices(
      context.get("application")!,
      context.get("subject")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
