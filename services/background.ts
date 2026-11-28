import { createBackgroundQueue } from "@/modules/principle/queue";

export const {
  enqueueBackgroundJob,
  processBackgroundJob,
  plugin: backgroundQueuePlugin,
} = createBackgroundQueue("discovery-jobs", {
  drain: drainBackgroundJobs,
  maintenance: runMaintenance,
});

async function drainBackgroundJobs() {
  const { rawSyncNextDocument: syncNextDocument } = await import("@/models/discovery-sync-event")
  for (let batch = 0; batch < 10; batch++) {
    const result = await syncNextDocument()
    if (("failed" in result && result.failed) || ("status" in result && result.status === "retry_or_failed"))
      throw new Error("Background delivery deferred")
    if (!result.processed) return
  }
  await enqueueBackgroundJob()
}

async function runMaintenance() {
  const { rawAggregateTrending: aggregateTrending } = await import("@/models/discovery-sync-event")
  await aggregateTrending()
}
