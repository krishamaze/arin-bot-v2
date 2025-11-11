// Bot Persona Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabase } from '../_shared/supabaseClient.ts';

/**
 * CORS headers helper
 */
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
});

/**
 * GET: Fetch current persona for bot owner
 */
async function handleGet(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const botUserId = url.searchParams.get('botUserId');
    
    if (!botUserId) {
      return new Response(JSON.stringify({ error: 'botUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get user ID from platform_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', botUserId)
      .eq('user_type', 'bot_owner')
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const { data: persona, error } = await supabase
      .from('bot_personas')
      .select('*')
      .eq('bot_user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // If no persona exists, return null (will use prompts.yaml fallback)
    return new Response(JSON.stringify({ persona: persona || null }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Get persona error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to get persona' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * POST: Update persona (manual or auto)
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { botUserId, personaPrompt, basePersona } = body;

    if (!botUserId || !personaPrompt) {
      return new Response(JSON.stringify({ error: 'botUserId and personaPrompt required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get user ID from platform_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', botUserId)
      .eq('user_type', 'bot_owner')
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get existing persona to track evolution
    const { data: existingPersona } = await supabase
      .from('bot_personas')
      .select('*')
      .eq('bot_user_id', user.id)
      .single();

    const evolutionHistory = existingPersona?.evolution_history || [];
    const currentVersion = existingPersona?.persona_version || 0;
    const newVersion = currentVersion + 1;

    // Add to evolution history
    evolutionHistory.push({
      version: newVersion,
      persona_prompt: personaPrompt,
      updated_at: new Date().toISOString(),
      reason: body.reason || 'manual_update'
    });

    // Upsert persona
    const { data: persona, error } = await supabase
      .from('bot_personas')
      .upsert({
        bot_user_id: user.id,
        persona_prompt: personaPrompt,
        persona_version: newVersion,
        base_persona: basePersona || existingPersona?.base_persona || personaPrompt,
        evolution_history: evolutionHistory,
        last_updated_at: new Date().toISOString()
      }, {
        onConflict: 'bot_user_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update user's current_persona_id
    await supabase
      .from('users')
      .update({ current_persona_id: persona.id })
      .eq('id', user.id);

    return new Response(JSON.stringify({ persona, success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Update persona error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to update persona' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * POST /auto-update: ML-based persona evolution
 */
async function handleAutoUpdate(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { botUserId, conversationOutcomes, feedbackScores } = body;

    if (!botUserId) {
      return new Response(JSON.stringify({ error: 'botUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get user ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('platform_id', botUserId)
      .single();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Get current persona
    const { data: currentPersona } = await supabase
      .from('bot_personas')
      .select('*')
      .eq('bot_user_id', user.id)
      .single();

    if (!currentPersona) {
      return new Response(JSON.stringify({ error: 'No persona found to update' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Use Gemini to analyze outcomes and generate improved persona
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const analysisPrompt = `
Current Persona:
${currentPersona.persona_prompt}

Conversation Outcomes:
${JSON.stringify(conversationOutcomes || [])}

Feedback Scores:
${JSON.stringify(feedbackScores || [])}

Analyze what's working and what's not. Generate an improved persona that:
1. Keeps successful traits
2. Fixes weaknesses
3. Maintains consistency

Return JSON:
{
  "improved_persona": "new persona description",
  "changes": ["list of changes made"],
  "expected_improvement": "what should improve"
}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: analysisPrompt }] }],
        generationConfig: { temperature: 0.5, topP: 0.9, maxOutputTokens: 1000 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON response
    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to parse ML response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Update persona with improved version
    const evolutionHistory = currentPersona.evolution_history || [];
    const newVersion = (currentPersona.persona_version || 0) + 1;

    evolutionHistory.push({
      version: newVersion,
      persona_prompt: parsed.improved_persona,
      updated_at: new Date().toISOString(),
      reason: 'ml_auto_update',
      changes: parsed.changes,
      expected_improvement: parsed.expected_improvement
    });

    const { data: updatedPersona, error } = await supabase
      .from('bot_personas')
      .update({
        persona_prompt: parsed.improved_persona,
        persona_version: newVersion,
        evolution_history: evolutionHistory,
        last_updated_at: new Date().toISOString()
      })
      .eq('bot_user_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      persona: updatedPersona,
      changes: parsed.changes,
      expected_improvement: parsed.expected_improvement,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Auto-update persona error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to auto-update persona' }), {
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
      if (path.endsWith('/auto-update')) {
        return handleAutoUpdate(req);
      }
      return handlePost(req);
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

console.log('🤖 Bot Persona Edge Function Ready');

