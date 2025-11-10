# Arin Bot v2 🤖 → Wingman Dating Helper 💬

A sophisticated AI chatbot powered by Supabase Edge Functions, now transformed into a **Wingman Dating Chat Helper** with Gemini 2.5 caching, intelligent conversation analysis, and personalized dating suggestions.

**New in v2**: Wingman dating assistant with AI-powered reply suggestions, conversation analysis, and coaching tips for online dating conversations.

## 🌟 Features

### Wingman Dating Helper (v2)
- **AI-Powered Suggestions**: Get personalized reply suggestions based on conversation context
- **Conversation Analysis**: Understand her vibe and the conversation flow
- **Coaching Tips**: Learn dating communication skills with actionable advice
- **Gemini 2.5 Caching**: Optimized API usage with explicit caching (75%+ cost reduction)
- **Chrome Extension**: Beautiful floating UI panel with draggable interface
- **Smart Message Detection**: Automatic detection of user and match messages
- **JSONB Indexing**: Optimized database queries for profile data

### Legacy Features (v1 - Still Available)
- **Multi-Provider LLM Support**: Seamlessly switches between OpenAI GPT-4 and Google Gemini
- **Intelligent Context Management**: Maintains conversation history and user summaries
- **Automatic Fallback**: Gracefully handles API failures by switching providers
- **Browser Client Integration**: Userscript for real-time chat monitoring and interaction
- **Configurable Personality**: YAML-based prompt and model configuration
- **Event Batching**: Efficient message processing with configurable batch sizes

## 📁 Project Structure

```
arin-bot-v2/
├── docs/                           # Documentation
│   ├── DATABASE_TABLES.md         # Database schema reference
│   ├── SCHEMA_VERIFICATION.md     # Schema verification guide
│   ├── SUPABASE_CLI_GUIDE.md      # Supabase CLI usage
│   └── SUPABASE_USAGE.md          # Supabase integration guide
├── scripts/                        # Utility scripts
│   ├── sql_queries/               # SQL query templates
│   ├── list-tables.ps1            # Database table listing
│   ├── test-connection.ps1        # Connection testing
│   └── verify-schema.ps1          # Schema verification
├── deploy.ps1                     # Safe deployment script
├── verify-project.ps1             # Project verification script
├── .project-id                    # Expected project ID
├── supabase/
│   ├── config.toml                # Supabase configuration
│   ├── migrations/                # Database migrations
│   │   └── 20251109000000_wingman_schema.sql  # Wingman schema
│   └── functions/
│       ├── _shared/               # Shared utilities (v2)
│       │   ├── supabaseClient.ts  # Supabase client
│       │   ├── geminiClient.ts    # Gemini client with caching
│       │   ├── schemas.ts         # Zod validation schemas
│       │   ├── prompts.ts         # Wingman prompt
│       │   └── utils.ts           # Helper functions
│       ├── chat-api-v2/           # Wingman Edge Function (v2)
│       │   ├── index.ts           # Main API handler
│       │   └── deno.json          # Deno configuration
│       └── chat-api/              # Legacy Edge Function (v1)
│           ├── config/            # YAML configurations
│           │   ├── models.yaml    # LLM model settings
│           │   └── prompts.yaml   # System prompts
│           ├── services/          # Service modules
│           │   ├── config/        # Config loader
│           │   └── llm/           # LLM clients
│           ├── index.ts           # Main API handler
│           └── deno.json          # Deno configuration
├── 📂 client/                     # Browser Client Scripts
│   └── fftBot-client.js           # Wingman console script (v2)
├── 📂 chrome-extension/           # Chrome Extension (v2)
│   ├── manifest.json              # Extension manifest
│   ├── content.js                 # Content script
│   ├── background.js              # Service worker
│   ├── floating-ui.css            # Panel styles
│   └── icons/                     # Extension icons
├── 📂 scripts/                    # Utility Scripts
│   ├── test-wingman-v2.ps1        # Test v2 endpoints
│   ├── deploy-wingman-v2.ps1      # Deploy v2
│   ├── verify-wingman-schema.ps1  # Verify schema
│   └── verify-wingman-imports.ps1 # Verify imports
├── 📂 docs/                       # Documentation
│   ├── WINGMAN_SCHEMA.md          # Wingman schema docs
│   └── WINGMAN_DEPLOYMENT.md      # Deployment guide
├── .vscode/                       # VS Code settings
├── .env                           # Environment variables (not in git)
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Deno](https://deno.land/) (v2.x) (for Edge Functions)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (installed via npm)
- Supabase account and project

**Note**: This project uses **cloud-only development** with transaction pooler. No Docker required.

### Quickstart (Cloud Development)

**Cloud-only workflow**: Work directly against your cloud Supabase project.

```bash
# 1. Install dependencies
npm install

