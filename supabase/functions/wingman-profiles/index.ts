// Wingman Profiles Edge Function
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
 * GET: List profiles for a bot user
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

    const { data: profiles, error } = await supabase
      .from('wingman_profiles')
      .select('*')
      .eq('bot_user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ profiles: profiles || [] }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Get profiles error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to get profiles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * POST: Create or update profile
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { botUserId, profileName, strategyPrompt, settings, isDefault, autoDetectEnabled, detectionRules } = body;

    if (!botUserId || !profileName) {
      return new Response(JSON.stringify({ error: 'botUserId and profileName required' }), {
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

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('wingman_profiles')
        .update({ is_default: false })
        .eq('bot_user_id', user.id);
    }

    // Upsert profile
    const { data: profile, error } = await supabase
      .from('wingman_profiles')
      .upsert({
        bot_user_id: user.id,
        profile_name: profileName,
        strategy_prompt: strategyPrompt || null,
        settings: settings || {},
        is_default: isDefault || false,
        auto_detect_enabled: autoDetectEnabled !== undefined ? autoDetectEnabled : true,
        detection_rules: detectionRules || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'bot_user_id,profile_name'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ profile, success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Create/update profile error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to save profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * DELETE: Delete profile
 */
async function handleDelete(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const profileId = url.searchParams.get('profileId');
    
    if (!profileId) {
      return new Response(JSON.stringify({ error: 'profileId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const { error } = await supabase
      .from('wingman_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Delete profile error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to delete profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * POST /auto-detect: ML-based profile detection
 */
async function handleAutoDetect(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { botUserId, matchProfile, conversationContext, recentMessages } = body;

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

    // Get all profiles with auto-detect enabled
    const { data: profiles, error: profilesError } = await supabase
      .from('wingman_profiles')
      .select('*')
      .eq('bot_user_id', user.id)
      .eq('auto_detect_enabled', true);

    if (profilesError) {
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ 
        profileId: null, 
        confidence: 0,
        message: 'No profiles with auto-detection enabled'
      }), {
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Use Gemini to analyze and score profiles
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      // Fallback: return default profile or first profile
      const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
      return new Response(JSON.stringify({
        profileId: defaultProfile.id,
        profileName: defaultProfile.profile_name,
        confidence: 0.5,
        message: 'Using default profile (ML not configured)'
      }), {
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Build prompt for profile detection
    const contextText = `
Match Profile: ${JSON.stringify(matchProfile || {})}
Conversation Context: ${conversationContext || 'New conversation'}
Recent Messages: ${recentMessages ? recentMessages.map((m: any) => `${m.sender}: ${m.text}`).join('\n') : 'None'}

Available Profiles:
${profiles.map((p: any, idx: number) => `
${idx + 1}. ${p.profile_name}
   Strategy: ${p.strategy_prompt || 'No strategy defined'}
   Detection Rules: ${JSON.stringify(p.detection_rules || {})}
`).join('\n')}

Analyze which profile would work best for this match and conversation. Respond with JSON:
{
  "profileIndex": 0,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: contextText }] }],
        generationConfig: { temperature: 0.3, topP: 0.8, maxOutputTokens: 200 }
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
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      // Fallback to default profile
      const defaultProfile = profiles.find((p: any) => p.is_default) || profiles[0];
      return new Response(JSON.stringify({
        profileId: defaultProfile.id,
        profileName: defaultProfile.profile_name,
        confidence: 0.5,
        message: 'Failed to parse ML response, using default'
      }), {
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    const selectedProfile = profiles[parsed.profileIndex || 0] || profiles[0];

    // Update performance metrics
    const currentMetrics = selectedProfile.performance_metrics || {};
    const newMetrics = {
      ...currentMetrics,
      autoDetections: (currentMetrics.autoDetections || 0) + 1,
      lastDetectedAt: new Date().toISOString()
    };

    await supabase
      .from('wingman_profiles')
      .update({ performance_metrics: newMetrics })
      .eq('id', selectedProfile.id);

    return new Response(JSON.stringify({
      profileId: selectedProfile.id,
      profileName: selectedProfile.profile_name,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'ML analysis',
      message: 'Profile detected successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Auto-detect error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to auto-detect profile' }), {
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
      if (path.endsWith('/auto-detect')) {
        return handleAutoDetect(req);
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

console.log('🤖 Wingman Profiles Edge Function Ready');

