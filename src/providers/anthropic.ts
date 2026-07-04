import type { ModelConfig } from "../types.js";
import type { ModelProvider, ProviderResponse } from "./provider.js";

const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

export function createAnthropicProvider(config: ModelConfig): ModelProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      `Anthropic provider requires the ANTHROPIC_API_KEY environment variable.`,
    );
  }
  return {
    async evaluate(prompt): Promise<ProviderResponse> {
      // temperature is intentionally not sent: current Claude models
      // (Opus 4.8/4.7, Sonnet 5) reject sampling parameters with a 400.
      const res = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model_name,
          max_tokens: 4096,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Anthropic request failed (${res.status}): ${await res.text()}`);
      }
      const data = (await res.json()) as AnthropicMessageResponse;
      if (data.stop_reason === "refusal") {
        throw new Error("Anthropic request was refused by safety classifiers.");
      }
      const textBlock = data.content.find((b) => b.type === "text");
      if (!textBlock?.text) {
        throw new Error(`Anthropic response contained no text (stop_reason: ${data.stop_reason}).`);
      }
      return {
        text: textBlock.text,
        token_usage: {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
        },
      };
    },
  };
}
