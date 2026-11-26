import "@/utils/environment";
import { serviceHttp } from "@/middlewares/http";

export default serviceHttp({
  maxBodySize: 1048576,
  compress: false,
  cors: false,
  insightProxy: false,
});
