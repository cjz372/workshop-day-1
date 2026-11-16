const { resolve, sep } = require("node:path");

const links = new Map();
const codeAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const port = Number(process.env.PORT || 3000);
const configuredBaseURL =
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN.replace(/^https?:\/\//, "")}`
    : `http://localhost:${port}`);
const baseURL = new URL(configuredBaseURL);

if (baseURL.protocol !== "http:" && baseURL.protocol !== "https:") {
  throw new Error("BASE_URL must use HTTP or HTTPS");
}

const shortURLOrigin = baseURL.origin;
const publicDirectory = process.env.PUBLIC_DIR
  ? resolve(process.env.PUBLIC_DIR)
  : null;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function createCode() {
  let code = "";
  const bytes = new Uint8Array(12);

  while (code.length < 6) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 248) {
        code += codeAlphabet[byte % codeAlphabet.length];
        if (code.length === 6) break;
      }
    }
  }

  return code;
}

async function findPublicFile(pathname) {
  if (!publicDirectory) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const filePath = resolve(publicDirectory, relativePath);
  if (
    filePath !== publicDirectory &&
    !filePath.startsWith(`${publicDirectory}${sep}`)
  ) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  const response = new Response(file);
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { pathname } = new URL(request.url);

  if (request.method === "POST" && pathname === "/api/links") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (typeof body?.url !== "string") {
      return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
    }

    let originalURL;
    try {
      originalURL = new URL(body.url);
    } catch {
      return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
    }

    if (
      (originalURL.protocol !== "http:" && originalURL.protocol !== "https:") ||
      !originalURL.hostname
    ) {
      return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
    }

    let code;
    do {
      code = createCode();
    } while (links.has(code));

    const link = {
      code,
      url: originalURL.href,
      shortUrl: `${shortURLOrigin}/${code}`,
      hits: 0,
      createdAt: new Date().toISOString(),
    };
    links.set(code, link);
    return jsonResponse(link, 201);
  }

  if (request.method === "GET" && pathname === "/api/links") {
    return jsonResponse(Array.from(links.values()));
  }

  if (request.method === "GET" && publicDirectory) {
    const fileResponse = await findPublicFile(pathname);
    if (fileResponse === false) {
      return jsonResponse({ error: "Invalid path" }, 400);
    }
    if (fileResponse) return fileResponse;
  }

  if (
    request.method === "GET" &&
    pathname.startsWith("/") &&
    !pathname.slice(1).includes("/")
  ) {
    const link = links.get(pathname.slice(1));
    if (!link) return jsonResponse({ error: "Link not found" }, 404);

    link.hits += 1;
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: link.url,
      },
    });
  }

  return jsonResponse({ error: "Not found" }, 404);
}

Bun.serve({
  port,
  fetch: handleRequest,
});
