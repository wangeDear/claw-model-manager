import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  saveModelAccessConfig,
  validateBeforeSave,
  type ValidationResult
} from "./config-manager.js";
import type { DefaultModels, OpenClawConfig, ProvidersConfig } from "./types.js";

export const DEFAULT_CONFIG_PATH = "/root/.openclaw/openclaw.json";

export interface ManagedConfigSlice {
  providers: ProvidersConfig;
  defaultModels: DefaultModels;
  primary: string;
}


export function getOAuthProviderIds(config: OpenClawConfig): string[] {
  const profiles = config.auth?.profiles ?? {};
  return Array.from(
    new Set(
      Object.values(profiles)
        .filter((profile) => profile?.mode === "oauth" && typeof profile.provider === "string")
        .map((profile) => profile.provider as string)
    )
  );
}

export function extractManagedConfigSlice(config: OpenClawConfig): ManagedConfigSlice {
  return {
    providers: (config.models?.providers ?? {}) as ProvidersConfig,
    defaultModels: (config.agents?.defaults?.models ?? {}) as DefaultModels,
    primary: config.agents?.defaults?.model?.primary ?? ""
  };
}

export async function readOpenClawConfig(path = DEFAULT_CONFIG_PATH): Promise<OpenClawConfig> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as OpenClawConfig;
}

export async function writeOpenClawConfig(config: OpenClawConfig, path = DEFAULT_CONFIG_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function updateManagedConfig(
  nextSlice: ManagedConfigSlice,
  path = DEFAULT_CONFIG_PATH
): Promise<{ config: OpenClawConfig; validation: ValidationResult }> {
  const original = await readOpenClawConfig(path);
  const validation = validateBeforeSave(nextSlice.providers, nextSlice.defaultModels, nextSlice.primary, {
    ignoredProviderIds: getOAuthProviderIds(original)
  });

  if (!validation.ok) {
    return { config: original, validation };
  }

  const nextConfig = saveModelAccessConfig(
    original,
    nextSlice.providers,
    nextSlice.defaultModels,
    nextSlice.primary
  );

  await writeOpenClawConfig(nextConfig, path);

  return { config: nextConfig, validation };
}
