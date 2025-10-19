import type { LLMProvider, LLMConfig } from './interface.ts';
import { OpenAIClient } from './openaiClient.ts';
import { GeminiClient } from './geminiClient.ts';

export class LLMFactory {
  private openaiKey: string;
  private geminiKey: string;
  private responseSchema: any;

  constructor(openaiKey: string, geminiKey: string, responseSchema: any) {
    this.openaiKey = openaiKey;
    this.geminiKey = geminiKey;
    this.responseSchema = responseSchema;
  }

  createProvider(config: LLMConfig): LLMProvider {
    if (config.provider === 'gemini') {
      return new GeminiClient(this.geminiKey);
    } else {
      return new OpenAIClient(this.openaiKey, this.responseSchema);
    }
  }

  async generateWithFallback(
    systemPrompt: string,
    userPrompt: string,
    primaryConfig: LLMConfig,
    fallbackConfig: LLMConfig
  ) {
    const primaryProvider = this.createProvider(primaryConfig);
    
    try {
      return await primaryProvider.generate(systemPrompt, userPrompt, primaryConfig);
    } catch (error) {
      console.error('[LLM] Primary provider failed:', error.message);
      console.log('[LLM] Falling back to:', fallbackConfig.provider);
      
      const fallbackProvider = this.createProvider(fallbackConfig);
      return await fallbackProvider.generate(systemPrompt, userPrompt, fallbackConfig);
    }
  }
}
