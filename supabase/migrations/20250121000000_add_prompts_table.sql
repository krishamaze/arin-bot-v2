-- Migration: Add prompts table for versioning
-- Created: 2025-01-21
-- Purpose: Enable prompt versioning for A/B testing and easy updates

-- ============================================================================
-- PROMPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active prompts
CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(is_active) WHERE is_active = true;

-- Index for version lookup
CREATE INDEX IF NOT EXISTS idx_prompts_version ON prompts(version);

COMMENT ON TABLE prompts IS 'Stores prompt versions for Wingman system. Use YAML for dev/testing, DB for production overrides.';
COMMENT ON COLUMN prompts.version IS 'Version identifier (e.g., "2.1.0" or "yaml")';
COMMENT ON COLUMN prompts.content IS 'Full prompt text content';
COMMENT ON COLUMN prompts.is_active IS 'Whether this version is currently active in production';

