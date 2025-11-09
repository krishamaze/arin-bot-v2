# Documentation

Welcome to the Arin Bot v2 documentation! This directory contains comprehensive guides and references for working with the project.

## 📚 Available Documentation

### Getting Started

- **[Main README](../README.md)** - Project overview, quick start, and basic usage
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute to the project

### Supabase & Database

- **[Supabase CLI Guide](SUPABASE_CLI_GUIDE.md)** - Complete reference for using Supabase CLI
  - Installation and setup
  - Migration workflows
  - Database inspection
  - TypeScript type generation
  - Common commands and best practices

- **[Supabase Usage](SUPABASE_USAGE.md)** - Integration patterns and usage examples
  - Edge Functions
  - Database queries
  - Authentication
  - Storage

- **[Database Tables](DATABASE_TABLES.md)** - Database schema reference
  - Table structures
  - Column definitions
  - Relationships
  - Query examples

- **[Schema Verification](SCHEMA_VERIFICATION.md)** - Schema validation and verification
  - Verification scripts
  - Schema comparison
  - Migration validation

## 🔧 Quick Reference

### Common Tasks

| Task | Documentation | Command |
|------|---------------|---------|
| Set up project | [Main README](../README.md#getting-started) | `supabase link` |
| Create migration | [Supabase CLI Guide](SUPABASE_CLI_GUIDE.md#create-a-new-migration) | `supabase migration new <name>` |
| Deploy functions | [Main README](../README.md#installation) | `supabase functions deploy` |
| Check database | [Database Tables](DATABASE_TABLES.md) | `.\scripts\list-tables.ps1` |
| Generate types | [Supabase CLI Guide](SUPABASE_CLI_GUIDE.md#generate-typescript-types) | `supabase gen types typescript` |

### Project Scripts

Located in `scripts/` directory:

- **`test-connection.ps1`** - Test database connectivity
- **`verify-schema.ps1`** - Verify and pull database schema
- **`list-tables.ps1`** - List all database tables
- **`sql_queries/`** - SQL query templates

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  Browser Client │ (fftBot-client.js)
│  (Userscript)   │
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────────────────────────┐
│     Supabase Edge Function          │
│         (chat-api)                  │
│  ┌─────────────────────────────┐   │
│  │  Main Handler (index.ts)    │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────┐           │
│  │   LLM Factory       │           │
│  │  ┌──────┐ ┌──────┐ │           │
│  │  │OpenAI│ │Gemini│ │           │
│  │  └──────┘ └──────┘ │           │
│  └─────────────────────┘           │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  PostgreSQL DB      │
│  - bots             │
│  - rooms            │
│  - events           │
│  - summaries        │
└─────────────────────┘
```

## 🔑 Key Concepts

### Bot Lifecycle

1. **Initialization**: Bot is created or retrieved from database
2. **Event Collection**: Browser client batches chat messages
3. **Context Building**: System fetches conversation history and summaries
4. **LLM Processing**: Events are sent to LLM with context
5. **Response Generation**: Bot decides to ENGAGE, OBSERVE, or IGNORE
6. **Message Delivery**: Responses are sent back to browser client

### Configuration System

The bot uses YAML-based configuration:

- **`config/prompts.yaml`**: System instructions and personality
- **`config/models.yaml`**: LLM provider settings and parameters

See [Supabase Usage](SUPABASE_USAGE.md) for configuration details.

### Multi-Provider LLM

The system supports multiple LLM providers with automatic fallback:

1. **Primary**: OpenAI GPT-4
2. **Fallback**: Google Gemini

If the primary provider fails, the system automatically retries with the fallback provider.

## 🔍 Troubleshooting

### Common Issues

| Issue | Solution | Reference |
|-------|----------|-----------|
| Connection failed | Check `.env` credentials | [Main README](../README.md#installation) |
| Migration conflicts | Use `supabase migration repair` | [Supabase CLI Guide](SUPABASE_CLI_GUIDE.md#troubleshooting) |
| Type errors | Regenerate types | [Supabase CLI Guide](SUPABASE_CLI_GUIDE.md#generate-typescript-types) |
| Function deployment fails | Check Deno version | [Main README](../README.md#prerequisites) |

### Debug Mode

Enable debug logging in the browser client:

```javascript
// In fftBot-client.js
const CFG = {
  DEBUG: true  // Set to true for verbose logging
};
```

## 📖 Additional Resources

### External Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [Deno Manual](https://deno.land/manual)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)

### Community

- GitHub Issues - Bug reports and feature requests
- GitHub Discussions - Questions and community support

## 🆘 Getting Help

1. **Check the documentation** - Most questions are answered here
2. **Search existing issues** - Someone may have had the same problem
3. **Review the code** - The codebase is well-commented
4. **Ask for help** - Open a discussion or issue on GitHub

## 📝 Contributing to Documentation

Found an error or want to improve the docs?

1. Edit the relevant markdown file
2. Follow the [Contributing Guide](../CONTRIBUTING.md)
3. Submit a pull request

---

**Last Updated**: 2025-11-08  
**Version**: 2.0

