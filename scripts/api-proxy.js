const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const envFilePath = path.join(process.cwd(), ".env");
const envFromFile = {};

if (fs.existsSync(envFilePath)) {
  const envLines = fs.readFileSync(envFilePath, "utf8").split(/\r?\n/);
  for (const rawLine of envLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    envFromFile[key] = value;
  }
}

const TARGET_ORIGIN =
  process.env.LIMPAE_PROXY_TARGET ||
  process.env.REACT_APP_API_URL ||
  envFromFile.REACT_APP_API_URL ||
  "https://limpae.onrender.com";
const PORT = Number(process.env.LIMPAE_PROXY_PORT || 8787);

const allowedHeaders = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "Accept",
  "Origin",
];

const getCorsOrigin = (req) => req.headers.origin || "http://localhost:8081";

const sendJson = (req, res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": getCorsOrigin(req),
    Vary: "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": allowedHeaders.join(", "),
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(payload));
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": getCorsOrigin(req),
      Vary: "Origin",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": allowedHeaders.join(", "),
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  try {
    const upstreamUrl = new URL(req.url, TARGET_ORIGIN);
    const transport = upstreamUrl.protocol === "https:" ? https : http;

    const upstreamRequest = transport.request(
      upstreamUrl,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: upstreamUrl.host,
          origin: TARGET_ORIGIN,
        },
      },
      (upstreamResponse) => {
        const responseHeaders = {
          ...upstreamResponse.headers,
          "access-control-allow-origin": getCorsOrigin(req),
          vary: "Origin",
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": allowedHeaders.join(", "),
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        };

        delete responseHeaders["content-length"];
        delete responseHeaders["content-security-policy"];
        delete responseHeaders["content-security-policy-report-only"];

        res.writeHead(upstreamResponse.statusCode || 500, responseHeaders);
        upstreamResponse.pipe(res);
      },
    );

    upstreamRequest.on("error", (error) => {
      sendJson(req, res, 502, {
        error: "Proxy upstream request failed",
        details: error.message,
      });
    });

    req.pipe(upstreamRequest);
  } catch (error) {
    sendJson(req, res, 500, {
      error: "Proxy request setup failed",
      details: error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`[limpae proxy] forwarding ${TARGET_ORIGIN} on http://localhost:${PORT}`);
});
