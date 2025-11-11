// ML Optimizer Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabase } from '../_shared/supabaseClient.ts';

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
 * POST: Run ML optimization
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { botUserId, optimizationType } = body;

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
      .eq('user_type', 'bot_owner')
      .single();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Analyze feedback patterns
    const { data: recentFeedback } = await supabase
      .from('suggestion_feedback')
      .select(`
        *,
        bot_suggestions!inner(conversation_id, analysis, suggestions)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!recentFeedback || recentFeedback.length === 0) {
      return new Response(JSON.stringify({
        message: 'Insufficient feedback data for optimization',
        success: false
      }), {
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Calculate current performance
    const total = recentFeedback.length;
    const used = recentFeedback.filter(f => f.user_selected_index !== null).length;
    const positive = recentFeedback.filter(f => f.match_engagement === 'positive').length;
    const currentAcceptanceRate = used / total;
    const currentEngagementRate = positive / total;

    // Determine optimization action based on type
    let actionTaken: any = {};
    let beforeState: any = {};
    let afterState: any = {};

    if (optimizationType === 'persona_update') {
      // Get current persona
      const { data: persona } = await supabase
        .from('bot_personas')
        .select('*')
        .eq('bot_user_id', user.id)
        .single();

      if (persona) {
        beforeState = { persona_prompt: persona.persona_prompt, version: persona.persona_version };
        
        // Call persona auto-update
        const updateRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/bot-persona/auto-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botUserId,
            conversationOutcomes: recentFeedback.map(f => ({
              used: f.user_selected_index !== null,
              engagement: f.match_engagement,
              score: f.outcome_score
            })),
            feedbackScores: recentFeedback.map(f => f.outcome_score).filter(s => s !== null)
          })
        });

        if (updateRes.ok) {
          const updateResult = await updateRes.json();
          afterState = { persona_prompt: updateResult.persona?.persona_prompt, version: updateResult.persona?.persona_version };
          actionTaken = { type: 'persona_update', changes: updateResult.changes };
        }
      }
    } else if (optimizationType === 'profile_detection') {
      // Analyze which profiles work best
      const { data: profiles } = await supabase
        .from('wingman_profiles')
        .select('*')
        .eq('bot_user_id', user.id);

      // Update detection rules based on successful matches
      // (Simplified - in production, use more sophisticated ML)
      beforeState = { profiles: profiles?.map(p => ({ id: p.id, name: p.profile_name, rules: p.detection_rules })) };
      
      // Update performance metrics for each profile
      for (const profile of profiles || []) {
        const profileFeedback = recentFeedback.filter(f => {
          // Match feedback to profile (simplified - would need profile tracking in suggestions)
          return true; // Placeholder
        });

        const profileMetrics = {
          usageCount: profileFeedback.length,
          acceptanceRate: profileFeedback.filter(f => f.user_selected_index !== null).length / (profileFeedback.length || 1),
          engagementRate: profileFeedback.filter(f => f.match_engagement === 'positive').length / (profileFeedback.length || 1)
        };

        await supabase
          .from('wingman_profiles')
          .update({ performance_metrics: profileMetrics })
          .eq('id', profile.id);
      }

      afterState = { profiles: profiles?.map(p => ({ id: p.id, name: p.profile_name, metrics: p.performance_metrics })) };
      actionTaken = { type: 'profile_detection', updated_metrics: true };
    }

    // Log optimization
    await supabase
      .from('ml_optimization_log')
      .insert({
        bot_user_id: user.id,
        optimization_type: optimizationType || 'persona_update',
        action_taken: actionTaken,
        before_state: beforeState,
        after_state: afterState,
        expected_improvement: `Acceptance rate: ${currentAcceptanceRate.toFixed(2)} → target: ${(currentAcceptanceRate * 1.1).toFixed(2)}`
      });

    return new Response(JSON.stringify({
      currentMetrics: {
        acceptanceRate: currentAcceptanceRate,
        engagementRate: currentEngagementRate
      },
      actionTaken,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('ML optimization error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to run optimization' }), {
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

console.log('🤖 ML Optimizer Edge Function Ready');

