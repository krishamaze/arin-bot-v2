# Project Structure

This document provides a complete overview of the Arin Bot v2 repository structure.

## 📁 Directory Tree

```
arin-bot-v2/
│
├── 📄 Root Configuration Files
│   ├── .env                      # Environment variables (not in git)
│   ├── .env.example              # Environment variables template
│   ├── .gitignore                # Git ignore rules
│   ├── README.md                 # Main project documentation
│   ├── CONTRIBUTING.md           # Contribution guidelines
│   ├── CHANGELOG.md              # Version history and changes
│   ├── LICENSE                   # MIT License
│   └── PROJECT_STRUCTURE.md      # This file
│
├── 📂 .vscode/                   # VS Code Configuration
│   ├── settings.json             # Deno and TypeScript settings
│   └── extensions.json           # Recommended extensions
│
├── 📂 docs/                      # Documentation
│   ├── README.md                 # Documentation index
│   ├── DATABASE_TABLES.md        # Database schema reference
│   ├── SCHEMA_VERIFICATION.md    # Schema verification guide
│   ├── SUPABASE_CLI_GUIDE.md     # Complete Supabase CLI reference
│   └── SUPABASE_USAGE.md         # Supabase integration patterns
│
├── 📂 scripts/                   # Utility Scripts
│   ├── README.md                 # Scripts documentation
│   ├── test-connection.ps1       # Test database connectivity
│   ├── verify-schema.ps1         # Verify and pull database schema
│   ├── list-tables.ps1           # List database tables
│   ├── list-tables-sql.ps1       # Detailed table information
│   └── sql_queries/              # SQL Query Templates
│       ├── 01_list_tables.sql
│       ├── 02_tables_with_sizes.sql
│       ├── 03_detailed_table_info.sql
│       └── 04_tables_with_columns.sql
│
└── 📂 supabase/                  # Supabase Project
    ├── config.toml               # Supabase configuration
    │
    ├── 📂 migrations/            # Database Migrations
    │   └── 20251108072836_remote_schema.sql
    │
    └── 📂 functions/             # Edge Functions
        └── 📂 chat-api/          # Main Chat API Function
            ├── index.ts          # Main API handler
            ├── deno.json         # Deno configuration
            ├── .npmrc            # NPM configuration
            ├── fftBot-client.js  # Browser userscript client
            │
            ├── 📂 config/        # Configuration Files
            │   ├── models.yaml   # LLM model configurations
            │   └── prompts.yaml  # System prompts and personality
            │
            └── 📂 services/      # Service Modules
                ├── 📂 config/    # Configuration Service
                │   ├── loader.ts # YAML config loader
                │   └── types.ts  # Config type definitions
                │
                └── 📂 llm/       # LLM Service
                    ├── factory.ts      # LLM provider factory
                    ├── interface.ts    # LLM client interface
                    ├── openaiClient.ts # OpenAI implementation
                    └── geminiClient.ts # Gemini implementation
```

## 📊 File Categories

### Configuration Files (Root Level)

| File | Purpose | In Git? |
|------|---------|---------|
| `.env` | Environment variables with secrets | ❌ No |
| `.env.example` | Template for environment setup | ✅ Yes |
| `.gitignore` | Files to exclude from git | ✅ Yes |
| `README.md` | Main project documentation | ✅ Yes |
| `CONTRIBUTING.md` | Contribution guidelines | ✅ Yes |
| `CHANGELOG.md` | Version history | ✅ Yes |
| `LICENSE` | MIT License | ✅ Yes |
| `PROJECT_STRUCTURE.md` | This file | ✅ Yes |

### Documentation (`docs/`)

| File | Description |
|------|-------------|
| `README.md` | Documentation index and quick reference |
| `DATABASE_TABLES.md` | Complete database schema documentation |
| `SCHEMA_VERIFICATION.md` | Schema verification procedures |
| `SUPABASE_CLI_GUIDE.md` | Comprehensive Supabase CLI guide |
| `SUPABASE_USAGE.md` | Supabase integration patterns |

### Scripts (`scripts/`)

| File | Type | Purpose |
|------|------|---------|
| `README.md` | Doc | Scripts documentation |
| `test-connection.ps1` | PowerShell | Test database connection |
| `verify-schema.ps1` | PowerShell | Verify/pull database schema |
| `list-tables.ps1` | PowerShell | List database tables |
| `list-tables-sql.ps1` | PowerShell | Detailed table info |
| `sql_queries/*.sql` | SQL | Reusable query templates |

### Edge Function (`supabase/functions/chat-api/`)

