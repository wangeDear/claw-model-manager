import { providersSchema, type DefaultModels, type OpenClawConfig, type ProvidersConfig } from "./types.js";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function parseModelRef(modelRef: string): { providerId: string; modelId: string } | null {
  const parts = modelRef.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { providerId: parts[0], modelId: parts[1] };
}

export function maskApiKey(apiKey?: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "*".repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}${"*".repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
}

export function modelExists(providers: ProvidersConfig, modelRef: string): boolean {
  const parsed = parseModelRef(modelRef);
  if (!parsed) return false;

  const provider = providers[parsed.providerId];
  if (!provider) return false;

  return provider.models.some((model) => model.id === parsed.modelId);
}

export function validateDefaultModels(providers: ProvidersConfig, defaults: DefaultModels): ValidationResult {
  const errors: string[] = [];
  for (const modelRef of Object.keys(defaults)) {
    const parsed = parseModelRef(modelRef);
    if (!parsed) {
      errors.push(`默认模型引用格式非法: ${modelRef}`);
      continue;
    }

    if (!modelExists(providers, modelRef)) {
      errors.push(`默认模型引用不存在: ${modelRef}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validatePrimaryModel(
  providers: ProvidersConfig,
  defaults: DefaultModels,
  primary: string
): ValidationResult {
  const errors: string[] = [];
  const parsed = parseModelRef(primary);
  if (!parsed) {
    errors.push(`主模型引用格式非法: ${primary}`);
    return { ok: false, errors };
  }

  if (!modelExists(providers, primary)) {
    errors.push(`主模型不存在: ${primary}`);
  }

  if (!defaults[primary]) {
    errors.push(`主模型不在默认模型列表中: ${primary}`);
  }

  return { ok: errors.length === 0, errors };
}

export function validateBeforeSave(
  providers: ProvidersConfig,
  defaults: DefaultModels,
  primary: string
): ValidationResult {
  const providerValidation = providersSchema.safeParse(providers);
  const errors: string[] = [];

  if (!providerValidation.success) {
    for (const issue of providerValidation.error.issues) {
      errors.push(issue.message);
    }
  }

  errors.push(...validateDefaultModels(providers, defaults).errors);
  errors.push(...validatePrimaryModel(providers, defaults, primary).errors);

  return { ok: errors.length === 0, errors };
}

export function saveModelAccessConfig(
  originalConfig: OpenClawConfig,
  nextProviders: ProvidersConfig,
  nextDefaultModels: DefaultModels,
  nextPrimaryModel: string
): OpenClawConfig {
  const nextConfig = structuredClone(originalConfig);

  if (!nextConfig.models) nextConfig.models = {};
  if (!nextConfig.agents) nextConfig.agents = {};
  if (!nextConfig.agents.defaults) nextConfig.agents.defaults = {};
  if (!nextConfig.agents.defaults.model) {
    nextConfig.agents.defaults.model = { fallbacks: [] };
  }

  nextConfig.models.providers = nextProviders;
  nextConfig.agents.defaults.models = nextDefaultModels;
  nextConfig.agents.defaults.model.primary = nextPrimaryModel;

  return nextConfig;
}

export function setPrimaryModel(
  providers: ProvidersConfig,
  defaults: DefaultModels,
  modelRef: string
): { nextDefaults: DefaultModels; nextPrimary: string } {
  if (!modelExists(providers, modelRef)) {
    throw new Error(`无法设置主模型，模型不存在: ${modelRef}`);
  }

  return {
    nextDefaults: {
      ...defaults,
      [modelRef]: defaults[modelRef] ?? {}
    },
    nextPrimary: modelRef
  };
}

export function canDeleteProvider(
  providerId: string,
  providerModelIds: string[],
  defaults: DefaultModels,
  primary: string
): ValidationResult {
  const errors: string[] = [];

  for (const modelId of providerModelIds) {
    const modelRef = `${providerId}/${modelId}`;
    if (defaults[modelRef]) {
      errors.push(`Provider 下模型仍被默认模型引用: ${modelRef}`);
    }
    if (primary === modelRef) {
      errors.push(`Provider 下模型是当前主模型: ${modelRef}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function canDeleteModel(
  modelRef: string,
  defaults: DefaultModels,
  primary: string
): ValidationResult {
  const errors: string[] = [];

  if (defaults[modelRef]) {
    errors.push(`模型仍在默认模型列表中: ${modelRef}`);
  }

  if (modelRef === primary) {
    errors.push(`模型是当前主模型，禁止删除: ${modelRef}`);
  }

  return { ok: errors.length === 0, errors };
}
