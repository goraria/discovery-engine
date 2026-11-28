import type { Binding, Event } from "@/utils/interface";
import type { MiddlewareHandler } from "hono";
import { serviceAuthFailure, serviceTokenConfiguration } from "@/lib/auth/verification";
import { verifyServiceMachineGrant } from "@/modules/structure/machine-verification";
import { applicationNamespaces } from "@/utils/constant";

const scopes = Object.fromEntries(
  applicationNamespaces.map((application) => [`${application}:discovery:write`, application]),
);

export function requireIndexer(): MiddlewareHandler<Binding> {
  return async (context: Event, next) => {
    try {
      const grant = await verifyServiceMachineGrant(
        context.req.raw, "discovery", await serviceTokenConfiguration(), Object.keys(scopes),
      );
      context.set("app", scopes[grant.scope]);
      context.set("sub", grant.clientId);
    } catch (error) {
      return serviceAuthFailure(error, context.req.raw);
    }
    return await next();
  };
}
