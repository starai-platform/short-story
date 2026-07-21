import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const constructor = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create } };
    constructor(options: unknown) { constructor(options); }
  },
}));

describe("OpenAI-compatible adapter", () => {
  beforeEach(() => {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "test-model";
    process.env.LLM_BASE_URL = "https://example.test/v1";
    delete process.env.LLM_OUTLINE_MAX_OUTPUT_TOKENS;
    create.mockResolvedValue((async function* () {
      yield { choices: [{ delta: { content: "第一段" } }], usage: null };
      yield { choices: [{ delta: { content: "第二段" } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } };
    })());
  });

  it("makes one request, streams deltas and disables SDK retries", async () => {
    const { streamStory } = await import("@/lib/llm");
    const events = [];
    for await (const event of streamStory("system", "user", new AbortController().signal)) events.push(event);
    expect(create).toHaveBeenCalledTimes(1);
    expect(constructor).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, baseURL: "https://example.test/v1" }));
    expect(events).toEqual([
      { type: "model", model: expect.objectContaining({ id: null, model: "test-model", inputPricePerMillion: 0 }) },
      { type: "delta", text: "第一段" },
      { type: "delta", text: "第二段" },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 20, reasoningTokens: undefined, totalTokens: 30 } },
    ]);
  });

  it("makes one non-streaming request with a JSON Schema response format", async () => {
    create.mockResolvedValueOnce({
      choices: [{ finish_reason: "stop", message: { content: '{"title":"雨城"}' } }],
      usage: { prompt_tokens: 8, completion_tokens: 6, total_tokens: 14 },
    });
    const { completeText } = await import("@/lib/llm");
    const responseFormat = {
      type: "json_schema" as const,
      json_schema: { name: "outline", strict: true, schema: { type: "object" } },
    };
    const result = await completeText("system", "user", new AbortController().signal, responseFormat);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ response_format: responseFormat }), expect.anything());
    expect(result.text).toBe('{"title":"雨城"}');
  });

  it("reports truncated non-streaming output before JSON parsing", async () => {
    create.mockResolvedValueOnce({
      choices: [{ finish_reason: "length", message: { content: "{" } }],
      usage: { prompt_tokens: 100, completion_tokens: 32768, total_tokens: 32868, completion_tokens_details: { reasoning_tokens: 1200 } },
    });
    const { classifyProviderError, completeText } = await import("@/lib/llm");
    try {
      await completeText("system", "user", new AbortController().signal, undefined, 32768);
      throw new Error("expected completeText to fail");
    } catch (error) {
      const failure = classifyProviderError(error);
      expect(failure.code).toBe("PROVIDER_OUTPUT_TRUNCATED");
      expect(failure.diagnostic).toEqual(expect.objectContaining({ maxOutputTokens: 32768, outputTokens: 32768, reasoningTokens: 1200 }));
    }
  });

  it("uses a separate larger output budget for outlines", async () => {
    process.env.LLM_OUTLINE_MAX_OUTPUT_TOKENS = "32768";
    create.mockResolvedValueOnce({
      choices: [{ finish_reason: "stop", message: { content: '{"title":"outline"}' } }],
      usage: { prompt_tokens: 8, completion_tokens: 6, total_tokens: 14 },
    });
    const { completeText, outlineMaxOutputTokens } = await import("@/lib/llm");
    await completeText("system", "user", new AbortController().signal, undefined, outlineMaxOutputTokens());
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 32768 }), expect.anything());
  });
  it("sizes outline output budget by chapter count under the configured ceiling", async () => {
    process.env.LLM_OUTLINE_MAX_OUTPUT_TOKENS = "32768";
    const { outlineMaxOutputTokens } = await import("@/lib/llm");
    expect(outlineMaxOutputTokens(10)).toBe(7600);
    expect(outlineMaxOutputTokens(20)).toBe(10200);
    expect(outlineMaxOutputTokens(50)).toBe(18000);
  });
});
