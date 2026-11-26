import { Hono } from "hono";
import { defineHandler } from "nitro";
import { routeNotFound } from "@/app/error";
import { discoveryRoutes } from "@/routes/discovery";
import { sharedRoutes } from "@/routes/shared";

export const router = new Hono();
router.onError((error) => { throw error });
router.notFound((context) => routeNotFound(context.req.raw));
router.route("/discovery", discoveryRoutes);
router.route("/", sharedRoutes);

export default defineHandler((event) => router.fetch(event.req));
