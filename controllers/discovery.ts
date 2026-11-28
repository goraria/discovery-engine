import type { Event } from "@/utils/interface";
import { getQueryValues, readRequestBody } from "@/modules/principle/request";
import {
  rawRecommend,
  rawRecordEvent,
  rawSearch,
  rawSuggestions,
  rawTrending,
  rawUpsertSuggestion,
  type DocumentInput,
} from "@/models/search-document";
import { applicationNamespaces, type Application } from "@/utils/constant";
import { parseSyncEvents } from "@/schemas/sync";
import { rawIngestDocuments as ingestDocumentsServices } from "@/models/discovery-sync-event";
type DiscoveryContext = Event;
function error(context: DiscoveryContext, message: string) {
  return context.json(
    { error: message },
    {
      status: 400,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
function readPage(context: DiscoveryContext) {
  const application = getQueryValues(context.req.raw)["application"];
  if (!applicationNamespaces.includes(application as Application)) return null;
  const requestedLimit = Number(getQueryValues(context.req.raw)["limit"] ?? 20);
  const requestedOffset = Number(getQueryValues(context.req.raw)["offset"] ?? 0);
  if (
    !Number.isInteger(requestedLimit) ||
    !Number.isInteger(requestedOffset) ||
    requestedLimit < 1 ||
    requestedOffset < 0
  )
    return null;
  const type = getQueryValues(context.req.raw)["type"]?.trim();
  if (type && !/^[a-z][a-z0-9_-]{0,63}$/.test(type)) return null;
  return {
    application: application as Application,
    type: type || undefined,
    limit: Math.min(requestedLimit, 50),
    offset: requestedOffset,
  };
}
function validType(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function actSearchController(context: DiscoveryContext) {
  const page = readPage(context);
  if (!page) return error(context, "invalid_pagination_or_application");
  const query = getQueryValues(context.req.raw)["query"] ?? "";
  if (query.length > 120) return error(context, "query_too_long");
  const facet = getQueryValues(context.req.raw)["facet"];
  const value = getQueryValues(context.req.raw)["value"];
  if (
    (facet && !value) ||
    (value && !facet) ||
    (facet && facet.length > 64) ||
    (value && value.length > 255)
  )
    return error(context, "invalid_facet");
  return context.json(await rawSearch({ ...page, query, facet, value }), {
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actSuggestionController(context: DiscoveryContext) {
  const page = readPage(context);
  if (!page) return error(context, "invalid_pagination_or_application");
  const query = getQueryValues(context.req.raw)["query"] ?? "";
  if (query.length > 120) return error(context, "query_too_long");
  return context.json(await rawSuggestions({ ...page, query }), {
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actTrendingController(context: DiscoveryContext) {
  const page = readPage(context);
  if (!page) return error(context, "invalid_pagination_or_application");
  return context.json(await rawTrending(page), {
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actRecommendationController(context: DiscoveryContext) {
  const page = readPage(context);
  if (!page) return error(context, "invalid_pagination_or_application");
  const sourceId = getQueryValues(context.req.raw)["id"]?.trim();
  if (sourceId && sourceId.length > 255)
    return error(context, "invalid_resource_id");
  return context.json(await rawRecommend({ ...page, sourceId }), {
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actPutDocumentController(context: DiscoveryContext) {
  const type = context.req.param("type")!;
  const id = context.req.param("id")!;
  if (!validType(type) || !id || id.length > 255)
    return error(context, "invalid_resource");
  const body: unknown = await readRequestBody(context.req).catch(() => null);
  if (
    !isObject(body) ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 500
  )
    return error(context, "invalid_document");
  if (
    body.content !== undefined &&
    body.content !== null &&
    (typeof body.content !== "string" || body.content.length > 50000)
  ) {
    return error(context, "invalid_content");
  }
  if (
    body.keywords !== undefined &&
    (!Array.isArray(body.keywords) ||
      body.keywords.length > 50 ||
      body.keywords.some(
        (item) => typeof item !== "string" || item.length > 128,
      ))
  ) {
    return error(context, "invalid_keywords");
  }
  if (
    body.visibility !== undefined &&
    !["public", "private", "unlisted"].includes(String(body.visibility))
  ) {
    return error(context, "invalid_visibility");
  }
  if (
    body.facets !== undefined &&
    (!isObject(body.facets) ||
      Object.entries(body.facets).length > 30 ||
      Object.entries(body.facets).some(
        ([name, values]) =>
          name.length > 64 ||
          !Array.isArray(values) ||
          values.length > 30 ||
          values.some(
            (value) => typeof value !== "string" || value.length > 255,
          ),
      ))
  ) {
    return error(context, "invalid_facets");
  }
  if (body.metadata !== undefined && !isObject(body.metadata))
    return error(context, "invalid_metadata");
  if (
    body.rankingWeight !== undefined &&
    (typeof body.rankingWeight !== "number" ||
      !Number.isFinite(body.rankingWeight) ||
      body.rankingWeight < 0 ||
      body.rankingWeight > 1000)
  ) {
    return error(context, "invalid_ranking_weight");
  }
  const input = body as unknown as DocumentInput;
  const events = parseSyncEvents([
    {
      id: context.req.header("idempotency-key") ?? crypto.randomUUID(),
      resourceType: type,
      resourceId: id,
      revision: body.revision,
      operation: "upsert",
      document: { ...input, title: input.title.trim() },
    },
  ]);
  return context.json(
    await ingestDocumentsServices(events, context.get("app")!),
    {
      status: 202,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actDeleteDocumentController(context: DiscoveryContext) {
  const type = context.req.param("type")!;
  const id = context.req.param("id")!;
  if (!validType(type) || !id || id.length > 255)
    return error(context, "invalid_resource");
  const events = parseSyncEvents([
    {
      id: context.req.header("idempotency-key") ?? crypto.randomUUID(),
      resourceType: type,
      resourceId: id,
      revision: Number(context.req.header("x-resource-revision")),
      operation: "delete",
    },
  ]);
  return context.json(
    await ingestDocumentsServices(events, context.get("app")!),
    {
      status: 202,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actPutSuggestionController(context: DiscoveryContext) {
  const type = context.req.param("type")!;
  if (!validType(type)) return error(context, "invalid_resource_type");
  const body: unknown = await readRequestBody(context.req).catch(() => null);
  if (
    !isObject(body) ||
    typeof body.phrase !== "string" ||
    !body.phrase.trim() ||
    body.phrase.length > 120 ||
    typeof body.weight !== "number" ||
    !Number.isInteger(body.weight) ||
    body.weight < 0 ||
    body.weight > 1000000
  ) {
    return error(context, "invalid_suggestion");
  }
  const result = await rawUpsertSuggestion(
    context.get("app")!,
    type,
    body.phrase.trim(),
    body.weight,
  );
  return result
    ? context.json(result, {
        headers: { "content-type": "application/json; charset=UTF-8" },
      })
    : context.json(
        { error: "index_not_found" },
        {
          status: 404,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
}
export async function actPostEventController(context: DiscoveryContext) {
  const body: unknown = await readRequestBody(context.req).catch(() => null);
  const allowed = [
    "impression",
    "click",
    "search",
    "view",
    "conversion",
    "feedback",
  ];
  if (!isObject(body) || !allowed.includes(String(body.type)))
    return error(context, "invalid_event");
  if (
    body.query !== undefined &&
    (typeof body.query !== "string" || body.query.length > 120)
  )
    return error(context, "invalid_query");
  if (
    body.resourceType !== undefined &&
    (typeof body.resourceType !== "string" || !validType(body.resourceType))
  )
    return error(context, "invalid_resource_type");
  if (
    body.resourceId !== undefined &&
    (typeof body.resourceId !== "string" || body.resourceId.length > 255)
  )
    return error(context, "invalid_resource_id");
  if (
    body.value !== undefined &&
    (typeof body.value !== "number" || !Number.isFinite(body.value))
  )
    return error(context, "invalid_value");
  const result = await rawRecordEvent(
    context.get("app")!,
    context.get("sub")!,
    body as Parameters<typeof rawRecordEvent>[2],
  );
  return context.json(result, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
