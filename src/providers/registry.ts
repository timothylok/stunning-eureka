import type { ModelConfig } from "../types.js";
import type { ModelProvider } from "./provider.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOllamaProvider } from "./ollama.js";
import { createOpenAIProvider } from "./openai.js";

export function createProvider(config: ModelConfig): ModelProvider {
  switch (config.type) {
    case "local":
      return createOllamaProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    case "openai":
      return createOpenAIProvider(config);
    case "google":
      throw new Error(
        `Provider "google" is not configured yet — local (Ollama), anthropic, and openai-compatible are wired up.`,
      );
  }
}
