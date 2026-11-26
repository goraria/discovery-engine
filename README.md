# Discovery API

The discovery service owns a shared search index. It does not read vertical
application databases directly. All API path segments use singular names.

Public reads:

- `GET /discovery/search?application=video&type=video&query=...&limit=20&offset=0`
- `GET /discovery/suggestion?application=video&type=video&query=...`
- `GET /discovery/trending?application=video&type=video`
- `GET /discovery/recommendation?application=video&type=video&id=...`

An optional `facet` and `value` pair filters search results. Public reads return
only documents with `visibility=public` that have not been soft-deleted.

Writes require a Bearer access token issued by Gorth SSO for this service's
audience. The service verifies issuer, audience, OAuth client ID, the caller's
`<application>:write` scope, and current UserInfo status before writing:

- `PUT /discovery/document/:type/:id` upserts a document and its facets.
- `DELETE /discovery/document/:type/:id` soft-deletes a document.
- `PUT /discovery/suggestion/:type` upserts a curated suggestion.
- `POST /discovery/event` records an interaction.

The document body accepts `title`, `content`, `keywords`, `canonicalUrl`,
`imageUrl`, `visibility`, `rankingWeight`, `metadata`, `facets`,
`sourceCreatedAt`, and `sourceUpdatedAt`. The authenticated OAuth client,
not the request body, determines the application namespace.

Each vertical application must publish public document changes and deletions
to this API and backfill existing content before its UI can replace local
search. Do not switch an existing search screen to this index while it is
empty. Configure a distinct production resource URL/audience and register it
in SSO; the localhost URL is for local development only.
# discovery-engine