# 2. Login to Supabase (one-time)
npm run supabase:login

# 3. Link to your project (one-time)
npm run supabase:link

# 4. Set up environment variables
# Create .env file with your project credentials
# See "Environment Variables" section below

# 5. Pull current schema
npm run supabase:pull

# 6. Generate TypeScript types
npm run supabase:types

# 7. Check project status
npm run supabase:status
```

### Installation (Detailed)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arin-bot-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Authenticate with Supabase CLI**
   ```bash
   # Login to Supabase (opens browser)
   npm run supabase:login
   
   # Or set ACCESS_TOKEN environment variable
   # Get token from: https://supabase.com/dashboard/account/tokens
   export SUPABASE_ACCESS_TOKEN=your_access_token_here
   ```

4. **Link to your project**
   ```bash
   # Link to your Supabase project
   npm run supabase:link
   # Project ref: opaxtxfxropmjrrqlewh
   ```

5. **Set up environment variables**
   
   Create `.env` file with:
   ```env
   # Supabase Project (from Dashboard → Settings → API)
   SUPABASE_URL=https://opaxtxfxropmjrrqlewh.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   
   # API Keys
   OPENAI_API_KEY=your_openai_key
   GEMINI_API_KEY=your_gemini_key
   ```
   
   **Important**:
   - Use **ANON_KEY** for app runtime (client-side operations)
   - Use **ACCESS_TOKEN** for CLI operations (set via `supabase login` or env var)
   - **Never commit** `.env` file to git

6. **Pull current schema**
   ```bash
   # Pull existing schema from cloud
   npm run supabase:pull
   ```

7. **Generate TypeScript types**
   ```bash
   # Generate types from cloud schema
   npm run supabase:types
   ```

### Development Workflow

#### Create and Apply Migrations

```bash
# 1. Create new migration
npm run supabase:migration:new add_feature_name

# 2. Edit migration file in supabase/migrations/

# 3. Push to cloud
npm run supabase:push

# 4. Regenerate types
npm run supabase:types
```

#### Generate Migration from Schema Changes

```bash
# Generate migration from database diff
npm run supabase:diff

# Review generated migration, then push
npm run supabase:push
```

#### Check Migration Status

```bash
# List all migrations
npm run supabase:migration:list
```

#### View Logs

```bash
# View cloud logs
npm run supabase:logs
```

#### Deploy Edge Functions

```bash
# Deploy specific function
npm run supabase:functions:deploy chat-api-v2

# Serve functions locally for testing
npm run supabase:functions:serve
```

### Environment Variables

#### CLI Authentication (ACCESS_TOKEN)

The Supabase CLI uses `ACCESS_TOKEN` for authentication:

- **Method 1**: Login via CLI (recommended)
  ```bash
  npm run supabase:login
  ```
  This stores the token securely in your system.

- **Method 2**: Environment variable
  ```bash
  # macOS/Linux
  export SUPABASE_ACCESS_TOKEN=your_access_token_here
  
  # Windows PowerShell
  $env:SUPABASE_ACCESS_TOKEN="your_access_token_here"
  
  # Windows CMD
  set SUPABASE_ACCESS_TOKEN=your_access_token_here
  ```

Get your access token from: https://supabase.com/dashboard/account/tokens

#### App Runtime (ANON_KEY)

Your application uses `SUPABASE_ANON_KEY` for runtime operations:

```env
SUPABASE_URL=https://opaxtxfxropmjrrqlewh.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

