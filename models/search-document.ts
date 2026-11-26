import { pool } from "@/database"
import type { Application } from "@/types/auth"
import type { PoolClient } from "pg"

export interface DocumentInput {
  title: string
  content?: string | null
  keywords?: string[]
  canonicalUrl?: string | null
  imageUrl?: string | null
  visibility?: "public" | "private" | "unlisted"
  rankingWeight?: number
  metadata?: Record<string, unknown>
  facets?: Record<string, string[]>
  sourceCreatedAt?: string | null
  sourceUpdatedAt?: string | null
}

export interface PageInput {
  application: Application
  type?: string
  limit: number
  offset: number
}

export interface SearchInput extends PageInput {
  query: string
  facet?: string
  value?: string
}

function page<T>(data: T[], total: number, limit: number, offset: number) {
  return {
    data,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + data.length < total,
      nextOffset: offset + data.length < total ? offset + data.length : null,
    },
  }
}

export async function rawUpsertDocument(
  application: Application,
  type: string,
  id: string,
  input: DocumentInput,
  connection?: PoolClient,
) {
  const client = connection ?? await pool.connect()
  try {
    if (!connection) await client.query("BEGIN")
    const indexResult = await client.query<{ id: string }>(
      `INSERT INTO search_index (application, resource_type, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (application, resource_type)
       DO UPDATE SET updated_at = now()
       RETURNING id`,
      [application, type, `${application}:${type}`],
    )
    const indexId = indexResult.rows[0]!.id
    const documentResult = await client.query<{ id: string }>(
      `INSERT INTO search_document
       (index_id, resource_id, title, content, keywords, canonical_url, image_url,
        visibility, ranking_weight, metadata, source_created_at, source_updated_at, search_vector)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12,
         setweight(to_tsvector('simple', $3), 'A') ||
         setweight(to_tsvector('simple', COALESCE($4, '')), 'B') ||
         setweight(to_tsvector('simple', array_to_string($5::text[], ' ')), 'A'))
       ON CONFLICT (index_id, resource_id)
       DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content,
         keywords=EXCLUDED.keywords, canonical_url=EXCLUDED.canonical_url,
         image_url=EXCLUDED.image_url, visibility=EXCLUDED.visibility,
         ranking_weight=EXCLUDED.ranking_weight, metadata=EXCLUDED.metadata,
         source_created_at=EXCLUDED.source_created_at,
         source_updated_at=EXCLUDED.source_updated_at,
         search_vector=EXCLUDED.search_vector, deleted_at=NULL,
         indexed_at=now(), updated_at=now()
       RETURNING id`,
      [
        indexId, id, input.title, input.content ?? null, input.keywords ?? [],
        input.canonicalUrl ?? null, input.imageUrl ?? null,
        input.visibility ?? "public", input.rankingWeight ?? 1,
        JSON.stringify(input.metadata ?? {}), input.sourceCreatedAt ?? null,
        input.sourceUpdatedAt ?? null,
      ],
    )
    const documentId = documentResult.rows[0]!.id
    await client.query("DELETE FROM search_document_facet WHERE document_id=$1", [documentId])
    for (const [name, values] of Object.entries(input.facets ?? {})) {
      for (const value of values) {
        await client.query(
          `INSERT INTO search_document_facet (document_id, name, value)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [documentId, name, value],
        )
      }
    }
    if (!connection) await client.query("COMMIT")
    return { id: documentId, application, type, resourceId: id }
  } catch (error) {
    if (!connection) await client.query("ROLLBACK")
    throw error
  } finally {
    if (!connection) client.release()
  }
}

export async function rawDeleteDocument(application: Application, type: string, id: string) {
  const result = await pool.query(
    `UPDATE search_document AS d SET deleted_at=now(), updated_at=now()
     FROM search_index AS i WHERE d.index_id=i.id AND i.application=$1
     AND i.resource_type=$2 AND d.resource_id=$3 AND d.deleted_at IS NULL`,
    [application, type, id],
  )
  return result.rowCount !== 0
}

export async function rawSearch(input: SearchInput) {
  const query = input.query.trim().slice(0, 120)
  if (!query) return page([], 0, input.limit, input.offset)
  const result = await pool.query(
    `SELECT d.resource_id AS "resourceId", i.application, i.resource_type AS type,
       d.title, d.content, d.canonical_url AS "canonicalUrl",
       d.image_url AS "imageUrl", d.metadata, d.keywords,
       d.source_created_at AS "sourceCreatedAt", d.source_updated_at AS "sourceUpdatedAt",
       COUNT(*) OVER()::int AS total
     FROM search_document AS d JOIN search_index AS i ON i.id=d.index_id
     WHERE i.application=$1 AND i.is_enabled=true AND ($2::text IS NULL OR i.resource_type=$2)
       AND d.visibility='public' AND d.deleted_at IS NULL
       AND (d.search_vector @@ websearch_to_tsquery('simple', $3)
         OR position(lower($3) in lower(d.title)) > 0)
       AND ($4::text IS NULL OR EXISTS (
         SELECT 1 FROM search_document_facet AS f
         WHERE f.document_id=d.id AND f.name=$4 AND f.value=$5))
     ORDER BY (ts_rank_cd(d.search_vector, websearch_to_tsquery('simple', $3))
       * d.ranking_weight::float) DESC, d.source_updated_at DESC NULLS LAST, d.id
     LIMIT $6 OFFSET $7`,
    [input.application, input.type ?? null, query, input.facet ?? null,
      input.value ?? null, input.limit, input.offset],
  )
  const total = result.rows[0]?.total ?? 0
  return page(result.rows.map(({ total: _total, ...row }) => row), total, input.limit, input.offset)
}

export async function rawSuggestions(input: PageInput & { query: string }) {
  const query = input.query.trim().slice(0, 120)
  if (!query) return page([], 0, input.limit, input.offset)
  const result = await pool.query(
    `WITH candidate AS (
       SELECT s.phrase, s.weight, i.resource_type AS type
       FROM search_suggestion AS s JOIN search_index AS i ON i.id=s.index_id
       WHERE i.application=$1 AND i.is_enabled=true
         AND ($2::text IS NULL OR i.resource_type=$2)
       UNION ALL
       SELECT d.title AS phrase, LEAST(1000000, (d.ranking_weight * 10)::int) AS weight,
         i.resource_type AS type
       FROM search_document AS d JOIN search_index AS i ON i.id=d.index_id
       WHERE i.application=$1 AND i.is_enabled=true
         AND ($2::text IS NULL OR i.resource_type=$2)
         AND d.visibility='public' AND d.deleted_at IS NULL
     )
     SELECT phrase, MAX(weight) AS weight, type, COUNT(*) OVER()::int AS total
     FROM candidate WHERE position(lower($3) in lower(phrase))=1
     GROUP BY phrase, type
     ORDER BY weight DESC, phrase ASC LIMIT $4 OFFSET $5`,
    [input.application, input.type ?? null, query, input.limit, input.offset],
  )
  return page(result.rows.map(({ total: _total, ...row }) => row), result.rows[0]?.total ?? 0, input.limit, input.offset)
}

export async function rawTrending(input: PageInput) {
  const result = await pool.query(
    `SELECT t.normalized_query AS query, t.query_count AS "queryCount", t.score,
       i.resource_type AS type, COUNT(*) OVER()::int AS total
     FROM trending_query AS t JOIN search_index AS i ON i.id=t.index_id
     WHERE i.application=$1 AND i.is_enabled=true AND ($2::text IS NULL OR i.resource_type=$2)
       AND t.window_ended_at > now()
     ORDER BY t.score DESC, t.query_count DESC LIMIT $3 OFFSET $4`,
    [input.application, input.type ?? null, input.limit, input.offset],
  )
  return page(result.rows.map(({ total: _total, ...row }) => row), result.rows[0]?.total ?? 0, input.limit, input.offset)
}

export async function rawRecommend(input: PageInput & { sourceId?: string }) {
  const result = await pool.query(
    `WITH source AS (
       SELECT d.keywords FROM search_document AS d
       JOIN search_index AS i ON i.id=d.index_id
       WHERE i.application=$1 AND i.resource_type=$2 AND d.resource_id=$3
         AND d.visibility='public' AND d.deleted_at IS NULL LIMIT 1
     )
     SELECT d.resource_id AS "resourceId", i.application, i.resource_type AS type,
       d.title, d.content, d.canonical_url AS "canonicalUrl",
       d.image_url AS "imageUrl", d.metadata, d.keywords,
       COUNT(*) OVER()::int AS total
     FROM search_document AS d JOIN search_index AS i ON i.id=d.index_id
     WHERE i.application=$1 AND i.is_enabled=true AND ($2::text IS NULL OR i.resource_type=$2)
       AND d.visibility='public' AND d.deleted_at IS NULL
       AND ($3::text IS NULL OR d.resource_id<>$3)
     ORDER BY CASE WHEN $3::text IS NULL THEN 0
       ELSE (SELECT COUNT(*) FROM unnest(d.keywords) AS candidate(keyword)
         WHERE candidate.keyword=ANY(COALESCE((SELECT source.keywords FROM source), ARRAY[]::text[]))) END DESC,
       d.ranking_weight DESC, d.source_updated_at DESC NULLS LAST, d.id
     LIMIT $4 OFFSET $5`,
    [input.application, input.type ?? null, input.sourceId ?? null, input.limit, input.offset],
  )
  return page(result.rows.map(({ total: _total, ...row }) => row), result.rows[0]?.total ?? 0, input.limit, input.offset)
}

export async function rawUpsertSuggestion(application: Application, type: string, phrase: string, weight: number) {
  const result = await pool.query(
    `INSERT INTO search_suggestion (index_id, phrase, weight)
     SELECT id, $3, $4 FROM search_index WHERE application=$1 AND resource_type=$2
     ON CONFLICT (index_id, phrase) DO UPDATE SET weight=EXCLUDED.weight, updated_at=now()
     RETURNING id`,
    [application, type, phrase, weight],
  )
  return result.rows[0] ?? null
}

export async function rawRecordEvent(application: Application, subject: string, input: {
  type: "impression" | "click" | "search" | "view" | "conversion" | "feedback"
  resourceType?: string
  resourceId?: string
  value?: number
  query?: string
}) {
  const result = await pool.query(
    `INSERT INTO discovery_event (application, session_id, type, resource_type, resource_id, value, context)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [application, subject, input.type, input.resourceType ?? null,
      input.resourceId ?? null, input.value ?? null, JSON.stringify({ query: input.type === "search" ? input.query?.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ") : undefined })],
  )
  return result.rows[0]
}
