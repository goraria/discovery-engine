import { HTTPError } from "nitro/h3";
import type { DocumentInput } from "@/models/search-document";
export interface SyncEventInput {
  id: string;
  resourceType: string;
  resourceId: string;
  revision: number;
  operation: "upsert" | "delete";
  document?: DocumentInput;
}

export function parseSyncEvents(raw: unknown): SyncEventInput[] {
  const invalid = () =>
    new HTTPError({ status: 400, message: "invalid_sync_event" });
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100)
    throw invalid();
  for (const event of raw) {
    if (
      !event ||
      typeof event !== "object" ||
      typeof event.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        event.id,
      ) ||
      typeof event.resourceType !== "string" ||
      !/^[a-z][a-z0-9_-]{0,63}$/.test(event.resourceType) ||
      typeof event.resourceId !== "string" ||
      !event.resourceId ||
      event.resourceId.length > 255 ||
      !Number.isSafeInteger(event.revision) ||
      event.revision < 1 ||
      !["upsert", "delete"].includes(event.operation)
    )
      throw invalid();
    if (event.operation === "delete") continue;
    const document = event.document;
    if (
      !document ||
      typeof document !== "object" ||
      typeof document.title !== "string" ||
      !document.title.trim() ||
      document.title.length > 500 ||
      (document.content != null &&
        (typeof document.content !== "string" ||
          document.content.length > 50_000)) ||
      (document.visibility !== undefined &&
        !["public", "private", "unlisted"].includes(document.visibility)) ||
      (document.keywords !== undefined &&
        (!Array.isArray(document.keywords) ||
          document.keywords.length > 50 ||
          document.keywords.some(
            (v: unknown) => typeof v !== "string" || v.length > 128,
          ))) ||
      (document.rankingWeight !== undefined &&
        (typeof document.rankingWeight !== "number" ||
          !Number.isFinite(document.rankingWeight) ||
          document.rankingWeight < 0 ||
          document.rankingWeight > 1000))
    )
      throw invalid();
    for (const field of ["canonicalUrl", "imageUrl"])
      if (document[field] != null) {
        let url: URL;
        try {
          url = new URL(document[field]);
        } catch {
          throw invalid();
        }
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw invalid();
      }
    if (
      document.facets !== undefined &&
      (!document.facets ||
        typeof document.facets !== "object" ||
        Array.isArray(document.facets) ||
        Object.entries(document.facets).length > 30 ||
        Object.entries(document.facets).some(
          ([key, values]) =>
            key.length > 64 ||
            !Array.isArray(values) ||
            values.length > 30 ||
            values.some(
              (value) => typeof value !== "string" || value.length > 255,
            ),
        ))
    )
      throw invalid();
    for (const field of ["sourceCreatedAt", "sourceUpdatedAt"])
      if (
        document[field] != null &&
        (typeof document[field] !== "string" ||
          !Number.isFinite(Date.parse(document[field])))
      )
        throw invalid();
    if (
      document.metadata !== undefined &&
      (!document.metadata ||
        typeof document.metadata !== "object" ||
        Array.isArray(document.metadata))
    )
      throw invalid();
  }
  return raw.map((event) => ({
    id: event.id,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    revision: event.revision,
    operation: event.operation,
    document:
      event.operation === "delete"
        ? undefined
        : {
            title: event.document.title.trim(),
            content: event.document.content,
            keywords: event.document.keywords,
            canonicalUrl: event.document.canonicalUrl,
            imageUrl: event.document.imageUrl,
            // New ingestion is private unless the trusted owner explicitly publishes it.
            visibility: event.document.visibility ?? "private",
            rankingWeight: event.document.rankingWeight,
            metadata: event.document.metadata,
            facets: event.document.facets,
            sourceCreatedAt: event.document.sourceCreatedAt,
            sourceUpdatedAt: event.document.sourceUpdatedAt,
          },
  })) as SyncEventInput[];
}