Get these from: Supabase Dashboard → Settings → API

#### Transaction Pooler

For database connections, use the **Transaction Pooler** connection string:

- **Port**: 5432 (transaction pooler)
- **Connection String**: Available in Dashboard → Settings → Database → Connection Pooling

**Note**: Use transaction pooler for better connection management and performance.

### Database Connection

This project uses the **transaction pooler** for database connections:

- **Port**: 5432
- **Connection String**: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
- **Mode**: Transaction (recommended for serverless)

Get connection string from: Supabase Dashboard → Settings → Database → Connection Pooling

See [docs/SUPABASE_CLOUD_WORKFLOW.md](docs/SUPABASE_CLOUD_WORKFLOW.md) for complete cloud workflow guide.

### 🛡️ Deployment Safety

**Important**: If you have multiple Supabase projects on your machine, always verify you're deploying to the correct project.

**Quick Verification:**
```bash
# Check current project
.\verify-project.ps1

# Safe deployment (verifies project first)
.\deploy.ps1
```

**Prevention Checklist:**
1. ✅ Am I in the right folder?
2. ✅ Does `supabase status` show the right project?
3. ✅ Does my `.env` match this project?

**This Project's ID**: `opaxtxfxropmjrrqlewh`

See [DEPLOYMENT_SAFETY.md](DEPLOYMENT_SAFETY.md) for detailed safety guidelines.

## 🔧 Configuration

### Model Configuration (`supabase/functions/chat-api/config/models.yaml`)

Configure LLM providers, model parameters, and feature flags:

```yaml
production:
  model: "gpt-4o-2024-08-06"
  temperature: 0.9
  max_completion_tokens: 500
  
experimental:
  model: "gemini-2.0-flash-exp"
  temperature: 0.9
  max_completion_tokens: 500

features:
  enable_ab_testing: false
  enable_prompt_caching: true
```

### Prompt Configuration (`supabase/functions/chat-api/config/prompts.yaml`)

Customize the bot's personality and response style:

```yaml
system_instructions:
  cached: true
  content: |
    === RESPONSE PSYCHOLOGY ===
    • MIRROR: Match their energy, length, and casualness
    • LISTEN: Directly respond to what they JUST said
    • INTRIGUE: Leave room for curiosity
    ...
```

## 💻 Development

### Local Development

1. **Start Supabase locally**
   ```bash
   supabase start
   ```

2. **Serve Edge Functions locally**
   ```bash
   supabase functions serve chat-api
   ```

