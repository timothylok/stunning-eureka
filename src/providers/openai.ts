import type { ModelConfig } from "../types.js";
import type { ModelProvider, ProviderResponse } from "./provider.js";

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// OpenAI-compatible chat completions — covers OpenAI itself and compatible
// hosts like Agnes AI (https://apihub.agnes-ai.com/v1) via base_url/api_key_env.
export function createOpenAIProvider(config: ModelConfig): ModelProvider {
  const baseUrl = config.base_url ?? "https://api.openai.com/v1";
  const keyEnv = config.api_key_env ?? "OPENAI_API_KEY";
  const apiKey = process.env[keyEnv];
  if (!apiKey) {
    throw new Error(`This provider requires the ${keyEnv} environment variable (set it in .env).`);
  }
  return {
    async evaluate(prompt): Promise<ProviderResponse> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model_name,
          temperature: config.temperature ?? 0.2,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`Chat completions request failed (${res.status}): ${await res.text()}`);
      }
      const data = (await res.json()) as ChatCompletionResponse;
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`Chat completions response contained no message content.`);
      }
      return {
        text,
        token_usage: data.usage
          ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
          : undefined,
      };
    },
  };
}
