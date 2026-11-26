import { HTTPError } from "nitro/h3";
export interface ReaderSearchInput {
  query: string;
  limit: number;
}
export function parseReaderSearch(value: unknown): ReaderSearchInput {
  const input = value as Partial<ReaderSearchInput> | null;
  const query = typeof input?.query === "string" ? input.query.trim() : "";
  const limit = input?.limit ?? 50;
  if (
    !query ||
    query.length > 200 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new HTTPError({ status: 400, message: "invalid_reader_search" });
  return { query, limit };
}
