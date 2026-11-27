import { pool } from "@/database";
import type { Application } from "@/utils/constant";

/** Explainable recency/keyword ranking from this user's verified events, not AI. */
export async function rawPersonalizedRecommendations(
  application: Application,
  subject: string,
) {
  const result = await pool.query(
    `WITH history AS (
    SELECT e.resource_type,e.resource_id,max(e.occurred_at) AS seen_at
    FROM discovery_event e WHERE e.application=$1 AND e.session_id=$2 AND e.type IN ('view','click','conversion')
      AND e.occurred_at>now()-interval '30 days' GROUP BY e.resource_type,e.resource_id ORDER BY seen_at DESC LIMIT 100),
    interests AS (SELECT DISTINCT unnest(d.keywords) AS keyword FROM history h JOIN search_index i ON i.application=$1 AND i.resource_type=h.resource_type
      JOIN search_document d ON d.index_id=i.id AND d.resource_id=h.resource_id WHERE d.visibility='public' AND d.deleted_at IS NULL)
    SELECT d.resource_id AS "resourceId",i.resource_type AS type,d.title,d.canonical_url AS "canonicalUrl",d.image_url AS "imageUrl",
      (SELECT count(*) FROM unnest(d.keywords) k WHERE k=ANY(ARRAY(SELECT keyword FROM interests))) AS affinity
    FROM search_document d JOIN search_index i ON i.id=d.index_id WHERE i.application=$1 AND i.is_enabled
      AND d.visibility='public' AND d.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM history h WHERE h.resource_id=d.resource_id AND h.resource_type=i.resource_type)
    ORDER BY affinity DESC,d.ranking_weight DESC,d.updated_at DESC,d.id LIMIT 20`,
    [application, subject],
  );
  return {
    data: result.rows,
    strategy: "recent_keyword_affinity",
    personalized: result.rows.some((row) => Number(row.affinity) > 0),
  };
}