| File/Directory | Purpose |
|----------------|---------|
| `index.ts` | Main API request handler |
| `deno.json` | Deno runtime configuration |
| `fftBot-client.js` | Browser userscript for chat monitoring |
| `config/models.yaml` | LLM provider and model settings |
| `config/prompts.yaml` | Bot personality and system prompts |
| `services/config/` | Configuration loading service |
| `services/llm/` | LLM provider implementations |

## 🔍 Key Directories Explained

### `/docs` - Documentation Hub

Central location for all project documentation. Includes:
- Setup guides
- API references
- Database schema
- Best practices

**Why separate?** Keeps documentation organized and easy to find.

### `/scripts` - Utility Scripts

PowerShell scripts and SQL queries for:
- Database management
- Schema verification
- Development tasks
- Testing

**Why separate?** Prevents clutter in root directory and groups related utilities.

### `/supabase` - Supabase Project

Contains all Supabase-specific files:
- Configuration (`config.toml`)
- Database migrations
- Edge Functions

**Structure follows Supabase conventions** for easy deployment and management.

### `/supabase/functions/chat-api` - Main Application

The core chatbot logic organized by responsibility:

```
chat-api/
├── index.ts              # Entry point - handles HTTP requests
├── config/               # External configuration (YAML)
└── services/             # Business logic modules
    ├── config/           # Config loading
    └── llm/              # LLM provider abstraction
```

**Benefits:**
- Clear separation of concerns
- Easy to test individual components
- Scalable architecture

## 📦 Dependencies

### Runtime Dependencies

- **Deno** (v2.x) - Runtime for Edge Functions
- **Supabase** - Backend platform
- **PostgreSQL** - Database

### Development Dependencies

- **Supabase CLI** - Local development and deployment
- **PowerShell** - Utility scripts
- **PostgreSQL Client** - Database access

### External APIs

- **OpenAI API** - Primary LLM provider
- **Google Gemini API** - Fallback LLM provider

## 🚀 Quick Navigation

### I want to...

| Task | Go to |
|------|-------|
| Understand the project | [`README.md`](README.md) |
| Set up development environment | [`README.md#getting-started`](README.md#getting-started) |
| Contribute code | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Check database schema | [`docs/DATABASE_TABLES.md`](docs/DATABASE_TABLES.md) |
| Use Supabase CLI | [`docs/SUPABASE_CLI_GUIDE.md`](docs/SUPABASE_CLI_GUIDE.md) |
| Run utility scripts | [`scripts/README.md`](scripts/README.md) |
| Configure the bot | [`supabase/functions/chat-api/config/`](supabase/functions/chat-api/config/) |
| Modify LLM logic | [`supabase/functions/chat-api/services/llm/`](supabase/functions/chat-api/services/llm/) |
| See version history | [`CHANGELOG.md`](CHANGELOG.md) |

## 🎯 Design Principles

### 1. **Separation of Concerns**
- Documentation separate from code
- Scripts separate from application logic
- Configuration separate from implementation

### 2. **Convention Over Configuration**
- Follows Supabase project structure
- Standard directory names (`docs/`, `scripts/`)
- Clear file naming conventions

### 3. **Developer Experience**
- Comprehensive documentation
- Example files (`.env.example`)
- Utility scripts for common tasks
- Clear project structure

### 4. **Maintainability**
- Modular service architecture
- Type-safe TypeScript code
- Version-controlled migrations
- Documented changes (CHANGELOG)

## 📈 Growth Path

As the project grows, consider:

### Future Directories

```
arin-bot-v2/
├── tests/                # Dedicated test directory
├── tools/                # Development tools
├── examples/             # Usage examples
└── benchmarks/           # Performance benchmarks
```

### Future Documentation

- API documentation (auto-generated)
- Architecture decision records (ADRs)
- Deployment guides
- Troubleshooting guides

## 🔄 Maintenance

### Regular Tasks

- **Update CHANGELOG.md** when releasing new versions
- **Review .gitignore** when adding new tools/dependencies
- **Update documentation** when changing APIs or workflows
- **Clean up old migrations** periodically
- **Archive old backup files** (none currently, removed during organization)

### File Lifecycle

1. **Development** → Create in appropriate directory
2. **Documentation** → Add to relevant README
3. **Version Control** → Commit with clear message
4. **Deployment** → Deploy via Supabase CLI
5. **Maintenance** → Update as needed
6. **Deprecation** → Document in CHANGELOG, remove when safe

---

**Last Updated**: 2025-11-08  
**Version**: 2.0  
**Maintained By**: Project Contributors

