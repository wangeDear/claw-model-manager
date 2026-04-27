import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  DEFAULT_CONFIG_PATH,
  extractManagedConfigSlice,
  readOpenClawConfig,
  updateManagedConfig
} from "./file-store.js";

import type { DefaultModels, ProvidersConfig } from "./types.js";

interface SavePayload {
  providers: ProvidersConfig;
  defaultModels: DefaultModels;
  primary: string;
  path?: string;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    throw new Error("请求体不能为空");
  }

  return JSON.parse(text) as T;
}

function json(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method === "GET" && req.url?.startsWith("/api/config")) {
      const configPath = new URL(req.url, "http://localhost").searchParams.get("path") ?? DEFAULT_CONFIG_PATH;
      const config = await readOpenClawConfig(configPath);
      json(res, 200, {
        path: configPath,
        managed: extractManagedConfigSlice(config),
        raw: config
      });
      return;
    }

    if (req.method === "PUT" && req.url === "/api/config") {
      const payload = await readJsonBody<SavePayload>(req);
      const result = await updateManagedConfig(
        {
          providers: payload.providers,
          defaultModels: payload.defaultModels,
          primary: payload.primary
        },
        payload.path ?? DEFAULT_CONFIG_PATH
      );

      if (!result.validation.ok) {
        json(res, 400, { ok: false, errors: result.validation.errors });
        return;
      }

      json(res, 200, {
        ok: true,
        managed: extractManagedConfigSlice(result.config)
      });
      return;
    }

    json(res, 404, { ok: false, error: "Not Found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    json(res, 500, { ok: false, error: message });
  }
}

export function startServer(port = 3760): void {
  createServer((req, res) => {
    void handler(req, res);
  }).listen(port, () => {
    console.log(`ClawModel Manager backend listening on http://127.0.0.1:${port}`);
    console.log(`Default OpenClaw config path: ${DEFAULT_CONFIG_PATH}`);
  });
}

if (process.argv[1]?.endsWith("backend.js")) {
  const portArg = process.argv[2];
  const port = portArg ? Number(portArg) : 3760;
  startServer(Number.isFinite(port) ? port : 3760);
}
