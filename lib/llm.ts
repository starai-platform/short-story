import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/model-secret";

export type LlmUsage = { inputTokens?: number; outputTokens?: number; reasoningTokens?: number; totalTokens?: number };
export type ResolvedModel = {
  id: string | null;
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  billingMultiplier: number;
};
export type LlmStreamEvent = { type: "delta"; text: string } | { type: "usage"; usage: LlmUsage } | { type: "model"; model: ResolvedModel };
export type StructuredResponseFormat = OpenAI.ResponseFormatJSONSchema;

export type SafeProviderFailure = {
  code: "PROVIDER_TIMEOUT" | "PROVIDER_AUTH_ERROR" | "PROVIDER_RATE_LIMIT" | "PROVIDER_REQUEST_REJECTED" | "PROVIDER_OUTPUT_TRUNCATED" | "PROVIDER_CONTENT_FILTERED" | "PROVIDER_ERROR";
  message: string;
  httpStatus: number;
  diagnostic: {
    errorName: string;
    providerStatus?: number;
    providerCode?: string;
    providerType?: string;
    requestId?: string;
    maxOutputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
  };
};

export class LlmOutputTruncatedError extends Error {
  constructor(
    public readonly maxTokens: number,
    public readonly usage: LlmUsage,
  ) {
    super("Provider output reached its token limit");
    this.name = "LlmOutputTruncatedError";
  }
}

export class LlmContentFilteredError extends Error {
  constructor() {
    super("Provider filtered the generated content");
    this.name = "LlmContentFilteredError";
  }
}

function maxOutputTokens() {
  const parsed = Number(process.env.LLM_MAX_OUTPUT_TOKENS || 16000);
  return Number.isInteger(parsed) && parsed >= 1000 ? parsed : 16000;
}

export function outlineMaxOutputTokens(chapterCount?: number) {
  const parsed = Number(process.env.LLM_OUTLINE_MAX_OUTPUT_TOKENS || 32768);
  const configuredLimit = Number.isInteger(parsed) && parsed >= 4000 ? parsed : 32768;
  if (!chapterCount) return configuredLimit;
  // Compact outlines need far fewer tokens than prose. A needlessly large
  // max_tokens can make smaller-context compatible APIs reject the request.
  const chapterSizedLimit = 5000 + Math.min(50, Math.max(10, chapterCount)) * 260;
  return Math.min(configuredLimit, chapterSizedLimit);
}

function responseUsage(usage: OpenAI.Completions.CompletionUsage | undefined): LlmUsage {
  return {
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
    totalTokens: usage?.total_tokens,
  };
}

function env(name: "LLM_API_KEY" | "LLM_MODEL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

export function getModelName() {
  return env("LLM_MODEL");
}

function environmentModel(): ResolvedModel {
  return {
    id: null,
    name: "环境变量模型",
    model: getModelName(),
    baseUrl: process.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1",
    apiKey: env("LLM_API_KEY"),
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
    billingMultiplier: 1,
  };
}

export async function resolveModelChain(): Promise<ResolvedModel[]> {
  const records = await prisma.aiModel.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { isFallback: "desc" }, { createdAt: "asc" }],
  });
  if (!records.length) return [environmentModel()];
  const primary = records.find((item) => item.isDefault) || records[0];
  const selected = [primary, ...records.filter((item) => item.id !== primary.id && item.isFallback)];
  return selected.map((item) => ({
    id: item.id,
    name: item.name,
    model: item.model,
    baseUrl: item.baseUrl,
    apiKey: decryptApiKey(item.apiKeyEncrypted),
    inputPricePerMillion: item.inputPricePerMillion.toNumber(),
    outputPricePerMillion: item.outputPricePerMillion.toNumber(),
    billingMultiplier: item.billingMultiplier.toNumber(),
  }));
}

export async function* streamStory(systemPrompt: string, userPrompt: string, signal: AbortSignal, configuredModels?: ResolvedModel[]): AsyncGenerator<LlmStreamEvent> {
  const models = configuredModels?.length ? configuredModels : [environmentModel()];
  let lastError: unknown;
  for (const selected of models) {
    let emitted = false;
    try {
      const client = new OpenAI({ apiKey: selected.apiKey, baseURL: selected.baseUrl, maxRetries: 0, timeout: 180_000 });
      const stream = await client.chat.completions.create(
        {
          model: selected.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: maxOutputTokens(),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      );
      yield { type: "model", model: selected };
      let finishReason: string | null | undefined;
      let lastUsage: LlmUsage | undefined;
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const text = choice?.delta?.content;
        if (text) { emitted = true; yield { type: "delta", text }; }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (chunk.usage) {
          lastUsage = responseUsage(chunk.usage);
          yield { type: "usage", usage: lastUsage };
        }
      }
      if (finishReason === "length") throw new LlmOutputTruncatedError(maxOutputTokens(), lastUsage || {});
      if (finishReason === "content_filter") throw new LlmContentFilteredError();
      return;
    } catch (error) {
      lastError = error;
      if (emitted || signal.aborted) throw error;
    }
  }
  throw lastError || new Error("NO_AVAILABLE_MODEL");
}

