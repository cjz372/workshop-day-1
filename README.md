# Snip backend

A zero-dependency Bun API for the Snip URL shortener. Links are kept in memory
and are cleared when the server restarts.

Run with `bun start` (default port `3000`). Set `PORT` to change the port,
`BASE_URL` to set the short-link origin, or `RAILWAY_PUBLIC_DOMAIN` to derive an
HTTPS origin when `BASE_URL` is unset. `PUBLIC_DIR` optionally enables static
file serving from that directory.

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/links` | Create a link from `{ "url": "https://…" }` |
| `GET` | `/api/links` | List all links |
| `GET` | `/:code` | Redirect to the original URL and increment its hit count |
