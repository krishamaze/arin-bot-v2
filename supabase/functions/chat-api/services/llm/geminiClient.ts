import type { LLMProvider, LLMResponse, LLMConfig } from './interface.ts';
import { GoogleGenerativeAI } from '@google/genai';

// Cache store in globalThis for stateless function persistence
if (!globalThis.cacheStore) {
  globalThis.cacheStore = new Map<string, { name: string, expiresAt: number }>();
}

interface CacheInfo {
  name: string;
  expiresAt: number;
}

export class GeminiClient implements LLMProvider {
  private apiKey: string;
  private ai: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Create a new cache with system instruction and placeholder content
   */
  private async createCache(
    systemPrompt: string,
    cacheableContent: string,
    model: string,
    ttl: number
  ): Promise<string> {
    const timestamp = Date.now();
    const cacheName = `dating_bot_v${timestamp}`;
    
    try {
      console.log('[GEMINI] Creating cache:', cacheName, 'for model:', model);
      
      // Use minimal placeholder if content is empty (API may require at least some content)
      const contentToCache = cacheableContent || ' '; // Single space as minimal placeholder
      
      const cache = await this.ai.caches.create({
        model: model,
        config: {
          contents: [{
            role: 'user',
            parts: [{ text: contentToCache }]
          }],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          ttl: `${ttl}s`
        },
        displayName: cacheName
      });

      console.log('[GEMINI] Cache created:', cache.name);
      return cache.name;
    } catch (error) {
      console.error('[GEMINI] Failed to create cache:', error.message);
      throw error;
    }
  }

  /**
   * Get or create a cache for the given model and prompt version
   */
  private async getOrCreateCache(
    systemPrompt: string,
    cacheableContent: string,
    model: string,
    promptVersion: string,
    ttl: number
  ): Promise<string | null> {
    // Only attempt caching for Gemini models
    if (!model.startsWith('models/gemini-')) {
      return null;
    }

    const cacheKey = this.getCacheKey(model, promptVersion);
    const cached = globalThis.cacheStore.get(cacheKey);

    // Check if we have a valid cached reference
    if (cached && cached.expiresAt > Date.now()) {
      try {
        // Verify cache still exists by attempting to list it
        const caches = await this.ai.caches.list({ model });
        const exists = caches.cachedContents?.some(c => c.name === cached.name);
        
        if (exists) {
          console.log('[GEMINI] Using existing cache:', cached.name);
          return cached.name;
        } else {
          console.log('[GEMINI] Cache not found, will recreate');
          globalThis.cacheStore.delete(cacheKey);
        }
      } catch (error) {
        console.warn('[GEMINI] Error checking cache existence:', error.message);
        globalThis.cacheStore.delete(cacheKey);
      }
    }

    // Cache expired or doesn't exist, create new one
    try {
      const cacheName = await this.createCache(systemPrompt, cacheableContent, model, ttl);
      // Store with the cache key that includes prompt version
      const expiresAt = Date.now() + (ttl * 1000);
      globalThis.cacheStore.set(cacheKey, { name: cacheName, expiresAt });
      return cacheName;
    } catch (error) {
      console.error('[GEMINI] Failed to get or create cache:', error.message);
      return null; // Return null to fall back to non-cached request
    }
  }

  /**
   * Get cache key for storage
   */
  private getCacheKey(model: string, promptVersion?: string): string {
    // Extract model name without 'models/' prefix for key
    const modelName = model.replace('models/', '');
    // Include prompt version in key if provided (for cache invalidation on prompt changes)
    return promptVersion ? `${modelName}_${promptVersion}` : modelName;
  }

  /**
   * Generate content with optional cache
   */
  async generate(
    systemPrompt: string,
    userPrompt: string,
    config: LLMConfig,
    cachedContent?: string
  ): Promise<LLMResponse> {
    console.log('[GEMINI] Calling', config.model, 'temp:', config.temperature, 'cached:', !!cachedContent);

    try {
      const model = this.ai.models.get(config.model);
      
      const generationConfig: any = {
        temperature: config.temperature,
        maxOutputTokens: config.max_output_tokens || 120,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            strategy: {
              type: 'string',
              enum: ['ENGAGE', 'OBSERVE']
            },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  delayMs: {
                    type: 'number',
                    minimum: 500,
                    maximum: 3000
                  }
                },
                required: ['text', 'delayMs']
              }
            }
          },
          required: ['strategy', 'messages']
        },
        // Disable thinking feature to prevent timeouts in serverless
        thinkingBudget: 0
      };

      // Prepare request
      const request: any = {
        contents: [{
          role: 'user',
          parts: [{ text: userPrompt }]
        }],
        generationConfig
      };

      // Use cache if provided (system instruction comes from cache)
      if (cachedContent) {
        request.cachedContent = cachedContent;
        console.log('[GEMINI] Using cached content (system instruction from cache):', cachedContent);
      } else {
        // Only send system instruction if not using cache
        request.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }

      const response = await model.generateContent(request);

      // Extract usage metadata
      const usageMetadata = response.response.usageMetadata;
      if (usageMetadata) {
        const cachedTokens = usageMetadata.cachedContentTokenCount || 0;
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || 0;
        
        if (cachedTokens > 0) {
          console.log('[GEMINI] Cache HIT - Cached tokens:', cachedTokens, 'Total prompt tokens:', promptTokens);
        } else if (cachedContent) {
          console.log('[GEMINI] Cache MISS - Prompt tokens:', promptTokens);
        }
        console.log('[GEMINI] Total tokens:', totalTokens);
      }

      // Parse response
      const text = response.response.text();
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      const parsed = JSON.parse(text);
      console.log('[GEMINI] Response strategy:', parsed.strategy);

      return {
        strategy: parsed.strategy,
        messages: parsed.messages
      };
    } catch (error) {
      // Handle cache-related errors
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        console.warn('[GEMINI] Cache expired or not found, retrying without cache');
        // Retry without cache
        if (cachedContent) {
          return this.generate(systemPrompt, userPrompt, config);
        }
      }
      throw new Error('Gemini API error: ' + error.message);
    }
  }

  /**
   * Public method to get or create cache (called from factory)
   */
  async getOrCreateCacheForPrompt(
    systemPrompt: string,
    cacheableContent: string,
    model: string,
    promptVersion: string,
    ttl: number
  ): Promise<string | null> {
    return this.getOrCreateCache(systemPrompt, cacheableContent, model, promptVersion, ttl);
  }
}
