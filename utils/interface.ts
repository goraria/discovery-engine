export type ServiceAccess = "read" | "write";
import type { Context } from "hono";

import type { Application } from "@/utils/constant";

export interface Session {
  app: Application;
  sub: string;
}

export interface Binding {
  Variables: Partial<Session>
}

export type Event = Context<Binding>;
