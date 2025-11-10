// Gemini API client with caching for Wingman (using REST API)
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
if (!GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Use v1 API for better model support and stability
// Note: v1beta supports cachedContents but has limited model support
// For now, use v1 API without caching for better compatibility
const BASE_URL_V1 = 'https://generativelanguage.googleapis.com/v1';
const BASE_URL_V1BETA = 'https://generativelanguage.googleapis.com/v1beta';

// In-memory cache map for Deno instance persistence
if (!globalThis.wingmanCacheStore) {
  globalThis.wingmanCacheStore = new Map<string, { name: string, expiresAt: number }>();
}

interface CacheInfo {
  name: string;
  expiresAt: number;
}

/**
 * Get or create cache for system prompt + user/girl profiles
 */
export async function getOrCreateCache(
  systemPrompt: string,
  userInfo: string,
  girlInfo: string,
  userId?: string,
  girlId?: string
): Promise<string | null> {
  // Create cache key based on user and girl IDs (cache per user-girl pair)
  // This allows caching system prompt + profiles together
  const cacheKey = userId && girlId 
    ? `wingman_v2_${userId}_${girlId}`
    : `wingman_v2_temp_${Date.now()}`;
  const cached = globalThis.wingmanCacheStore.get(cacheKey);
  
  // Check if cache exists and not expired
  if (cached && cached.expiresAt > Date.now()) {
    console.log('✅ Using existing cache:', cached.name);
    return cached.name;
  }
  
  // Cache creation disabled for now due to v1beta model support issues
  // TODO: Re-enable caching when v1beta model support is improved
  // For now, return null to use non-cached generation
  console.log('⚠️ Caching disabled - using non-cached generation');
  return null;
  
  /* Caching code (disabled)
  try {
    const cacheResponse = await fetch(`${BASE_URL_V1BETA}/cachedContents?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-1.5-flash-002',  // Use specific version for v1beta
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: `USER INFO:\n${userInfo}\n\nGIRL INFO:\n${girlInfo}` }]
        }],
        ttl: '3600s',
        displayName: `wingman_v2_${userId || 'user'}_${girlId || 'girl'}_${Date.now()}`
      })
    });
    
    if (!cacheResponse.ok) {
      const errorText = await cacheResponse.text();
      console.error('Cache creation failed:', errorText);
      return null;
    }
    
    const cache = await cacheResponse.json();
    console.log('🆕 Created new cache:', cache.name);
    
    globalThis.wingmanCacheStore.set(cacheKey, {
      name: cache.name,
      expiresAt: Date.now() + 3500 * 1000
    });
    
    return cache.name;
  } catch (error: any) {
    console.error('❌ Cache creation failed:', error?.message || String(error));
    return null;
  }
  */
}

/**
 * Generate Wingman suggestions with caching
 */
export async function generateWithCache(
  cacheName: string | null,
  systemPrompt: string,
  userInfo: string,
  girlInfo: string,
  conversationContent: string
): Promise<{
  text: string;
  responseTime: number;
  cachedTokens: number;
}> {
  const startTime = Date.now();
  // Use v1beta API with fallback chain (matches chat-api implementation)
  // Try models in order until one works
  const modelFallbackChain = [
    'gemini-2.5-flash-001',  // Primary: Fast, cost-efficient
    'gemini-2.5-pro-001',    // Secondary: Most capable
    'gemini-2.0-flash-001',  // Tertiary: Previous gen
    'gemini-1.5-flash-001'   // Final: Older stable version
  ];
  
  let lastError: Error | null = null;
  
  for (const modelName of modelFallbackChain) {
    try {
      return await generateWithModel(modelName, cacheName, systemPrompt, userInfo, girlInfo, conversationContent, startTime);
    } catch (error: any) {
      lastError = error;
      // If it's a 404 (model not found), try next model
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        console.warn(`⚠️ Model ${modelName} not available, trying next in fallback chain...`);
        continue;
      }
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If all models failed, throw the last error
  if (lastError) {
    throw lastError;
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('All models in fallback chain failed');
}

async function generateWithModel(
  modelName: string,
  cacheName: string | null,
  systemPrompt: string,
  userInfo: string,
  girlInfo: string,
  conversationContent: string,
  startTime: number
): Promise<{ text: string; responseTime: number; cachedTokens: number }> {
  // Define JSON schema for Wingman response (v1beta supports structured output)
  const responseSchema = {
    type: 'object',
    properties: {
      analysis: {
        type: 'object',
        properties: {
          her_last_message_feeling: { type: 'string' },
          conversation_vibe: { type: 'string' },
          recommended_goal: { type: 'string' }
        },
        required: ['her_last_message_feeling', 'conversation_vibe', 'recommended_goal']
      },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { 
              type: 'string',
              enum: ['Playful/Humorous', 'Curious/Engaging', 'Direct/Confident']
            },
            text: { type: 'string' },
            rationale: { type: 'string' }
          },
          required: ['type', 'text', 'rationale']
        },
        minItems: 3,
        maxItems: 3
      },
      wingman_tip: { type: 'string' }
    },
    required: ['analysis', 'suggestions', 'wingman_tip']
  };

  // Build request body for v1beta API (supports systemInstruction and structured output)
  const requestBody: any = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: `USER INFO:\n${userInfo}\n\nGIRL INFO:\n${girlInfo}\n\nRECENT CONVERSATION:\n${conversationContent}` }]
    }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2000,
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    }
  };
  
  // Use v1beta API for generateContent (matches working chat-api implementation)
  // Remove 'models/' prefix from model name for URL
  const urlModelName = modelName.replace(/^models\//, '');
  const url = `${BASE_URL_V1BETA}/models/${urlModelName}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Generation failed: ${response.status} ${errorText}`);
  }
  
  const responseData = await response.json();
  const responseTime = Date.now() - startTime;
  
  // Extract usage metadata
  const usageMetadata = responseData.usageMetadata;
  const cachedTokens = usageMetadata?.cachedContentTokenCount || 0;
  const totalTokens = usageMetadata?.totalTokenCount || 0;
  
  console.log(`⏱️ Response time: ${responseTime}ms, Cached tokens: ${cachedTokens}, Total tokens: ${totalTokens}`);
  
  // Extract text from response (v1beta with structured output returns JSON directly)
  let text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini API');
  }
  
  // With responseMimeType: 'application/json', response should be valid JSON
  // Validate it's valid JSON (clean up if needed)
  text = text.trim();
  try {
    JSON.parse(text);
  } catch (e) {
    console.warn('⚠️ Response might not be valid JSON, attempting to extract JSON from text');
    // Try to extract JSON from the text (remove markdown code blocks if present)
    if (text.startsWith('```json')) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/```\n?/g, '').trim();
    }
    // Try to extract JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
      throw new Error('Invalid JSON response from Gemini API');
    }
  }
  
  return {
    text,
    responseTime,
    cachedTokens
  };
}

