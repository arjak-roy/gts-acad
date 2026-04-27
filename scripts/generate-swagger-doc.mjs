import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFilePath), "..");
const apiRoot = path.join(repoRoot, "app", "api");
const outputPath = path.join(repoRoot, "docs", "swagger-admin.json");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
const PUBLIC_ROUTE_PREFIXES = [
  "/api/auth/login",
  "/api/auth/password-reset/request",
  "/api/auth/password-reset/confirm",
  "/api/auth/activate-account",
  "/api/certifications/verify/{code}",
  "/api/branding/{asset}",
  "/api/health",
];

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function walkRoutes(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRoutes(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function segmentToParam(segment) {
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    return `{${segment.slice(5, -2)}}`;
  }

  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return `{${segment.slice(4, -1)}}`;
  }

  if (segment.startsWith("[") && segment.endsWith("]")) {
    return `{${segment.slice(1, -1)}}`;
  }

  return segment;
}

function routeFileToPath(routeFile) {
  const relative = toPosixPath(path.relative(apiRoot, routeFile));
  const withoutFileName = relative.replace(/\/route\.ts$/, "");
  const pathSegments = withoutFileName
    .split("/")
    .filter(Boolean)
    .map(segmentToParam);

  return `/api/${pathSegments.join("/")}`;
}

function parseMethods(routeSource) {
  const methodRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g;
  const methods = new Set();
  let match = methodRegex.exec(routeSource);

  while (match) {
    methods.add(match[1]);
    match = methodRegex.exec(routeSource);
  }

  return [...methods];
}

function getPathParameters(apiPath) {
  const params = [];
  const regex = /\{([^}]+)\}/g;
  let match = regex.exec(apiPath);

  while (match) {
    params.push({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
      description: `Path parameter: ${match[1]}`,
    });

    match = regex.exec(apiPath);
  }

  return params;
}

function guessTag(apiPath) {
  const segments = apiPath.split("/").filter(Boolean);
  const afterApi = segments.slice(1);
  const first = afterApi.find((segment) => !segment.startsWith("{"));
  return first ?? "misc";
}

function isPublicPath(apiPath) {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => apiPath.startsWith(prefix));
}

function buildOperation(method, apiPath) {
  const lowerMethod = method.toLowerCase();
  const normalizedName = apiPath
    .replace(/^\/api\//, "")
    .split("/")
    .map((segment) => {
      if (segment.startsWith("{") && segment.endsWith("}")) {
        return `by_${segment.slice(1, -1)}`;
      }

      return segment;
    })
    .join("_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");

  const operation = {
    tags: [guessTag(apiPath)],
    summary: `${method} ${apiPath}`,
    operationId: `${lowerMethod}_${normalizedName}`,
    parameters: getPathParameters(apiPath),
    responses: {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ApiSuccessEnvelope",
            },
          },
        },
      },
      "400": { $ref: "#/components/responses/BadRequest" },
      "401": { $ref: "#/components/responses/Unauthorized" },
      "403": { $ref: "#/components/responses/Forbidden" },
      "404": { $ref: "#/components/responses/NotFound" },
      "409": { $ref: "#/components/responses/Conflict" },
      "500": { $ref: "#/components/responses/InternalServerError" },
      "503": { $ref: "#/components/responses/ServiceUnavailable" },
    },
  };

  if (["POST", "PUT", "PATCH"].includes(method)) {
    operation.requestBody = {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    };
  }

  if (!isPublicPath(apiPath)) {
    operation.security = [{ cookieAuth: [] }];
  }

  if (method === "POST") {
    operation.responses["201"] = {
      description: "Created (when applicable)",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/ApiSuccessEnvelope",
          },
        },
      },
    };
  }

  return operation;
}

function buildOpenApiDocument(routeFiles) {
  const paths = {};

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(routeFile, "utf8");
    const methods = parseMethods(source).filter((method) => method !== "OPTIONS" && method !== "HEAD");

    if (methods.length === 0) {
      continue;
    }

    const apiPath = routeFileToPath(routeFile);
    if (!paths[apiPath]) {
      paths[apiPath] = {};
    }

    for (const method of methods) {
      paths[apiPath][method.toLowerCase()] = buildOperation(method, apiPath);
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "GTS Academy Admin API",
      version: "1.0.0",
      description:
        "Auto-generated OpenAPI document from Next.js App Router API handlers in app/api. Response payloads follow { data: ... } on success and { error: ... } on failures.",
    },
    servers: [
      {
        url: "https://gts-acad.vercel.app",
        description: "Production",
      },
      {
        url: "http://localhost:3000",
        description: "Local development",
      },
    ],
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "gts_auth",
          description: "Session cookie set by /api/auth/login.",
        },
      },
      responses: {
        BadRequest: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
        Unauthorized: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
        Forbidden: {
          description: "Forbidden",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
        NotFound: {
          description: "Not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
        Conflict: {
          description: "Conflict",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
        InternalServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
        ServiceUnavailable: {
          description: "Service unavailable",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorEnvelope" },
            },
          },
        },
      },
      schemas: {
        ApiSuccessEnvelope: {
          type: "object",
          required: ["data"],
          properties: {
            data: {
              description: "Successful response payload",
              oneOf: [
                { type: "object", additionalProperties: true },
                { type: "array", items: { type: "object", additionalProperties: true } },
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "null" },
              ],
            },
          },
          additionalProperties: false,
        },
        ApiErrorEnvelope: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "string",
              description: "Human-readable error message",
            },
            details: {
              description: "Optional validation details",
              type: "object",
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
      },
    },
  };
}

function main() {
  const routeFiles = walkRoutes(apiRoot);
  const document = buildOpenApiDocument(routeFiles);

  fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  const pathCount = Object.keys(document.paths).length;
  console.log(`Generated ${outputPath} with ${pathCount} API paths.`);
}

main();
