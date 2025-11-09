# Arin Bot v2 🤖

A sophisticated AI chatbot powered by Supabase Edge Functions with multi-provider LLM support (OpenAI & Google Gemini). The bot features intelligent conversation management, context-aware responses, and automatic fallback mechanisms.

## 🌟 Features

- **Multi-Provider LLM Support**: Seamlessly switches between OpenAI GPT-4 and Google Gemini
- **Intelligent Context Management**: Maintains conversation history and user summaries
- **Automatic Fallback**: Gracefully handles API failures by switching providers
- **Browser Client Integration**: Userscript for real-time chat monitoring and interaction
- **Configurable Personality**: YAML-based prompt and model configuration
- **Event Batching**: Efficient message processing with configurable batch sizes
- **Prompt Caching**: Optimized API usage with intelligent caching strategies

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
│   └── functions/
│       └── chat-api/              # Main Edge Function
│           ├── config/            # YAML configurations
│           │   ├── models.yaml    # LLM model settings
│           │   └── prompts.yaml   # System prompts
│           ├── services/          # Service modules
│           │   ├── config/        # Config loader
│           │   └── llm/           # LLM clients
│           ├── fftBot-client.js   # Browser userscript
│           ├── index.ts           # Main API handler
│           └── deno.json          # Deno configuration
├── .vscode/                       # VS Code settings
├── .env                           # Environment variables (not in git)
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

## 🚀 Getting Started

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) (v2.54.11+)
- [Deno](https://deno.land/) (v2.x)
- Node.js (for package management)
- PostgreSQL database (via Supabase)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arin-bot-v2
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

   Required variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key
   - `OPENAI_API_KEY`: OpenAI API key
   - `GEMINI_API_KEY`: Google Gemini API key

3. **Link to Supabase project**
   ```bash
   supabase login
   supabase link --project-ref opaxtxfxropmjrrqlewh
   ```

4. **Pull database schema**
   ```bash
   supabase db pull
   ```

5. **Deploy Edge Functions**
   ```bash
   supabase functions deploy chat-api
   ```

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
2. Load `supabase/functions/chat-api/fftBot-client.js`
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

### POST `/chat-api`

Process chat events and generate bot responses.

**Request:**
```json
{
  "botPlatformId": "bot-123",
  "roomPath": "/room/path",
  "events": [
    {
      "type": "message",
      "username": "user1",
      "platformId": "user-123",
      "text": "Hello!",
      "timestamp": 1234567890
    }
  ]
}
```

**Response:**
```json
{
  "strategy": "ENGAGE",
  "messages": [
    {
      "text": "hey! how's it going?",
      "delayMs": 1500
    }
  ]
}
```

## 🧪 Testing

Run tests for the Edge Function:

```bash
deno test --allow-all supabase/functions/chat-api/
```

## 📚 Documentation

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

