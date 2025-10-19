import OpenAI from 'https://deno.land/x/openai@v4.20.1/mod.ts';
import type { LLMProvider, LLMResponse, LLMConfig } from './interface.ts';

export class OpenAIClient implements LLMProvider {
  private client: OpenAI;
  private responseSchema: any;

  constructor(apiKey: string, responseSchema: any) {
    this.client = new OpenAI({ apiKey });
    this.responseSchema = responseSchema;
  }

  async generate(systemPrompt: string, userPrompt: string, config: LLMConfig): Promise<LLMResponse> {
    console.log('[OPENAI] Calling', config.model, 'temp:', config.temperature);

    const completion = await this.client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: config.temperature,
      max_completion_tokens: config.max_completion_tokens || 120,
      presence_penalty: config.presence_penalty || 0.3,
      frequency_penalty: config.frequency_penalty || 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: this.responseSchema
      }
    });

    // Log token usage
    if (completion.usage) {
      console.log('[OPENAI] Tokens:', {
        prompt: completion.usage.prompt_tokens,
        cached: completion.usage.prompt_tokens_details?.cached_tokens || 0,
        completion: completion.usage.completion_tokens
      });
    }

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    
    console.log('[OPENAI] Response strategy:', parsed.strategy);

    return {
      strategy: parsed.strategy,
      messages: parsed.messages
    };
  }
}
