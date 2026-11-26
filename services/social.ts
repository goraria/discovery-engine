import { pool } from "@/database";
import type { SocialSearchInput } from "@/schemas/social";
export async function rawSearchSocialPosts(input: SocialSearchInput) {
  const result = await pool.query(
    `SELECT d.resource_id AS "resourceId" FROM search_document d JOIN search_index i ON i.id=d.index_id WHERE i.application='social' AND i.resource_type='post' AND i.is_enabled=true AND d.visibility='private' AND d.deleted_at IS NULL AND (d.search_vector @@ websearch_to_tsquery('simple',$1) OR position(lower($1) in lower(coalesce(d.content,'')))>0) ORDER BY d.source_created_at DESC,d.resource_id DESC LIMIT $2`,
    [input.query, input.limit],
  );
  return { data: result.rows };
}
