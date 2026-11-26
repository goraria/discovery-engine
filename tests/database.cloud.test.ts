import { beforeAll, beforeEach, afterEach, afterAll, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { databaseUrl } from "@/utils/environment";
if (!databaseUrl) throw new Error("cloud_database_not_configured");
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 15000 });
let client: PoolClient;
beforeAll(async () => { client = await pool.connect(); await client.query("BEGIN"); await client.query("SET LOCAL statement_timeout='15s'"); });
beforeEach(async () => { await client.query("SAVEPOINT fixture"); });
afterEach(async () => { if (client) { await client.query("ROLLBACK TO SAVEPOINT fixture"); await client.query("RELEASE SAVEPOINT fixture"); } });
afterAll(async () => { if (client) { await client.query("ROLLBACK"); client.release(); } await pool.end(); });

import { rawUpsertDocument } from "@/models/search-document";
const application = "reader", resourceType = "cloud_readiness", resourceId = crypto.randomUUID();
it("creates an index, vectorized document and facets atomically on first upsert", async () => {
  await rawUpsertDocument(application,resourceType,resourceId,{title:"Unicode tìm kiếm",content:"Cloud integration fixture",keywords:["needle"],visibility:"private",facets:{kind:["fixture"]}},client);
  const {rows}=await client.query("SELECT d.visibility,d.search_vector @@ plainto_tsquery('simple','needle') AS searchable FROM search_document d JOIN search_index i ON i.id=d.index_id WHERE i.application=$1 AND i.resource_type=$2 AND d.resource_id=$3",[application,resourceType,resourceId]);
  expect(rows).toEqual([{visibility:"private",searchable:true}]);
});
it("updates the existing document without duplicating its resource identity", async () => {
  await rawUpsertDocument(application,resourceType,resourceId,{title:"First",visibility:"private"},client);
  await rawUpsertDocument(application,resourceType,resourceId,{title:"Second",visibility:"private"},client);
  const {rows}=await client.query("SELECT d.title FROM search_document d JOIN search_index i ON i.id=d.index_id WHERE i.application=$1 AND i.resource_type=$2 AND d.resource_id=$3",[application,resourceType,resourceId]);
  expect(rows).toEqual([{title:"Second"}]);
});
it.each([[0,"upsert","pending"],[1,"unknown","pending"],[1,"upsert","unknown"]])("rejects invalid sync state %j", async(revision,operation,status)=>{
  await expect(client.query("INSERT INTO discovery_sync_event(application,event_id,resource_type,resource_id,revision,operation,document,status) VALUES($1,$2,$3,$4,$5,$6,'{}',$7)",[application,crypto.randomUUID(),resourceType,resourceId,revision,operation,status])).rejects.toMatchObject({code:"23514"});
});
