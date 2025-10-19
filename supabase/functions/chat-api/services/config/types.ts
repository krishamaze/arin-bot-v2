/**
 * Type definitions for configuration files
 */

export interface PromptsConfig {
  version: string;
  updated: string;
  system_instructions: {
    cached: boolean;
    content: string;
  };
}

export interface ModelConfig {
  model: string;
  temperature: number;
  max_completion_tokens: number;
  presence_penalty: number;
  frequency_penalty: number;
  description?: string;
}

export interface ModelsConfig {
  version: string;
  updated: string;
  production: ModelConfig;
  experimental: ModelConfig;
  features: {
    enable_ab_testing: boolean;
    ab_test_percentage: number;
    enable_metrics_logging: boolean;
    enable_prompt_caching: boolean;
  };
}
