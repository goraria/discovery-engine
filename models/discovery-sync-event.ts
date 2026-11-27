import { pool } from "@/database";
import { rawUpsertDocument } from "@/models/search-document";
import type { SyncEventInput } from "@/schemas/sync";
import type { Application } from "@/utils/constant";

export async function rawIngestDocuments(
  events: SyncEventInput[],
  application: Application,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const event of events) {
      const result = await client.query(
        `INSERT INTO discovery_sync_event (application,event_id,resource_type,resource_id,revision,operation,document)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (application,event_id) DO UPDATE SET event_id=EXCLUDED.event_id
        WHERE discovery_sync_event.resource_type=EXCLUDED.resource_type AND discovery_sync_event.resource_id=EXCLUDED.resource_id
        AND discovery_sync_event.revision=EXCLUDED.revision AND discovery_sync_event.operation=EXCLUDED.operation AND discovery_sync_event.document=EXCLUDED.document RETURNING event_id`,
        [
          application,
          event.id,
          event.resourceType,
          event.resourceId,
          event.revision,
          event.operation,
          JSON.stringify(event.document ?? {}),
        ],
      );
      if (!result.rowCount) throw new Error("sync_idempotency_conflict");
    }
    await client.query("COMMIT");
    return { accepted: events.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rawSyncNextDocument() {
  const client = await pool.connect();
  let eventId: string | undefined;
  let eventApplication: string | undefined;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT * FROM discovery_sync_event WHERE status='pending' AND scheduled_at<=now() ORDER BY scheduled_at,event_id FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    const event = rows[0];
    if (!event) {
      await client.query("COMMIT");
      return { processed: 0 };
    }
    eventId = event.event_id;
    eventApplication = event.application;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      JSON.stringify([
        event.application,
        event.resource_type,
        event.resource_id,
      ]),
    ]);
    const cursor = await client.query(
      "SELECT revision FROM discovery_sync_cursor WHERE application=$1 AND resource_type=$2 AND resource_id=$3",
      [event.application, event.resource_type, event.resource_id],
    );
    if (BigInt(cursor.rows[0]?.revision ?? 0) < BigInt(event.revision)) {
      if (event.operation === "upsert")
        await rawUpsertDocument(
          event.application,
          event.resource_type,
          event.resource_id,
          event.document,
          client,
        );
      else
        await client.query(
          `UPDATE search_document d SET deleted_at=now(),updated_at=now() FROM search_index i
        WHERE i.id=d.index_id AND i.application=$1 AND i.resource_type=$2 AND d.resource_id=$3`,
          [event.application, event.resource_type, event.resource_id],
        );
      await client.query(
        `INSERT INTO discovery_sync_cursor (application,resource_type,resource_id,revision) VALUES ($1,$2,$3,$4)
        ON CONFLICT (application,resource_type,resource_id) DO UPDATE SET revision=EXCLUDED.revision`,
        [
          event.application,
          event.resource_type,
          event.resource_id,
          event.revision,
        ],
      );
    }
    await client.query(
      "UPDATE discovery_sync_event SET status='completed',completed_at=now() WHERE application=$1 AND event_id=$2",
      [event.application, event.event_id],
    );
    await client.query("COMMIT");
    return { processed: 1 };
  } catch {
    await client.query("ROLLBACK");
    if (eventId)
      await client.query(
        `UPDATE discovery_sync_event SET attempts=attempts+1,status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'pending' END,
      scheduled_at=now()+interval '5 minutes',error='index_failed' WHERE event_id=$1 AND application=$2 AND status='pending'`,
        [eventId, eventApplication],
      );
    return { processed: 0, failed: true };
  } finally {
    client.release();
  }
}

export async function rawAggregateTrending() {
  // Fixed hourly publication window and per-user-per-query caps reduce trivial inflation.
  const result =
    await pool.query(`WITH bounds AS (SELECT date_trunc('hour',now()) AS start),
    queries AS (SELECT i.id AS index_id,e.context->>'query' AS query,count(DISTINCT e.session_id)::int AS n
      FROM discovery_event e JOIN search_index i ON i.application=e.application AND (e.resource_type IS NULL OR i.resource_type=e.resource_type) CROSS JOIN bounds b
      WHERE e.type='search' AND e.occurred_at>=b.start-interval '24 hours' AND e.occurred_at<b.start
        AND i.is_enabled AND length(e.context->>'query') BETWEEN 2 AND 120
      GROUP BY i.id,e.context->>'query' HAVING count(DISTINCT e.session_id)>=3)
    INSERT INTO trending_query (index_id,normalized_query,query_count,score,window_started_at,window_ended_at)
      SELECT q.index_id,q.query,q.n,ln(1+q.n),b.start,b.start+interval '1 hour' FROM queries q CROSS JOIN bounds b
    ON CONFLICT (index_id,normalized_query,window_started_at,window_ended_at)
    DO UPDATE SET query_count=EXCLUDED.query_count,score=EXCLUDED.score,updated_at=now()`);
  return { aggregated: result.rowCount ?? 0 };
}