export async function completeText(
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
  responseFormat?: StructuredResponseFormat,
  outputTokenLimit = maxOutputTokens(),
  configuredModels?: ResolvedModel[],
) {
  const models = configuredModels?.length ? configuredModels : [environmentModel()];
  let lastError: unknown;
  for (const selected of models) {
    try {
      const client = new OpenAI({ apiKey: selected.apiKey, baseURL: selected.baseUrl, maxRetries: 0, timeout: 180_000 });
      const response = await client.chat.completions.create(
    {
      model: selected.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: outputTokenLimit,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    },
    { signal },
      );
      const choice = response.choices[0];
      const usage = responseUsage(response.usage);
      if (choice?.finish_reason === "length") throw new LlmOutputTruncatedError(outputTokenLimit, usage);
      if (choice?.finish_reason === "content_filter") throw new LlmContentFilteredError();
      const content = choice?.message?.content;
      if (!content) throw new Error("EMPTY_PROVIDER_OUTPUT");
      return { text: content, usage, model: selected };
    } catch (error) {
      if (error instanceof LlmOutputTruncatedError || error instanceof LlmContentFilteredError || signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error("NO_AVAILABLE_MODEL");
}

export function classifyProviderError(error: unknown, timedOut = false): SafeProviderFailure {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  if (error instanceof LlmOutputTruncatedError) {
    return {
      code: "PROVIDER_OUTPUT_TRUNCATED",
      message: `模型未能在 ${error.maxTokens.toLocaleString("zh-CN")} Token 的输出额度内完成，请重试；若反复出现，请联系管理员检查模型输出策略`,
      httpStatus: 422,
      diagnostic: {
        errorName,
        maxOutputTokens: error.maxTokens,
        ...(error.usage.outputTokens ? { outputTokens: error.usage.outputTokens } : {}),
        ...(error.usage.reasoningTokens ? { reasoningTokens: error.usage.reasoningTokens } : {}),
      },
    };
  }
  if (error instanceof LlmContentFilteredError) {
    return {
      code: "PROVIDER_CONTENT_FILTERED",
      message: "内容被模型服务的内容安全策略拦截，请调整题材描述后重试",
      httpStatus: 422,
      diagnostic: { errorName },
    };
  }
  if (timedOut || error instanceof OpenAI.APIConnectionTimeoutError) {
    return {
      code: "PROVIDER_TIMEOUT",
      message: "模型服务响应超时，请稍后重试",
      httpStatus: 504,
      diagnostic: { errorName },
    };
  }

  if (error instanceof OpenAI.APIError) {
    const diagnostic = {
      errorName,
      ...(typeof error.status === "number" ? { providerStatus: error.status } : {}),
      ...(error.code ? { providerCode: error.code } : {}),
      ...(error.type ? { providerType: error.type } : {}),
      ...(error.request_id ? { requestId: error.request_id } : {}),
    };
    if (error.status === 401 || error.status === 403) {
      return { code: "PROVIDER_AUTH_ERROR", message: "模型服务鉴权失败，请联系管理员检查 API Key", httpStatus: 502, diagnostic };
    }
    if (error.status === 429) {
      return { code: "PROVIDER_RATE_LIMIT", message: "模型服务当前繁忙或额度不足，请稍后重试", httpStatus: 503, diagnostic };
    }
    if (error.status === 400 || error.status === 404 || error.status === 422) {
      return {
        code: "PROVIDER_REQUEST_REJECTED",
        message: "模型服务拒绝了结构化大纲请求，请检查当前模型是否支持 JSON Schema 输出",
        httpStatus: 502,
        diagnostic,
      };
    }
    return { code: "PROVIDER_ERROR", message: "模型服务暂时不可用，请稍后重试", httpStatus: 502, diagnostic };
  }

  return {
    code: "PROVIDER_ERROR",
    message: "模型服务返回异常，请稍后重试",
    httpStatus: 502,
    diagnostic: { errorName },
  };
}
