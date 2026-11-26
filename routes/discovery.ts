import { Hono } from "hono";
import { actSearchChatMessages } from "@/controllers/chat";
import {
  actDeleteDocumentController,
  actPostEventController,
  actPutDocumentController,
  actPutSuggestionController,
  actRecommendationController,
  actSearchController,
  actSuggestionController,
  actTrendingController,
} from "@/controllers/discovery";
import { actSearchReaderContent } from "@/controllers/reader";
import { actSearchSocialPosts } from "@/controllers/social";
import {
  actIngestDocuments,
  actPersonalizedRecommendations,
} from "@/controllers/sync";
import { actSearchVideoContent } from "@/controllers/video";
import { requireAuth, requireWriteAuth } from "@/middlewares/auth";
import { requireIndexer } from "@/middlewares/indexer";

export const discoveryRoutes = new Hono();

discoveryRoutes.post("/chat/search", requireIndexer(), actSearchChatMessages);
discoveryRoutes.post("/reader/search", requireIndexer(), actSearchReaderContent);
discoveryRoutes.get(
  "/recommendation/me",
  requireAuth("read"),
  actPersonalizedRecommendations,
);
discoveryRoutes.post("/social/search", requireIndexer(), actSearchSocialPosts);
discoveryRoutes.post("/video/search", requireIndexer(), actSearchVideoContent);
discoveryRoutes.delete(
  "/document/:type/:id",
  requireIndexer(),
  actDeleteDocumentController,
);
discoveryRoutes.put("/document/:type/:id", requireIndexer(), actPutDocumentController);
discoveryRoutes.put("/suggestion/:type", requireIndexer(), actPutSuggestionController);
discoveryRoutes.post("/event", requireWriteAuth(), actPostEventController);
discoveryRoutes.get("/recommendation", actRecommendationController);
discoveryRoutes.get("/search", actSearchController);
discoveryRoutes.get("/suggestion", actSuggestionController);
discoveryRoutes.post("/sync", requireIndexer(), actIngestDocuments);
discoveryRoutes.get("/trending", actTrendingController);
