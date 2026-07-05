export interface RepoFile {
  rel: string;
  size: number;
}

export interface Target {
  name: string;
  description: string;
  evidence: string[];
}

export interface RubricCriterion {
  id: string;
  description: string;
  weight?: number;
}

export interface Rubric {
  name: string;
  scale: { min: number; max: number };
  criteria: RubricCriterion[];
}

export type ProviderType = "anthropic" | "openai" | "google" | "local";

export interface ModelConfig {
  type: ProviderType;
  model_name: string;
  temperature?: number;
  enabled: boolean;
  base_url?: string;
  api_key_env?: string;
}

export interface ModelsFile {
  default: string;
  models: Record<string, ModelConfig>;
}

export interface EvaluationPrompt {
  system: string;
  user: string;
}

export interface EvaluationResult {
  scores: Record<string, number>;
  overall_rating: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  risk_flags: string[];
}

export interface EvaluationRun {
  target: string;
  rubric: string;
  scale?: { min: number; max: number };
  model_provider_id: string;
  model_name: string;
  started_at: string;
  latency_ms: number;
  token_usage?: { prompt: number; completion: number };
  result: EvaluationResult;
}
