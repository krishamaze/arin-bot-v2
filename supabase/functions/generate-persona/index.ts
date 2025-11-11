// Generate Persona Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * CORS headers helper
 */
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
});

/**
 * POST: Generate persona from example messages
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { examples } = body;

    if (!examples || typeof examples !== 'string') {
      return new Response(JSON.stringify({ error: 'examples (string) required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const prompt = `You are a chatbot persona generator. Analyze the following example messages and extract the personality traits, tone, and communication style.

Example Messages:
${examples}

Based on these messages, write a concise chatbot persona description (100-120 words) that includes:
- Overall personality traits (friendly, professional, humorous, caring, etc.)
- Communication style (casual, formal, witty, supportive, etc.)
- Tone characteristics
- Key behavioral patterns

Format your response as a single cohesive persona description starting with "You are a..." that can be directly used as a chatbot system prompt. Do NOT ask for more information. Generate the persona based solely on the provided examples.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 300 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const persona = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!persona) {
      throw new Error('No persona generated');
    }

    return new Response(JSON.stringify({ persona: persona.trim(), success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Generate persona error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate persona' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * Main request handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders() });
  }

  if (req.method === 'POST') {
    return handlePost(req);
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
  });
});

console.log('🤖 Generate Persona Edge Function Ready');

