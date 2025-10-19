import type { LLMProvider, LLMResponse, LLMConfig } from './interface.ts';

export class GeminiClient implements LLMProvider {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(systemPrompt: string, userPrompt: string, config: LLMConfig): Promise<LLMResponse> {
    const url = this.baseUrl + '/' + config.model + ':generateContent?key=' + this.apiKey;
    
    console.log('[GEMINI] Calling', config.model, 'temp:', config.temperature);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt + '\n\n' + userPrompt
          }]
        }],
        generationConfig: {
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
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error('Gemini API error: ' + response.status + ' - ' + error);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid Gemini response format');
    }

    const text = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    console.log('[GEMINI] Response strategy:', parsed.strategy);
    
    return {
      strategy: parsed.strategy,
      messages: parsed.messages
    };
  }
}
