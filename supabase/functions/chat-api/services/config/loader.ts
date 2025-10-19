import { parse } from 'https://deno.land/std@0.208.0/yaml/mod.ts';

/**
 * ConfigLoader - Loads and caches configuration from local files
 * Supports fallback to previous configs if new ones fail to load
 */
export class ConfigLoader {
  private cache: Map<string, any> = new Map();
  private lastFetch: Map<string, number> = new Map();
  private cacheTTL = 60000; // 1 minute cache

  constructor(private configBasePath: string = './config') {}

  /**
   * Load a config file with caching and fallback
   */
  async load(configName: string): Promise<any> {
    const now = Date.now();
    const lastFetch = this.lastFetch.get(configName) || 0;

    // Return cached config if still fresh
    if (now - lastFetch < this.cacheTTL && this.cache.has(configName)) {
      console.log(\📋 Using cached config: \\);
      return this.cache.get(configName);
    }

    try {
      const configPath = \\/\.yaml\;
      const fileContent = await Deno.readTextFile(configPath);
      const config = parse(fileContent);

      // Validate config has version
      if (!config.version) {
        throw new Error(\Config \ missing version field\);
      }

      console.log(\✓ Loaded \.yaml v\\);

      this.cache.set(configName, config);
      this.lastFetch.set(configName, now);

      return config;
    } catch (error) {
      console.error(\❌ Config load error for \:\, error.message);

      // Return stale cache if available
      if (this.cache.has(configName)) {
        console.log(\⚠️  Using stale cache for \\);
        return this.cache.get(configName);
      }

      throw new Error(\Config \ unavailable and no cache exists\);
    }
  }

  /**
   * Load prompts configuration
   */
  async loadPrompts() {
    return this.load('prompts');
  }

  /**
   * Load models configuration
   */
  async loadModels() {
    return this.load('models');
  }

  /**
   * Get current prompt version
   */
  async getPromptVersion(): Promise<string> {
    const config = await this.loadPrompts();
    return config.version;
  }

  /**
   * Get current model version
   */
  async getModelVersion(): Promise<string> {
    const config = await this.loadModels();
    return config.production.description || config.version;
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    this.lastFetch.clear();
    console.log('🧹 Config cache cleared');
  }
}
