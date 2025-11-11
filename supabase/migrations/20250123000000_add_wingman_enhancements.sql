-- Migration: Wingman Extension Enhancements
-- Created: 2025-01-23
-- Purpose: Add profile management, person facts, bot personas, ML feedback tracking, and self-healing

-- ============================================================================
-- 1. WINGMAN PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS wingman_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL,
  strategy_prompt TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  auto_detect_enabled BOOLEAN DEFAULT true,
  detection_rules JSONB DEFAULT '{}'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_user_id, profile_name)
);

CREATE INDEX IF NOT EXISTS idx_wingman_profiles_bot_default ON wingman_profiles(bot_user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_wingman_profiles_bot_user ON wingman_profiles(bot_user_id);

-- ============================================================================
-- 2. PERSON FACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS person_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fact_text TEXT NOT NULL,
  fact_category TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_extracted', 'conversation')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_facts_bot_match ON person_facts(bot_user_id, match_user_id);
CREATE INDEX IF NOT EXISTS idx_person_facts_match ON person_facts(match_user_id);

-- ============================================================================
-- 3. BOT PERSONAS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bot_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_prompt TEXT NOT NULL,
  persona_version INTEGER DEFAULT 1,
  base_persona TEXT,
  evolution_history JSONB DEFAULT '[]'::jsonb,
  performance_data JSONB DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_personas_bot_user ON bot_personas(bot_user_id);

-- ============================================================================
-- 4. SUGGESTION FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_suggestion_id UUID NOT NULL REFERENCES bot_suggestions(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_selected_index INTEGER,
  user_modified BOOLEAN DEFAULT false,
  outcome_score INTEGER CHECK (outcome_score >= 1 AND outcome_score <= 10),
  match_response_time INTEGER,
  match_engagement TEXT CHECK (match_engagement IN ('positive', 'neutral', 'negative', 'no_response')),
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_suggestion ON suggestion_feedback(bot_suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_conversation ON suggestion_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_feedback_created ON suggestion_feedback(created_at DESC);

-- ============================================================================
-- 5. ML OPTIMIZATION LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_optimization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  optimization_type TEXT NOT NULL CHECK (optimization_type IN ('persona_update', 'profile_detection', 'prompt_tuning', 'parameter_adjust')),
  action_taken JSONB NOT NULL,
  before_state JSONB,
  after_state JSONB,
  expected_improvement TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_optimization_bot_created ON ml_optimization_log(bot_user_id, created_at DESC);

-- ============================================================================
-- 6. UPDATE BOT_SUGGESTIONS TABLE
-- ============================================================================

ALTER TABLE bot_suggestions 
  ADD COLUMN IF NOT EXISTS suggestion_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS modified_before_use BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bot_suggestions_used ON bot_suggestions(conversation_id, suggestion_used, created_at DESC);

-- ============================================================================
-- 7. UPDATE USERS TABLE
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_persona_id UUID REFERENCES bot_personas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS persona_auto_update BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_persona ON users(current_persona_id);

-- ============================================================================
-- DOWN: Rollback (commented for reference)
-- ============================================================================

-- ALTER TABLE users DROP COLUMN IF EXISTS persona_auto_update;
-- ALTER TABLE users DROP COLUMN IF EXISTS current_persona_id;
-- ALTER TABLE bot_suggestions DROP COLUMN IF EXISTS modified_before_use;
-- ALTER TABLE bot_suggestions DROP COLUMN IF EXISTS usage_timestamp;
-- ALTER TABLE bot_suggestions DROP COLUMN IF EXISTS suggestion_used;
-- DROP TABLE IF EXISTS ml_optimization_log CASCADE;
-- DROP TABLE IF EXISTS suggestion_feedback CASCADE;
-- DROP TABLE IF EXISTS bot_personas CASCADE;
-- DROP TABLE IF EXISTS person_facts CASCADE;
-- DROP TABLE IF EXISTS wingman_profiles CASCADE;

