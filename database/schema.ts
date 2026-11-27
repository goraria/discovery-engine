export { rateLimit } from "@/database/rate-limit";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import {
  boolean,
  bigint,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const discoverySyncEventsTable = pgTable("discovery_sync_event", {
  application: varchar("application", { length: 64 }).notNull(),
  eventId: uuid("event_id").notNull(),
  resourceType: varchar("resource_type", { length: 64 }).notNull(),
  resourceId: text("resource_id").notNull(),
  revision: bigint("revision", { mode: "number" }).notNull(),
  operation: text("operation").notNull(),
  document: jsonb("document").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
}, (table) => [
  primaryKey({ columns: [table.application, table.eventId] }),
  index("discovery_sync_event_due_idx").on(table.status, table.scheduledAt),
  check("discovery_sync_event_revision_check", sql`${table.revision} > 0`),
  check("discovery_sync_event_operation_check", sql`${table.operation} IN ('upsert', 'delete')`),
  check("discovery_sync_event_status_check", sql`${table.status} IN ('pending', 'completed', 'failed')`),
]);
export const discoverySyncCursorsTable = pgTable("discovery_sync_cursor", {
  application: varchar("application", { length: 64 }).notNull(),
  resourceType: varchar("resource_type", { length: 64 }).notNull(),
  resourceId: text("resource_id").notNull(),
  revision: bigint("revision", { mode: "number" }).notNull(),
}, (table) => [primaryKey({ columns: [table.application, table.resourceType, table.resourceId] })]);

const embeddingVector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

export const recommendationStrategy = pgEnum("recommendation_strategy", [
  "personalized",
  "related",
  "similar",
  "trending",
  "collaborative",
  "frequently_bought",
]);

export const discoveryEventType = pgEnum("discovery_event_type", [
  "impression",
  "click",
  "search",
  "view",
  "conversion",
  "feedback",
]);

export const usersTable = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalUserId: text("external_user_id").notNull().unique(),
    name: text("name").notNull().default(""),
    username: varchar("username", { length: 32 }).unique(),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    image: text("image"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("users_last_seen_at_idx").on(table.lastSeenAt)],
);

export const searchIndexesTable = pgTable(
  "search_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    application: varchar("application", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    defaultLanguage: varchar("default_language", { length: 16 }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    configuration: jsonb("configuration")
      .notNull()
      .default(sql.raw("'{}'::jsonb")),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("search_indexes_application_resource_type_key").on(
      table.application,
      table.resourceType,
    ),
    index("search_indexes_enabled_idx").on(table.isEnabled),
  ],
);

export const searchDocumentsTable = pgTable(
  "search_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indexId: uuid("index_id")
      .notNull()
      .references(() => searchIndexesTable.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    canonicalUrl: text("canonical_url"),
    imageUrl: text("image_url"),
    languageCode: varchar("language_code", { length: 16 }),
    visibility: varchar("visibility", { length: 32 })
      .notNull()
      .default("public"),
    rankingWeight: numeric("ranking_weight", { precision: 10, scale: 4 })
      .notNull()
      .default("1"),
    searchVector: tsvector("search_vector"),
    embedding: embeddingVector("embedding"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    sourceCreatedAt: timestamp("source_created_at", { mode: "date" }),
    sourceUpdatedAt: timestamp("source_updated_at", { mode: "date" }),
    indexedAt: timestamp("indexed_at", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("search_documents_index_resource_key").on(
      table.indexId,
      table.resourceId,
    ),
    index("search_documents_vector_idx").using("gin", table.searchVector),
    index("search_documents_index_visibility_weight_idx").on(
      table.indexId,
      table.visibility,
      table.rankingWeight,
    ),
    index("search_documents_source_updated_at_idx").on(table.sourceUpdatedAt),
  ],
);

export const searchDocumentFacetsTable = pgTable(
  "search_document_facet",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => searchDocumentsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.name, table.value] }),
    index("search_document_facets_name_value_idx").on(table.name, table.value),
  ],
);

export const searchSynonymsTable = pgTable(
  "search_synonym",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indexId: uuid("index_id")
      .notNull()
      .references(() => searchIndexesTable.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    replacements: text("replacements").array().notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("search_synonyms_index_phrase_key").on(
      table.indexId,
      table.phrase,
    ),
  ],
);

export const searchSuggestionsTable = pgTable(
  "search_suggestion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indexId: uuid("index_id")
      .notNull()
      .references(() => searchIndexesTable.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    weight: integer("weight").notNull().default(0),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("search_suggestions_index_phrase_key").on(
      table.indexId,
      table.phrase,
    ),
    index("search_suggestions_index_weight_idx").on(
      table.indexId,
      table.weight,
    ),
  ],
);

export const searchQueriesTable = pgTable(
  "search_query",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    indexId: uuid("index_id").references(() => searchIndexesTable.id, {
      onDelete: "set null",
    }),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    filters: jsonb("filters").notNull().default(sql.raw("'{}'::jsonb")),
    resultCount: integer("result_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("search_queries_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("search_queries_normalized_created_at_idx").on(
      table.normalizedQuery,
      table.createdAt,
    ),
  ],
);

