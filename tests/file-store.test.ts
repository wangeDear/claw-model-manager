import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractManagedConfigSlice, readOpenClawConfig, updateManagedConfig } from "../src/file-store.js";
import type { OpenClawConfig, ProvidersConfig } from "../src/types.js";

describe("file-store", () => {
  it("reads and writes managed config without touching other keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claw-model-manager-"));
    const file = join(dir, "openclaw.json");

    const original: OpenClawConfig = {
      gateway: { timeout: 30 },
      models: { mode: "online", providers: {} },
      agents: {
        defaults: {
          workspace: "/tmp/ws",
          models: {},
          model: { primary: "", fallbacks: ["fallback-1"] }
        }
      }
    };

    await writeFile(file, JSON.stringify(original, null, 2));

    const providers: ProvidersConfig = {
      deepseek: {
        baseUrl: "https://api.example.com/v1",
        models: [
          {
            id: "deepseek-v4-pro",
            name: "DeepSeek V4 Pro",
            input: ["text"],
            contextWindow: 128000,
            maxTokens: 8192
          }
        ]
      }
    };

    const { validation } = await updateManagedConfig(
      {
        providers,
        defaultModels: {
          "deepseek/deepseek-v4-pro": {}
        },
        primary: "deepseek/deepseek-v4-pro"
      },
      file
    );

    expect(validation.ok).toBe(true);

    const next = await readOpenClawConfig(file);
    expect(next.gateway).toEqual({ timeout: 30 });
    expect(next.models?.mode).toBe("online");
    expect(next.agents?.defaults?.workspace).toBe("/tmp/ws");
    expect(next.agents?.defaults?.model?.fallbacks).toEqual(["fallback-1"]);

    const managed = extractManagedConfigSlice(next);
    expect(Object.keys(managed.providers)).toContain("deepseek");
    expect(managed.primary).toBe("deepseek/deepseek-v4-pro");
  });

  it("returns validation errors and does not save invalid updates", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claw-model-manager-"));
    const file = join(dir, "openclaw.json");
    await writeFile(file, JSON.stringify({ models: { providers: {} } }, null, 2));

    const result = await updateManagedConfig(
      {
        providers: {},
        defaultModels: { "bad/ref": {} },
        primary: "bad/ref"
      },
      file
    );

    expect(result.validation.ok).toBe(false);

    const afterRaw = await readFile(file, "utf8");
    expect(afterRaw).toContain('"providers": {}');
  });
});
