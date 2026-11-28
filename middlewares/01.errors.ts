import { onError } from "nitro/h3";
import { createServiceErrorHandler } from "@/modules/principle/service-errors";

export const handleServiceError = createServiceErrorHandler(
  "[discovery-engine-error]",
  undefined,
  { error: "Internal Server Error", message: "Something went wrong" },
  true,
);

export default onError(handleServiceError);
