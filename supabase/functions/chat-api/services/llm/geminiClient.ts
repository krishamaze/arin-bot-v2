import type { LLMProvider, LLMResponse, LLMConfig } from './interface.ts';

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
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
      
      // Use REST API for cache creation
      // Ensure model name has 'models/' prefix for cache creation endpoint
      const cacheModelName = model.startsWith('models/') ? model : `models/${model}`;
      console.log('[GEMINI] Cache creation - model:', cacheModelName);
      
      const cacheResponse = await fetch(`${this.baseUrl}/cachedContents?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cacheModelName,
          contents: [{
            role: 'user',
            parts: [{ text: contentToCache }]
          }],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          ttl: `${ttl}s`,
          displayName: cacheName
        })
      });

      if (!cacheResponse.ok) {
        const errorText = await cacheResponse.text();
        throw new Error(`Cache creation failed: ${cacheResponse.status} ${errorText}`);
      }

      const cache = await cacheResponse.json();
      console.log('[GEMINI] Cache created:', cache.name);
      return cache.name;
    } catch (error: any) {
      console.error('[GEMINI] Failed to create cache:', error?.message || String(error));
      // Handle rate limits for cache creation (60 RPM)
      if (error?.code === 429 || error?.message?.includes('rate limit')) {
        console.warn('[GEMINI] Cache creation rate limited, will retry later');
      }
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
        // Verify cache still exists by attempting to list it using REST API
        const listResponse = await fetch(`${this.baseUrl}/cachedContents?key=${this.apiKey}&filter=model="${model}"`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (listResponse.ok) {
          const caches = await listResponse.json();
          const exists = caches.cachedContents?.some((c: any) => c.name === cached.name);
          
          if (exists) {
            console.log('[GEMINI] Using existing cache:', cached.name);
            return cached.name;
          } else {
            console.log('[GEMINI] Cache not found, will recreate');
            globalThis.cacheStore.delete(cacheKey);
          }
        } else {
          console.warn('[GEMINI] Error checking cache existence, will recreate');
          globalThis.cacheStore.delete(cacheKey);
        }
      } catch (error: any) {
        console.warn('[GEMINI] Error checking cache existence:', error?.message || String(error));
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
    } catch (error: any) {
      console.error('[GEMINI] Failed to get or create cache:', error?.message || String(error));
      // Graceful fallback - return null to use non-cached requests
      return null;
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
        }
        // Note: thinkingBudget is not supported in REST API, removed
      };

      // Use REST API for content generation
      // Remove 'models/' prefix if present for URL
      const modelName = config.model.replace(/^models\//, '');
      const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`;
      
      // Build request body according to Gemini API REST spec
      // Reference: https://ai.google.dev/api/rest/v1beta/models/generateContent
      const requestBody: any = {
        contents: [{
          role: 'user',
          parts: [{ text: userPrompt }]
        }]
      };

      // Add generation config - must be at top level
      requestBody.generationConfig = {
        temperature: generationConfig.temperature,
        maxOutputTokens: generationConfig.maxOutputTokens,
        responseMimeType: generationConfig.responseMimeType,
        responseSchema: generationConfig.responseSchema
        // thinkingBudget removed - not supported in REST API
      };

      // Use cache if provided (system instruction comes from cache)
      // REST API format: cachedContent should be an object with name property
      if (cachedContent) {
        requestBody.cachedContent = cachedContent; // Try string format first
        console.log('[GEMINI] Using cached content (system instruction from cache):', cachedContent);
      } else {
        // Only send system instruction if not using cache
        requestBody.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }
      
      console.log('[GEMINI] Request URL:', url.replace(this.apiKey, 'KEY_REDACTED'));
      console.log('[GEMINI] Request body structure:', {
        hasContents: !!requestBody.contents,
        hasGenerationConfig: !!requestBody.generationConfig,
        hasSystemInstruction: !!requestBody.systemInstruction,
        hasCachedContent: !!requestBody.cachedContent,
        contentsLength: requestBody.contents?.length || 0
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        // Log detailed error information
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          statusCode: response.status,
          error: errorData,
          errorMessage: errorData.error?.message || errorData.message || errorText,
          model: config.model,
          modelName: modelName,
          apiKeyPresent: !!this.apiKey,
          apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'missing'
        };
        
        console.error('[GEMINI] API Error Response:', JSON.stringify(errorDetails, null, 2));
        
        // Create error with status code for proper error detection
        const errorMessage = `Gemini API error (${response.status}): ${errorDetails.errorMessage || errorText}. Model: ${config.model}`;
        const error: any = new Error(errorMessage);
        error.statusCode = response.status;
        error.response = { status: response.status, data: errorData };
        error.errorDetails = errorDetails;
        throw error;
      }

      const responseData = await response.json();

      // Extract usage metadata from REST API response
      const usageMetadata = responseData.usageMetadata;
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

      // Parse response from REST API
      const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      const parsed = JSON.parse(text);
      console.log('[GEMINI] Response strategy:', parsed.strategy);

      return {
        strategy: parsed.strategy,
        messages: parsed.messages
      };
    } catch (error: any) {
      const statusCode = error?.statusCode || error?.response?.status || error?.code;
      console.error('[GEMINI] Error in generate:', {
        message: error?.message,
        statusCode: statusCode,
        error: error
      });
      
      // Preserve status code in error for error detection
      if (!error.statusCode && statusCode) {
        error.statusCode = statusCode;
      }
      
      // Handle cache-related errors
      if (statusCode === 404 || error?.message?.includes('404') || error?.message?.includes('not found')) {
        console.warn('[GEMINI] Cache expired or not found, retrying without cache');
        // Retry without cache
        if (cachedContent) {
          return this.generate(systemPrompt, userPrompt, config);
        }
      }
      
      // Handle rate limits
      if (statusCode === 429 || error?.message?.includes('rate limit')) {
        console.error('[GEMINI] Rate limit exceeded');
        const rateLimitError: any = new Error('Gemini API rate limit exceeded. Please try again later.');
        rateLimitError.statusCode = 429;
        throw rateLimitError;
      }
      
      // Handle token quota
      if (statusCode === 403 || error?.message?.includes('quota')) {
        console.error('[GEMINI] Token quota exceeded');
        const quotaError: any = new Error('Gemini API token quota exceeded.');
        quotaError.statusCode = 403;
        throw quotaError;
      }
      
      // Re-throw with status code preserved
      if (!error.statusCode && statusCode) {
        error.statusCode = statusCode;
      }
      throw error;
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
