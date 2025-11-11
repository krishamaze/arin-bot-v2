// Feedback Collector Edge Function
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
 * POST: Record suggestion feedback
 */
async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const {
      botSuggestionId,
      conversationId,
      userSelectedIndex,
      userModified,
      outcomeScore,
      matchResponseTime,
      matchEngagement,
      feedbackNotes
    } = body;

    if (!botSuggestionId || !conversationId) {
      return new Response(JSON.stringify({ error: 'botSuggestionId and conversationId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
      });
    }

    // Insert feedback
    const { data: feedback, error } = await supabase
      .from('suggestion_feedback')
      .insert({
        bot_suggestion_id: botSuggestionId,
        conversation_id: conversationId,
        user_selected_index: userSelectedIndex || null,
        user_modified: userModified || false,
        outcome_score: outcomeScore || null,
        match_response_time: matchResponseTime || null,
        match_engagement: matchEngagement || null,
        feedback_notes: feedbackNotes || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update bot_suggestions table
    await supabase
      .from('bot_suggestions')
      .update({
        suggestion_used: true,
        usage_timestamp: new Date().toISOString(),
        modified_before_use: userModified || false,
        user_selected_index: userSelectedIndex || null
      })
      .eq('id', botSuggestionId);

    // Calculate performance metrics (basic)
    const metrics = await calculatePerformanceMetrics(conversationId);

    return new Response(JSON.stringify({
      feedback,
      metrics,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error: any) {
    console.error('Record feedback error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to record feedback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

/**
 * Calculate performance metrics for a conversation
 */
async function calculatePerformanceMetrics(conversationId: string) {
  const { data: feedbacks } = await supabase
    .from('suggestion_feedback')
    .select('*')
    .eq('conversation_id', conversationId);

  if (!feedbacks || feedbacks.length === 0) {
    return {
      suggestionAcceptanceRate: 0,
      averageOutcomeScore: 0,
      averageResponseTime: 0,
      positiveEngagementRate: 0
    };
  }

  const used = feedbacks.filter(f => f.user_selected_index !== null).length;
  const total = feedbacks.length;
  const withScores = feedbacks.filter(f => f.outcome_score !== null);
  const withResponseTime = feedbacks.filter(f => f.match_response_time !== null);
  const positiveEngagements = feedbacks.filter(f => f.match_engagement === 'positive').length;

  return {
    suggestionAcceptanceRate: total > 0 ? used / total : 0,
    averageOutcomeScore: withScores.length > 0
      ? withScores.reduce((sum, f) => sum + (f.outcome_score || 0), 0) / withScores.length
      : 0,
    averageResponseTime: withResponseTime.length > 0
      ? withResponseTime.reduce((sum, f) => sum + (f.match_response_time || 0), 0) / withResponseTime.length
      : 0,
    positiveEngagementRate: total > 0 ? positiveEngagements / total : 0
  };
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

console.log('🤖 Feedback Collector Edge Function Ready');

