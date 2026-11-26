import type { Context } from "hono";

export const applications = [
  "chat",
  "video",
  "reader",
  "social",
  "task",
  "marketplace",
  "restaurant",
] as const;

export type Application = (typeof applications)[number];

export interface AppContext {
  application: Application;
  subject: string;
}

export interface ApiEnv {
  Variables: Partial<AppContext>
}

export type ApiContext = Context<ApiEnv>;
