import { z } from "zod";

export const costSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number()
});

export const modelSchema = z.object({
  id: z.string().min(1, "model.id 不能为空").refine((value) => !value.includes("/"), {
    message: "model.id 不建议包含 '/'"
  }),
  name: z.string().min(1, "model.name 不能为空"),
  reasoning: z.boolean().optional(),
  input: z.array(z.string()).min(1, "model.input 必须是非空数组"),
  cost: costSchema.optional(),
  contextWindow: z.number({ invalid_type_error: "model.contextWindow 必须是数字" }),
  maxTokens: z.number({ invalid_type_error: "model.maxTokens 必须是数字" }),
  compat: z.record(z.unknown()).optional(),
  api: z.string().optional()
});

export const providerSchema = z.object({
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  api: z.string().optional(),
  authHeader: z.boolean().optional(),
  models: z.array(modelSchema)
});

export const providersSchema = z
  .record(providerSchema)
  .superRefine((providers, ctx) => {
    for (const [providerId, provider] of Object.entries(providers)) {
      if (!providerId.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "providerId 不能为空",
          path: [providerId]
        });
      }

      if (providerId.includes("/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "providerId 不允许包含 '/'",
          path: [providerId]
        });
      }

      const modelIds = new Set<string>();
      for (const model of provider.models) {
        if (modelIds.has(model.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `provider '${providerId}' 内 model.id 重复: ${model.id}`,
            path: [providerId, "models"]
          });
        }
        modelIds.add(model.id);
      }
    }
  });

export type Cost = z.infer<typeof costSchema>;
export type ModelConfig = z.infer<typeof modelSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;
export type ProvidersConfig = z.infer<typeof providersSchema>;

export type DefaultModels = Record<string, Record<string, never>>;

export interface AuthProfile {
  provider?: string;
  mode?: string;
  email?: string;
  [key: string]: unknown;
}

export interface OpenClawConfig {
  auth?: {
    profiles?: Record<string, AuthProfile>;
    [key: string]: unknown;
  };
  models?: {
    providers?: ProvidersConfig;
    [key: string]: unknown;
  };
  agents?: {
    defaults?: {
      models?: DefaultModels;
      model?: {
        primary?: string;
        fallbacks?: string[];
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
