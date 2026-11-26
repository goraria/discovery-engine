import { QueueClient } from "@vercel/queue"
const queue = new QueueClient({ telemetry: { isEnabled: false } })
export async function enqueueBackgroundJob(kind: "drain" | "maintenance" = "drain") {
  await queue.send("discovery-jobs", { kind })
}
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
export async function processBackgroundJob(message: unknown) {
  const kind = message && typeof message === "object" ? (message as { kind?: unknown }).kind : undefined
  if (kind === "maintenance") {
    const { rawAggregateTrending: aggregateTrending } = await import("@/models/discovery-sync-event")
    await aggregateTrending()
    return
  }
  if (kind !== "drain") throw new Error("Invalid background job")
  await drainBackgroundJobs()
}
