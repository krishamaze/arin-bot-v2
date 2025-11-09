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
  max_completion_tokens?: number;
  max_output_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  description?: string;
  enableCaching?: boolean;
  cacheTtl?: number;
}

export interface ModelsConfig {
  version: string;
  updated: string;
  production: ModelConfig;
  experimental?: ModelConfig;
  gemini_production?: ModelConfig;
  gemini_pro?: ModelConfig;
  features: {
    enable_ab_testing: boolean;
    ab_test_percentage: number;
    enable_metrics_logging: boolean;
    enable_prompt_caching: boolean;
    cache_ttl?: number;
    fallback_provider?: string;
  };
}
