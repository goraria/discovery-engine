CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "discovery_event_type" AS ENUM('impression', 'click', 'search', 'view', 'conversion', 'feedback');--> statement-breakpoint
CREATE TYPE "recommendation_strategy" AS ENUM('personalized', 'related', 'similar', 'trending', 'collaborative', 'frequently_bought');--> statement-breakpoint
CREATE TABLE "discovery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"search_query_id" uuid,
	"session_id" text,
	"application" varchar(64) NOT NULL,
	"type" "discovery_event_type" NOT NULL,
	"resource_type" varchar(64),
	"resource_id" text,
	"value" numeric(16,6),
	"context" jsonb DEFAULT '{}' NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"application" varchar(64) NOT NULL,
	"strategy" "recommendation_strategy" NOT NULL,
	"source_resource_type" varchar(64),
	"source_resource_id" text,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" text NOT NULL,
	"score" numeric(16,6) NOT NULL,
	"rank" integer NOT NULL,
	"reason" text,
	"context" jsonb DEFAULT '{}' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_document_facets" (
	"document_id" uuid,
	"name" varchar(64),
	"value" text,
	CONSTRAINT "search_document_facets_pkey" PRIMARY KEY("document_id","name","value")
);
--> statement-breakpoint
CREATE TABLE "search_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"index_id" uuid NOT NULL,
	"resource_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"canonical_url" text,
	"image_url" text,
	"language_code" varchar(16),
	"visibility" varchar(32) DEFAULT 'public' NOT NULL,
	"ranking_weight" numeric(10,4) DEFAULT '1' NOT NULL,
	"search_vector" tsvector,
	"embedding" vector(1536),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"source_created_at" timestamp,
	"source_updated_at" timestamp,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "search_indexes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"application" varchar(64) NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"default_language" varchar(16),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"configuration" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"index_id" uuid,
	"query" text NOT NULL,
	"normalized_query" text NOT NULL,
	"filters" jsonb DEFAULT '{}' NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"index_id" uuid NOT NULL,
	"phrase" text NOT NULL,
	"weight" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"index_id" uuid NOT NULL,
	"phrase" text NOT NULL,
	"replacements" text[] NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trending_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"index_id" uuid NOT NULL,
	"normalized_query" text NOT NULL,
	"query_count" integer DEFAULT 0 NOT NULL,
	"score" numeric(16,6) DEFAULT '0' NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"window_ended_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_discovery_preferences" (
	"user_id" uuid,
	"application" varchar(64),
	"key" varchar(128),
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_discovery_preferences_pkey" PRIMARY KEY("user_id","application","key")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" uuid,
	"application" varchar(64),
	"interest" varchar(128),
	"score" numeric(16,6) DEFAULT '0' NOT NULL,
	"source" varchar(64),
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_pkey" PRIMARY KEY("user_id","application","interest")
);
--> statement-breakpoint
CREATE TABLE "user_resource_affinities" (
	"user_id" uuid,
	"application" varchar(64),
	"resource_type" varchar(64),
	"resource_id" text,
	"score" numeric(16,6) DEFAULT '0' NOT NULL,
	"context" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_resource_affinities_pkey" PRIMARY KEY("user_id","application","resource_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"external_user_id" text NOT NULL UNIQUE,
	"name" text DEFAULT '' NOT NULL,
	"username" varchar(32) UNIQUE,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"image" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "discovery_events_user_occurred_at_idx" ON "discovery_events" ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "discovery_events_resource_type_idx" ON "discovery_events" ("application","resource_type","resource_id","type");--> statement-breakpoint
CREATE INDEX "recommendations_user_strategy_rank_idx" ON "recommendations" ("user_id","strategy","rank");--> statement-breakpoint
CREATE INDEX "recommendations_resource_idx" ON "recommendations" ("application","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "search_document_facets_name_value_idx" ON "search_document_facets" ("name","value");--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_index_resource_key" ON "search_documents" ("index_id","resource_id");--> statement-breakpoint
CREATE INDEX "search_documents_vector_idx" ON "search_documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "search_documents_index_visibility_weight_idx" ON "search_documents" ("index_id","visibility","ranking_weight");--> statement-breakpoint
CREATE INDEX "search_documents_source_updated_at_idx" ON "search_documents" ("source_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_indexes_application_resource_type_key" ON "search_indexes" ("application","resource_type");--> statement-breakpoint
CREATE INDEX "search_indexes_enabled_idx" ON "search_indexes" ("is_enabled");--> statement-breakpoint
CREATE INDEX "search_queries_user_created_at_idx" ON "search_queries" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "search_queries_normalized_created_at_idx" ON "search_queries" ("normalized_query","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_suggestions_index_phrase_key" ON "search_suggestions" ("index_id","phrase");--> statement-breakpoint
CREATE INDEX "search_suggestions_index_weight_idx" ON "search_suggestions" ("index_id","weight");--> statement-breakpoint
CREATE UNIQUE INDEX "search_synonyms_index_phrase_key" ON "search_synonyms" ("index_id","phrase");--> statement-breakpoint
CREATE UNIQUE INDEX "trending_queries_index_query_window_key" ON "trending_queries" ("index_id","normalized_query","window_started_at","window_ended_at");--> statement-breakpoint
CREATE INDEX "trending_queries_index_score_idx" ON "trending_queries" ("index_id","score");--> statement-breakpoint
CREATE INDEX "user_interests_app_score_idx" ON "user_interests" ("application","score");--> statement-breakpoint
CREATE INDEX "user_resource_affinities_user_score_idx" ON "user_resource_affinities" ("user_id","score");--> statement-breakpoint
CREATE INDEX "users_last_seen_at_idx" ON "users" ("last_seen_at");--> statement-breakpoint
ALTER TABLE "discovery_events" ADD CONSTRAINT "discovery_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "discovery_events" ADD CONSTRAINT "discovery_events_search_query_id_search_queries_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_queries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "search_document_facets" ADD CONSTRAINT "search_document_facets_document_id_search_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "search_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_index_id_search_indexes_id_fkey" FOREIGN KEY ("index_id") REFERENCES "search_indexes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_index_id_search_indexes_id_fkey" FOREIGN KEY ("index_id") REFERENCES "search_indexes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "search_suggestions" ADD CONSTRAINT "search_suggestions_index_id_search_indexes_id_fkey" FOREIGN KEY ("index_id") REFERENCES "search_indexes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "search_synonyms" ADD CONSTRAINT "search_synonyms_index_id_search_indexes_id_fkey" FOREIGN KEY ("index_id") REFERENCES "search_indexes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trending_queries" ADD CONSTRAINT "trending_queries_index_id_search_indexes_id_fkey" FOREIGN KEY ("index_id") REFERENCES "search_indexes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_discovery_preferences" ADD CONSTRAINT "user_discovery_preferences_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_resource_affinities" ADD CONSTRAINT "user_resource_affinities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
