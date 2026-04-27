import { describe, expect, it } from "vitest";
import {
  canDeleteModel,
  canDeleteProvider,
  saveModelAccessConfig,
  setPrimaryModel,
  validateBeforeSave
} from "../src/config-manager.js";
import type { DefaultModels, OpenClawConfig, ProvidersConfig } from "../src/types.js";

const providers: ProvidersConfig = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-xxxx",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        input: ["text", "image"],
        contextWindow: 128000,
        maxTokens: 16000,
        cost: { input: 1, output: 2, cacheRead: 0.5, cacheWrite: 0.5 }
      }
    ]
  }
};

const defaults: DefaultModels = {
  "openai/gpt-4o": {}
};

describe("validateBeforeSave", () => {
  it("should pass for valid configuration", () => {
    const result = validateBeforeSave(providers, defaults, "openai/gpt-4o");
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should fail for orphan default model", () => {
    const invalidDefaults: DefaultModels = {
      "openai/not-exists": {}
    };

    const result = validateBeforeSave(providers, invalidDefaults, "openai/not-exists");
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("不存在"))).toBe(true);
  });
});

describe("saveModelAccessConfig", () => {
  it("should only update managed paths", () => {
    const origin: OpenClawConfig = {
      gateway: { timeout: 120 },
      models: { mode: "online", providers: {} },
      agents: {
        defaults: {
          workspace: "keep-me",
          models: {},
          model: { primary: "old/model", fallbacks: ["keep-fallback"] }
        }
      }
    };

    const next = saveModelAccessConfig(origin, providers, defaults, "openai/gpt-4o");

    expect(next.gateway).toEqual({ timeout: 120 });
    expect(next.models?.mode).toBe("online");
    expect(next.agents?.defaults?.workspace).toBe("keep-me");
    expect(next.agents?.defaults?.model?.fallbacks).toEqual(["keep-fallback"]);
    expect(next.models?.providers).toEqual(providers);
    expect(next.agents?.defaults?.models).toEqual(defaults);
    expect(next.agents?.defaults?.model?.primary).toBe("openai/gpt-4o");
  });
});

describe("deletion guards", () => {
  it("should block deleting primary model", () => {
    const result = canDeleteModel("openai/gpt-4o", defaults, "openai/gpt-4o");
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("should block deleting provider when referenced", () => {
    const result = canDeleteProvider("openai", ["gpt-4o"], defaults, "openai/gpt-4o");
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe("setPrimaryModel", () => {
  it("adds primary into defaults automatically", () => {
    const result = setPrimaryModel(providers, {}, "openai/gpt-4o");
    expect(result.nextPrimary).toBe("openai/gpt-4o");
    expect(result.nextDefaults["openai/gpt-4o"]).toEqual({});
  });
});
