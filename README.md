# Snip frontend

Angular 22 web client for the Snip link shortener. The app expects the API at
`http://localhost:3000` and uses `POST /api/links` and `GET /api/links`.

## Run locally

```sh
npm install
npx ng serve
```

Open `http://localhost:4200`. To build the production bundle, run `npx ng build`.
