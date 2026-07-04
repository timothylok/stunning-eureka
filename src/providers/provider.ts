import type { EvaluationPrompt } from "../types.js";

export interface ProviderResponse {
  text: string;
  token_usage?: { prompt: number; completion: number };
}

export interface ModelProvider {
  evaluate(prompt: EvaluationPrompt): Promise<ProviderResponse>;
}
