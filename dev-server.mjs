import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.argv[2] || 5173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  let filePath = normalize(join(root, decodedPath));

  if (relative(root, filePath).startsWith("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    filePath = join(root, "index.html");
  }

  if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  const type = mimeTypes[extname(filePath)] || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-cache"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`SanWeiGrowthPWA running at http://${host}:${port}`);
});
