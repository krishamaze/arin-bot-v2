/**
 * Unified interface for different LLM providers
 */

export interface LLMResponse {
  strategy: string;
  messages: Array<{
    text: string;
    delayMs: number;
  }>;
}

export interface LLMProvider {
  generate(systemPrompt: string, userPrompt: string, config: any): Promise<LLMResponse>;
}

export interface LLMConfig {
  provider: string;
  model: string;
  temperature: number;
  max_completion_tokens?: number;
  max_output_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}
