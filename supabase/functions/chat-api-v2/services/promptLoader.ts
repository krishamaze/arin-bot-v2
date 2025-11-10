// PromptLoader - Loads prompts from YAML (dev) or database (prod)
import { parse } from 'https://deno.land/std@0.208.0/yaml/mod.ts';
import { supabase } from '../../_shared/supabaseClient.ts';
import { WINGMAN_PROMPT } from '../../_shared/prompts.ts';

export interface PromptConfig {
  version: string;
  content: string;
  source: 'yaml' | 'database' | 'fallback';
}

/**
 * Load prompt from YAML file
 */
async function loadPromptFromYAML(version: string): Promise<PromptConfig | null> {
  try {
    const configPath = './config/prompts.yaml';
    const fileContent = await Deno.readTextFile(configPath);
    const config = parse(fileContent) as any;
    
    if (!config.version || !config.content) {
      console.error('[PROMPT] YAML missing version or content');
      return null;
    }
    
    console.log(`[PROMPT] Loaded from YAML v${config.version}`);
    return {
      version: config.version,
      content: config.content,
      source: 'yaml'
    };
  } catch (error: any) {
    console.error('[PROMPT] YAML load error:', error.message);
    return null;
  }
}

/**
 * Load prompt from database
 */
async function loadPromptFromDatabase(version: string): Promise<PromptConfig | null> {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('version, content')
      .eq('version', version)
      .single();
    
    if (error || !data) {
      console.error('[PROMPT] Database load error:', error?.message || 'Not found');
      return null;
    }
    
    console.log(`[PROMPT] Loaded from database v${data.version}`);
    return {
      version: data.version,
      content: data.content,
      source: 'database'
    };
  } catch (error: any) {
    console.error('[PROMPT] Database error:', error.message);
    return null;
  }
}

/**
 * Load active prompt from database (if version not specified)
 */
async function loadActivePromptFromDatabase(): Promise<PromptConfig | null> {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('version, content')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('[PROMPT] No active prompt in database:', error?.message);
      return null;
    }
    
    console.log(`[PROMPT] Loaded active prompt from database v${data.version}`);
    return {
      version: data.version,
      content: data.content,
      source: 'database'
    };
  } catch (error: any) {
    console.error('[PROMPT] Database error:', error.message);
    return null;
  }
}

/**
 * PromptLoader - Loads prompts from YAML (dev) or database (prod)
 */
export class PromptLoader {
  private cache: PromptConfig | null = null;
  private lastFetch: number = 0;
  private cacheTTL = 60000; // 1 minute cache

  /**
   * Load prompt based on environment configuration
   */
  async loadPrompt(): Promise<PromptConfig> {
    const now = Date.now();
    
    // Return cached prompt if still fresh
    if (now - this.lastFetch < this.cacheTTL && this.cache) {
      console.log('[PROMPT] Using cached prompt');
      return this.cache;
    }

    const promptSource = Deno.env.get('PROMPT_SOURCE') || 'yaml';
    const promptVersion = Deno.env.get('PROMPT_VERSION');

    let prompt: PromptConfig | null = null;

    // Try YAML first if source is 'yaml' or not set
    if (promptSource === 'yaml' || !promptSource) {
      if (promptVersion === 'yaml' || !promptVersion) {
        prompt = await loadPromptFromYAML('yaml');
      }
    }

    // Try database if source is 'database' or YAML failed
    if (!prompt && (promptSource === 'database' || promptSource === 'yaml')) {
      if (promptVersion && promptVersion !== 'yaml') {
        prompt = await loadPromptFromDatabase(promptVersion);
      } else if (!promptVersion) {
        prompt = await loadActivePromptFromDatabase();
      }
    }

    // Fallback to hardcoded prompt
    if (!prompt) {
      console.warn('[PROMPT] Using fallback hardcoded prompt');
      prompt = {
        version: '2.1.0',
        content: WINGMAN_PROMPT,
        source: 'fallback'
      };
    }

    // Cache the result
    this.cache = prompt;
    this.lastFetch = now;

    return prompt;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache = null;
    this.lastFetch = 0;
  }
}