3. **Test the API**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/chat-api \
     -H "Content-Type: application/json" \
     -d '{
       "botPlatformId": "test-bot",
       "roomPath": "/test-room",
       "events": [{"type": "message", "username": "user", "text": "hello"}]
     }'
   ```

### Database Management

- **List tables**: `.\scripts\list-tables.ps1`
- **Test connection**: `.\scripts\test-connection.ps1`
- **Verify schema**: `.\scripts\verify-schema.ps1`
- **Create migration**: `supabase migration new <name>`
- **Push migrations**: `supabase db push`

### Deployment

- **Verify project**: `.\verify-project.ps1`
- **Safe deployment**: `.\deploy.ps1`
- **Deploy function**: `.\deploy.ps1 -FunctionName chat-api`

### Browser Client

The browser userscript (`fftBot-client.js`) monitors chat messages and sends them to the Edge Function:

1. Install a userscript manager (Tampermonkey, Violentmonkey)
2. Load `client/fftBot-client.js`
3. Navigate to your chat platform
4. Type `hi/` to activate the bot

## 📊 Database Schema

The bot uses the following main tables:

- **`bots`**: Bot configurations and personalities
- **`rooms`**: Chat room information
- **`events`**: Message history
- **`summaries`**: Conversation summaries for context

See [docs/DATABASE_TABLES.md](docs/DATABASE_TABLES.md) for detailed schema information.

## 🔄 API Endpoints

### Wingman v2 Endpoints

#### POST `/v1/chat-api-v2/init`

Initialize Wingman for a user.

**Request:**
```json
{
  "platformId": "user-123",
  "username": "John Doe",
  "roomPath": "/room/123"
}
```

**Response:**
```json
{
  "conversationId": "uuid",
  "userId": "user-123",
  "status": "initialized"
}
```

#### POST `/v1/chat-api-v2/`

Get Wingman suggestions.

**Request:**
```json
{
  "conversationId": "uuid",
  "userId": "user-123",
  "girlId": "girl-456",
  "girlName": "Jane",
  "recentMessages": [
    {
      "sender": "girl",
      "text": "Hey! How are you?",
      "timestamp": 1234567890
    }
  ]
}
```

**Response:**
```json
{
  "analysis": {
    "her_last_message_feeling": "curious",
    "conversation_vibe": "warm and engaging",
    "recommended_goal": "build rapport"
  },
  "suggestions": [
    {
      "type": "Playful/Humorous",
      "text": "I'm doing great! Just finished work, how about you?",
      "rationale": "Shows interest and asks a follow-up question"
    }
  ],
  "wingman_tip": "Try to ask open-ended questions to keep the conversation flowing"
}
```

### Legacy v1 Endpoints

#### POST `/chat-api`

Process chat events and generate bot responses (legacy).

**Request:**
```json
{
  "botPlatformId": "bot-123",
  "roomPath": "/room/path",
  "events": [...]
}
```

**Response:**
```json
{
  "strategy": "ENGAGE",
  "messages": [...]
}
```

## 🧪 Testing

### Wingman v2 Testing

```powershell
# Test all endpoints
.\scripts\test-wingman-v2.ps1 -TestAll

# Test individual endpoints
.\scripts\test-wingman-v2.ps1 -TestInit
.\scripts\test-wingman-v2.ps1 -TestAnalysis

# Verify schema
.\scripts\verify-wingman-schema.ps1

# Verify imports
.\scripts\verify-wingman-imports.ps1
```

### Legacy v1 Testing

```bash
deno test --allow-all supabase/functions/chat-api/
```

## 📚 Documentation

### Wingman v2
- [Wingman Schema](docs/WINGMAN_SCHEMA.md) - Complete schema documentation
- [Wingman Deployment](docs/WINGMAN_DEPLOYMENT.md) - Deployment guide
- [Implementation Summary](WINGMAN_IMPLEMENTATION_SUMMARY.md) - Implementation status
- [Chrome Extension README](chrome-extension/README.md) - Extension documentation

### Legacy v1
- [Supabase CLI Guide](docs/SUPABASE_CLI_GUIDE.md) - Complete CLI reference
- [Database Tables](docs/DATABASE_TABLES.md) - Schema documentation
- [Supabase Usage](docs/SUPABASE_USAGE.md) - Integration patterns
- [Deployment Safety](DEPLOYMENT_SAFETY.md) - Prevent project mix-ups

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Supabase](https://supabase.com/)
- Powered by [OpenAI](https://openai.com/) and [Google Gemini](https://deepmind.google/technologies/gemini/)
- Runtime: [Deno](https://deno.land/)

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the [documentation](docs/)
- Review the [Supabase CLI Guide](docs/SUPABASE_CLI_GUIDE.md)

---

**Project Status**: Active Development 🚧

