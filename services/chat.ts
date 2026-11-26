import { pool } from "@/database";
import type { ChatSearchInput } from "@/schemas/chat";
export async function rawSearchChatMessages(input: ChatSearchInput) {
  const result = await pool.query(
    `SELECT d.resource_id AS "resourceId" FROM search_document d JOIN search_index i ON i.id=d.index_id
    WHERE i.application='chat' AND i.resource_type='message' AND i.is_enabled=true AND d.visibility='private' AND d.deleted_at IS NULL
    AND d.source_created_at >= $2::timestamptz AND EXISTS(SELECT 1 FROM search_document_facet f WHERE f.document_id=d.id AND f.name='conversationId' AND f.value=$1)
    AND (d.search_vector @@ websearch_to_tsquery('simple',$3) OR position(lower($3) in lower(coalesce(d.content,'')))>0)
    ORDER BY d.source_created_at DESC,d.resource_id DESC LIMIT $4`,
    [input.conversationId, input.joinedAfter, input.query, input.limit],
  );
  return { data: result.rows };
}
