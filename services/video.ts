import { pool } from "@/database";
import type { VideoSearchInput } from "@/schemas/video";
export async function rawSearchVideoContent(input: VideoSearchInput) {
  const result = await pool.query(
    `SELECT d.resource_id AS "resourceId",i.resource_type AS "resourceType" FROM search_document d JOIN search_index i ON i.id=d.index_id WHERE i.application='video' AND i.resource_type IN ('video') AND i.is_enabled=true AND d.visibility='private' AND d.deleted_at IS NULL AND (d.search_vector @@ websearch_to_tsquery('simple',$1) OR position(lower($1) in lower(coalesce(d.content,'')))>0) ORDER BY d.source_created_at DESC,d.resource_id DESC LIMIT $2`,
    [input.query, input.limit],
  );
  return { data: result.rows };
}
