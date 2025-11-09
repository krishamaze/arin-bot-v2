import type { LLMProvider, LLMConfig } from './interface.ts';
import { OpenAIClient } from './openaiClient.ts';
import { GeminiClient } from './geminiClient.ts';

export class LLMFactory {
  private openaiKey: string;
  private geminiKey: string;
  private responseSchema: any;
  private geminiClient: GeminiClient | null = null;

  constructor(openaiKey: string, geminiKey: string, responseSchema: any) {
    this.openaiKey = openaiKey;
    this.geminiKey = geminiKey;
    this.responseSchema = responseSchema;
  }

  createProvider(config: LLMConfig): LLMProvider {
    if (config.provider === 'gemini') {
      if (!this.geminiClient) {
        this.geminiClient = new GeminiClient(this.geminiKey);
      }
      return this.geminiClient;
    } else {
      return new OpenAIClient(this.openaiKey, this.responseSchema);
    }
  }

  /**
   * Get Gemini client instance for cache operations
   */
  getGeminiClient(): GeminiClient | null {
    if (!this.geminiClient && this.geminiKey) {
      this.geminiClient = new GeminiClient(this.geminiKey);
    }
    return this.geminiClient;
  }

  async generateWithFallback(
    systemPrompt: string,
    userPrompt: string,
    primaryConfig: LLMConfig,
    fallbackConfig: LLMConfig,
    cachedContent?: string
  ) {
    const primaryProvider = this.createProvider(primaryConfig);
    
    try {
      return await primaryProvider.generate(systemPrompt, userPrompt, primaryConfig, cachedContent);
    } catch (error) {
      console.error('[LLM] Primary provider failed:', error.message);
      console.log('[LLM] Falling back to:', fallbackConfig.provider);
      
      const fallbackProvider = this.createProvider(fallbackConfig);
      // Don't use cache for fallback
      return await fallbackProvider.generate(systemPrompt, userPrompt, fallbackConfig);
    }
  }
}
