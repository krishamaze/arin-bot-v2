import type { LLMProvider, LLMResponse, LLMConfig } from './interface.ts';
import { OpenAIClient } from './openaiClient.ts';
import { GeminiClient } from './geminiClient.ts';

// Phase 3.3: Statistics tracking
interface LLMStats {
  primary: number;
  fallbacks: number;
  failures: number;
  lastReset: number;
}

if (!globalThis.llmStats) {
  globalThis.llmStats = {
    primary: 0,
    fallbacks: 0,
    failures: 0,
    lastReset: Date.now()
  };
}

// Phase 3.2: Error detection specificity
function shouldFallback(error: any, statusCode?: number): boolean {
  const code = statusCode || error?.statusCode || error?.response?.status;
  
  // Retryable errors: Don't fallback, retry same model
  const retryableErrors = [429, 503, 500, 502, 504]; // Rate limit, server errors
  if (code && retryableErrors.includes(code)) {
    console.log('[LLM] Retryable error detected:', code, '- will retry same model');
    return false; // Don't fallback, retry same model
  }
  
  // Fatal errors: Skip retries, fallback immediately
  const fatalErrors = [401, 403, 400]; // Bad API key, quota exhausted, bad request
  if (code && fatalErrors.includes(code)) {
    console.log('[LLM] Fatal error detected:', code, '- will fallback immediately');
    return true; // Skip retries, fallback to next model
  }
  
  // Unknown errors: Fallback (default behavior)
  return true;
}

export class LLMFactory {
  private openaiKey: string;
  private geminiKey: string;
  private responseSchema: any;
  private geminiClient: GeminiClient | null = null;
  private defaultProvider: string;

  constructor(openaiKey: string, geminiKey: string, responseSchema: any) {
    this.openaiKey = openaiKey;
    this.geminiKey = geminiKey;
    this.responseSchema = responseSchema;
    // Phase 4.2: Check DEFAULT_LLM_PROVIDER env var
    this.defaultProvider = Deno.env.get('DEFAULT_LLM_PROVIDER') || 'gemini';
  }

  createProvider(config: LLMConfig): LLMProvider {
    if (config.provider === 'gemini') {
      if (!this.geminiClient) {
        this.geminiClient = new GeminiClient(this.geminiKey);
      }
      return this.geminiClient;
    } else {
      // Phase 4.2: Skip OpenAI if DEFAULT_LLM_PROVIDER=gemini
      if (this.defaultProvider === 'gemini') {
        console.warn('[LLM] OpenAI requested but DEFAULT_LLM_PROVIDER=gemini. Using Gemini instead.');
        if (!this.geminiClient) {
          this.geminiClient = new GeminiClient(this.geminiKey);
        }
        return this.geminiClient;
      }
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

  // Phase 3.1: Update generateWithFallback with retry logic and exponential backoff
  async generateWithFallback(
    systemPrompt: string,
    userPrompt: string,
    primaryConfig: LLMConfig,
    fallbackConfig: LLMConfig,
    cachedContent?: string,
    fallbackChain?: LLMConfig[],
    maxRetries: number = 3
  ): Promise<LLMResponse> {
    // Build list of models to try: primary + fallback + fallbackChain
    const allModels: LLMConfig[] = [primaryConfig];
    if (fallbackConfig && fallbackConfig.provider === 'gemini') {
      allModels.push(fallbackConfig);
    }
    if (fallbackChain) {
      allModels.push(...fallbackChain.filter(c => c.provider === 'gemini'));
    }
    
    // Phase 4.2: Remove OpenAI from chain if DEFAULT_LLM_PROVIDER=gemini
    const modelsToTry = this.defaultProvider === 'gemini'
      ? allModels.filter(c => c.provider === 'gemini')
      : allModels;
    
    console.log('[LLM] Models to try:', modelsToTry.map(m => `${m.provider}:${m.model}`).join(', '));
    
    // Try each model with retries
    for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
      const modelConfig = modelsToTry[modelIndex];
      const isPrimary = modelIndex === 0;
      const provider = this.createProvider(modelConfig);
      
      console.log(`[LLM] Attempting ${isPrimary ? 'primary' : 'fallback'} model: ${modelConfig.provider}:${modelConfig.model}`);
      
      // Retry loop for this model
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`[LLM] Attempt ${attempt + 1}/${maxRetries} for ${modelConfig.model}`);
          
          // Phase 5.2: Chaos testing - simulate failures
          const chaosMode = Deno.env.get('CHAOS_MODE') === 'true';
          if (chaosMode && Math.random() < 0.3 && attempt < maxRetries - 1) {
            console.warn('[LLM] CHAOS MODE: Simulating failure');
            throw new Error('Simulated failure for chaos testing');
          }
          
          // Use cache only for primary model and first attempt
          const useCache = isPrimary && attempt === 0 ? cachedContent : undefined;
          
          const response = await provider.generate(systemPrompt, userPrompt, modelConfig, useCache);
          
          // Success!
          if (isPrimary) {
            globalThis.llmStats.primary++;
          } else {
            globalThis.llmStats.fallbacks++;
          }
          
          // Phase 3.3: Log statistics every 100 requests
          const totalRequests = globalThis.llmStats.primary + globalThis.llmStats.fallbacks + globalThis.llmStats.failures;
          if (totalRequests % 100 === 0) {
            console.log('[LLM] Statistics:', {
              primary: globalThis.llmStats.primary,
              fallbacks: globalThis.llmStats.fallbacks,
              failures: globalThis.llmStats.failures,
              total: totalRequests
            });
          }
          
          console.log(`[LLM] Success with ${modelConfig.model} (attempt ${attempt + 1})`);
          return response;
          
        } catch (error: any) {
          const statusCode = error?.statusCode || error?.response?.status;
          console.error(`[LLM] ${modelConfig.model} failed (attempt ${attempt + 1}/${maxRetries}):`, {
            message: error?.message,
            statusCode: statusCode
          });
          
          // Phase 3.2: Check if we should fallback or retry
          const shouldFallbackNow = shouldFallback(error, statusCode);
          
          if (!shouldFallbackNow && attempt < maxRetries - 1) {
            // Retry same model with exponential backoff
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.log(`[LLM] Retrying ${modelConfig.model} after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry same model
          }
          
          // Last attempt on this model failed, or fatal error
          if (attempt === maxRetries - 1) {
            console.log(`[LLM] All retries exhausted for ${modelConfig.model}, moving to next model`);
          } else {
            console.log(`[LLM] Fatal error for ${modelConfig.model}, moving to next model`);
          }
          
          // Break inner loop to try next model
          break;
        }
      }
    }
    
    // All models exhausted - log detailed error information
    globalThis.llmStats.failures++;
    const errorMessage = `All Gemini models failed after retries. Tried ${modelsToTry.length} models: ${modelsToTry.map(m => m.model).join(', ')}`;
    console.error('[LLM] All models exhausted:', {
      primary: globalThis.llmStats.primary,
      fallbacks: globalThis.llmStats.fallbacks,
      failures: globalThis.llmStats.failures,
      modelsTried: modelsToTry.map(m => `${m.provider}:${m.model}`),
      defaultProvider: this.defaultProvider,
      geminiKeyExists: !!this.geminiKey
    });
    const error = new Error(errorMessage);
    throw error;
  }
}
