import { createServiceVerification } from "@/modules/structure/service-verification";
import { applicationNamespaces } from "@/utils/constant";
import { authUrl, nodeEnv } from "@/utils/environment";

export const {
  serviceTokenConfiguration,
  verifyServiceRequest,
  serviceAuthFailure,
  serviceResourceMetadata,
} = createServiceVerification({
  service: "discovery",
  authUrl,
  nodeEnv,
  applications: applicationNamespaces,
  scopeFor: (application, access) => `${application}:${access}`,
});
