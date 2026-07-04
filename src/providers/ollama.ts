import type { ModelConfig } from "../types.js";
import type { ModelProvider, ProviderResponse } from "./provider.js";

// OLLAMA_HOST may be set without a scheme (e.g. "127.0.0.1:11434"), as Ollama itself allows.
const rawHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_HOST = /^https?:\/\//.test(rawHost) ? rawHost : `http://${rawHost}`;

interface OllamaChatResponse {
  message: { content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export function createOllamaProvider(config: ModelConfig): ModelProvider {
  return {
    async evaluate(prompt): Promise<ProviderResponse> {
      const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model_name,
          stream: false,
          format: "json",
          options: { temperature: config.temperature ?? 0.2 },
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`Ollama request failed (${res.status}): ${await res.text()}`);
      }
      const data = (await res.json()) as OllamaChatResponse;
      return {
        text: data.message.content,
        token_usage: {
          prompt: data.prompt_eval_count ?? 0,
          completion: data.eval_count ?? 0,
        },
      };
    },
  };
}