export const trendingQueriesTable = pgTable(
  "trending_query",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    indexId: uuid("index_id")
      .notNull()
      .references(() => searchIndexesTable.id, { onDelete: "cascade" }),
    normalizedQuery: text("normalized_query").notNull(),
    queryCount: integer("query_count").notNull().default(0),
    score: numeric("score", { precision: 16, scale: 6 }).notNull().default("0"),
    windowStartedAt: timestamp("window_started_at", { mode: "date" }).notNull(),
    windowEndedAt: timestamp("window_ended_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("trending_queries_index_query_window_key").on(
      table.indexId,
      table.normalizedQuery,
      table.windowStartedAt,
      table.windowEndedAt,
    ),
    index("trending_queries_index_score_idx").on(table.indexId, table.score),
  ],
);

export const userInterestsTable = pgTable(
  "user_interest",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    application: varchar("application", { length: 64 }).notNull(),
    interest: varchar("interest", { length: 128 }).notNull(),
    score: numeric("score", { precision: 16, scale: 6 }).notNull().default("0"),
    source: varchar("source", { length: 64 }),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.application, table.interest] }),
    index("user_interests_app_score_idx").on(table.application, table.score),
  ],
);

export const userDiscoveryPreferencesTable = pgTable(
  "user_discovery_preference",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    application: varchar("application", { length: 64 }).notNull(),
    key: varchar("key", { length: 128 }).notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.application, table.key] }),
  ],
);

export const userResourceAffinitiesTable = pgTable(
  "user_resource_affinity",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    application: varchar("application", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: text("resource_id").notNull(),
    score: numeric("score", { precision: 16, scale: 6 }).notNull().default("0"),
    context: jsonb("context").notNull().default(sql.raw("'{}'::jsonb")),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.userId,
        table.application,
        table.resourceType,
        table.resourceId,
      ],
    }),
    index("user_resource_affinities_user_score_idx").on(
      table.userId,
      table.score,
    ),
  ],
);

export const recommendationsTable = pgTable(
  "recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    application: varchar("application", { length: 64 }).notNull(),
    strategy: recommendationStrategy("strategy").notNull(),
    sourceResourceType: varchar("source_resource_type", { length: 64 }),
    sourceResourceId: text("source_resource_id"),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: text("resource_id").notNull(),
    score: numeric("score", { precision: 16, scale: 6 }).notNull(),
    rank: integer("rank").notNull(),
    reason: text("reason"),
    context: jsonb("context").notNull().default(sql.raw("'{}'::jsonb")),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("recommendations_user_strategy_rank_idx").on(
      table.userId,
      table.strategy,
      table.rank,
    ),
    index("recommendations_resource_idx").on(
      table.application,
      table.resourceType,
      table.resourceId,
    ),
  ],
);

export const discoveryEventsTable = pgTable(
  "discovery_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    searchQueryId: uuid("search_query_id").references(
      () => searchQueriesTable.id,
      { onDelete: "set null" },
    ),
    sessionId: text("session_id"),
    application: varchar("application", { length: 64 }).notNull(),
    type: discoveryEventType("type").notNull(),
    resourceType: varchar("resource_type", { length: 64 }),
    resourceId: text("resource_id"),
    value: numeric("value", { precision: 16, scale: 6 }),
    context: jsonb("context").notNull().default(sql.raw("'{}'::jsonb")),
    occurredAt: timestamp("occurred_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("discovery_events_user_occurred_at_idx").on(
      table.userId,
      table.occurredAt,
    ),
    index("discovery_events_resource_type_idx").on(
      table.application,
      table.resourceType,
      table.resourceId,
      table.type,
    ),
  ],
);

export const searchIndexesRelations = relations(
  searchIndexesTable,
  ({ many }) => ({
    documents: many(searchDocumentsTable),
    synonyms: many(searchSynonymsTable),
    suggestions: many(searchSuggestionsTable),
    queries: many(searchQueriesTable),
  }),
);

export const searchDocumentsRelations = relations(
  searchDocumentsTable,
  ({ many, one }) => ({
    index: one(searchIndexesTable, {
      fields: [searchDocumentsTable.indexId],
      references: [searchIndexesTable.id],
    }),
    facets: many(searchDocumentFacetsTable),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type SearchIndex = typeof searchIndexesTable.$inferSelect;
export type SearchDocument = typeof searchDocumentsTable.$inferSelect;
export type SearchDocumentFacet = typeof searchDocumentFacetsTable.$inferSelect;
export type SearchSynonym = typeof searchSynonymsTable.$inferSelect;
export type SearchSuggestion = typeof searchSuggestionsTable.$inferSelect;
export type SearchQuery = typeof searchQueriesTable.$inferSelect;
export type TrendingQuery = typeof trendingQueriesTable.$inferSelect;
export type UserInterest = typeof userInterestsTable.$inferSelect;
export type UserDiscoveryPreference =
  typeof userDiscoveryPreferencesTable.$inferSelect;
export type UserResourceAffinity =
  typeof userResourceAffinitiesTable.$inferSelect;
export type Recommendation = typeof recommendationsTable.$inferSelect;
export type DiscoveryEvent = typeof discoveryEventsTable.$inferSelect;
