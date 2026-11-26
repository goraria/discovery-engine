import { createNitroErrorHandler } from "@gorth-com/principle/configs/nitro";
import { HTTPError, onError } from "nitro/h3";

export const handleServiceError = createNitroErrorHandler({
  project(error) {
    console.error("[discovery-engine-error] operation_failed");
    if (error instanceof HTTPError) {
      return new Response(error.message, {
        status: error.status,
        headers: error.headers,
      });
    }
    return Response.json(
      { error: "Internal Server Error", message: "Something went wrong" },
      {
        status: 500,
        headers: { "content-type": "application/json; charset=UTF-8" },
      },
    );
  },
});

export default onError(handleServiceError);
