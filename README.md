# Snip

Snip is a URL shortener with one Bun API and two clients: an Angular web app
and a Node CLI. Links are stored in memory and disappear when the server restarts.

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/links` | `{ "url": "https://..." }` returns 201 with `code`, `url`, `shortUrl`, `hits`, `createdAt`; invalid JSON or URL returns 400 with `error` |
| GET | `/api/links` | Array of link records |
| GET | `/:code` | 302 redirect and one additional hit; 404 if unknown |

`backend`, `frontend`, and `cli` are independent branches mounted on `main`
as submodules. Each gitlink pins a specific commit. Clone all of them with:

```sh
git clone --recurse-submodules https://github.com/cjz372/workshop-day-1.git
```

In separate terminals, start the API with `cd backend && bun start`, the web
app with `cd frontend && npm install && npx ng serve`, and use the CLI with
`cd cli && node cli.js help`. The API listens on port 3000 by default; the
development UI listens on port 4200.

To update a component, commit and push on its own branch first. Then update
the pointer on `main`, commit it, and push:

```sh
git submodule update --remote backend
git add backend
git commit -m "Update backend submodule"
git push
```
