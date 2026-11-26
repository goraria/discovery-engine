BEGIN;
CREATE TABLE IF NOT EXISTS discovery_sync_event (
  application varchar(64) NOT NULL, event_id uuid NOT NULL, resource_type varchar(64) NOT NULL, resource_id text NOT NULL,
  revision bigint NOT NULL CHECK(revision>0), operation text NOT NULL CHECK(operation IN ('upsert','delete')),
  document jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
  attempts integer NOT NULL DEFAULT 0, scheduled_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error text,
  PRIMARY KEY(application,event_id)
);
CREATE INDEX IF NOT EXISTS discovery_sync_event_due_idx ON discovery_sync_event(status,scheduled_at);
CREATE TABLE IF NOT EXISTS discovery_sync_cursor (
  application varchar(64) NOT NULL, resource_type varchar(64) NOT NULL, resource_id text NOT NULL, revision bigint NOT NULL,
  PRIMARY KEY(application,resource_type,resource_id)
);
COMMIT;
