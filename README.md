# Snip CLI

The Snip CLI is a zero-dependency Node.js client for the Snip URL shortener.
It requires Node.js 20 or newer. The API base URL defaults to
`http://localhost:3000`; set `SNIP_API` to use another backend.

```sh
node cli.js help
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

The `snip`, `snip.cmd`, and `snip.ps1` wrappers forward their arguments to
`cli.js`. Install the package globally with `npm install -g .` to use the
`snip` command from your PATH.

Run the CLI checks with `npm test`.
