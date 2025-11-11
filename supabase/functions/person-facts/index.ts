// Person Facts Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabase } from '../_shared/supabaseClient.ts';

/**
 * CORS headers helper
 */
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
});

/**
 * GET: Fetch facts for a match
 */
async function handleGet(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const botUserId = url.searchParams.get('botUserId');
    const matchUserId = url.searchParams.get('matchUserId');
    
    if (!botUserId || !matchUserId) {
      return new Response(JSON.stringify({ error: 'botUserId and matchUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get user IDs from platform_ids
    const { data: botUser, error: botError } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', botUserId)
      .eq('user_type', 'bot_owner')
      .single();

    const { data: matchUser, error: matchError } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', matchUserId)
      .eq('user_type', 'match')
      .single();

    if (botError || !botUser || matchError || !matchUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const { data: facts, error } = await supabase
      .from('person_facts')
      .select('*')
      .eq('bot_user_id', botUser.id)
      .eq('match_user_id', matchUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify(facts || []), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Get facts error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to get facts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * POST: Create or update fact
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { bot_user_id, match_user_id, fact_text, fact_category, source, confidence } = body;

    if (!bot_user_id || !match_user_id || !fact_text) {
      return new Response(JSON.stringify({ error: 'bot_user_id, match_user_id, and fact_text required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get user IDs from platform_ids (if provided as platform IDs)
    let botUserId = bot_user_id;
    let matchUserId = match_user_id;

    // Check if they're platform IDs (strings) or UUIDs
    if (typeof bot_user_id === 'string' && !bot_user_id.includes('-')) {
      const { data: botUser } = await supabase
        .from('users')
        .select('id')
        .eq('platform_id', bot_user_id)
        .single();
      if (botUser) botUserId = botUser.id;
    }

    if (typeof match_user_id === 'string' && !match_user_id.includes('-')) {
      const { data: matchUser } = await supabase
        .from('users')
        .select('id')
        .eq('platform_id', match_user_id)
        .single();
      if (matchUser) matchUserId = matchUser.id;
    }

    const { data: fact, error } = await supabase
      .from('person_facts')
      .insert({
        bot_user_id: botUserId,
        match_user_id: matchUserId,
        fact_text: fact_text,
        fact_category: fact_category || null,
        source: source || 'manual',
        confidence: confidence || null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ fact, success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Create fact error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to create fact' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * DELETE: Delete fact
 */
async function handleDelete(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const factId = url.pathname.split('/').pop();
    
    if (!factId) {
      return new Response(JSON.stringify({ error: 'factId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const { error } = await supabase
      .from('person_facts')
      .delete()
      .eq('id', factId);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Delete fact error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to delete fact' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * POST /auto-extract: ML-based fact extraction from conversation
 */
async function handleAutoExtract(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { botUserId, matchUserId, recentMessages } = body;

    if (!botUserId || !matchUserId || !recentMessages) {
      return new Response(JSON.stringify({ error: 'botUserId, matchUserId, and recentMessages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get user IDs
    const { data: botUser } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', botUserId)
      .single();

    const { data: matchUser } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', matchUserId)
      .single();

    if (!botUser || !matchUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Use Gemini to extract facts
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const messagesText = recentMessages.map((m: any) => `${m.sender}: ${m.text}`).join('\n');
    const prompt = `Analyze this conversation and extract factual information about the person. Return JSON array of facts:
[
  {"fact_text": "fact description", "category": "interest|background|preference|note", "confidence": "high|medium|low"}
]

Conversation:
${messagesText}

Return only valid JSON array, no other text.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON response
    let facts: any[];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        facts = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found');
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse extracted facts', details: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Save extracted facts
    const savedFacts = [];
    for (const fact of facts) {
      const { data: savedFact, error } = await supabase
        .from('person_facts')
        .insert({
          bot_user_id: botUser.id,
          match_user_id: matchUser.id,
          fact_text: fact.fact_text,
          fact_category: fact.category || null,
          source: 'ai_extracted',
          confidence: fact.confidence || 'medium'
        })
        .select()
        .single();

      if (!error && savedFact) {
        savedFacts.push(savedFact);
      }
    }

    return new Response(JSON.stringify({ facts: savedFacts, success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Auto-extract error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to extract facts' }), {
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

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'GET') {
      return handleGet(req);
    } else if (req.method === 'POST') {
      if (path.endsWith('/auto-extract')) {
        return handleAutoExtract(req);
      }
      return handlePost(req);
    } else if (req.method === 'DELETE') {
      return handleDelete(req);
    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }
  } catch (error: any) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
});

console.log('🤖 Person Facts Edge Function Ready');

