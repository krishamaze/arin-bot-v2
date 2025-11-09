# Contributing to Arin Bot v2

Thank you for your interest in contributing to Arin Bot v2! This document provides guidelines and best practices for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) and npm (for Supabase CLI virtual environment)
- [Deno](https://deno.land/) v2.x
- Git
- A code editor (VS Code recommended)

**Note**: This project uses a local virtual environment for Supabase CLI, so no global installation is required.

### Initial Setup

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/arin-bot-v2.git
   cd arin-bot-v2
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/arin-bot-v2.git
   ```

4. **Set up Supabase CLI virtual environment**
   ```bash
   # Create virtual environment directory
   mkdir .venv_supabase
   cd .venv_supabase
   npm init -y
   npm install supabase --save-dev
   cd ..
   ```

5. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your development credentials
   ```

6. **Link to Supabase**
   ```bash
   npx --prefix .venv_supabase supabase login
   npx --prefix .venv_supabase supabase link --project-ref YOUR_PROJECT_REF
   ```

7. **Pull database schema**
   ```bash
   npx --prefix .venv_supabase supabase db pull
   ```

## 🔄 Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run local Supabase
supabase start

# Serve Edge Functions locally
supabase functions serve chat-api

# Run tests
deno test --allow-all supabase/functions/chat-api/

# Test manually
curl -X POST http://localhost:54321/functions/v1/chat-api \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

See [Commit Guidelines](#commit-guidelines) for commit message format.

### 5. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 7. Create a Pull Request

- Go to GitHub and create a Pull Request
- Fill out the PR template
- Link any related issues
- Wait for review

## 📁 Project Structure

```
arin-bot-v2/
├── docs/                    # Documentation files
├── scripts/                 # Utility scripts
│   ├── sql_queries/        # SQL templates
│   └── *.ps1               # PowerShell scripts
├── supabase/
│   ├── config.toml         # Supabase configuration
│   ├── migrations/         # Database migrations
│   └── functions/
│       └── chat-api/       # Main Edge Function
│           ├── config/     # YAML configurations
│           ├── services/   # Service modules
│           ├── index.ts    # Main handler
│           └── deno.json   # Deno config
└── .vscode/                # VS Code settings
```

### Key Files

- **`supabase/functions/chat-api/index.ts`**: Main API handler
- **`supabase/functions/chat-api/services/llm/`**: LLM provider implementations
- **`supabase/functions/chat-api/config/`**: Configuration files
- **`supabase/migrations/`**: Database schema migrations

## 💻 Coding Standards

### TypeScript/Deno

- Use TypeScript for all new code
- Follow Deno's style guide
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises chains

**Example:**

```typescript
/**
 * Fetches the last N messages from a room
 * @param supabase - Supabase client instance
 * @param botId - Bot UUID
 * @param roomId - Room UUID
 * @param limit - Number of messages to fetch
 * @returns Array of message events
 */
async function fetchLastMessages(
  supabase: SupabaseClient,
  botId: string,
  roomId: string,
  limit: number = 50
): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('bot_id', botId)
    .eq('room_id', roomId)
    .order('timestamp', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return data || [];
}
```

### YAML Configuration

- Use 2 spaces for indentation
- Add comments for complex configurations
- Keep configurations organized and readable

### SQL Migrations

- One migration per logical change
- Include both `up` and `down` migrations when possible
- Add comments explaining complex queries
- Test migrations before committing

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for all new features
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names

**Example:**

```typescript
Deno.test("fetchLastMessages - should return messages in descending order", async () => {
  const messages = await fetchLastMessages(supabase, botId, roomId, 10);
  
  for (let i = 1; i < messages.length; i++) {
    assert(messages[i-1].timestamp >= messages[i].timestamp);
  }
});

Deno.test("fetchLastMessages - should handle empty room", async () => {
  const messages = await fetchLastMessages(supabase, botId, emptyRoomId);
  assertEquals(messages.length, 0);
});
```

### Running Tests

```bash
# Run all tests
deno test --allow-all

# Run specific test file
deno test --allow-all supabase/functions/chat-api/services/llm/factory.test.ts

# Run with coverage
deno test --allow-all --coverage=coverage/
deno coverage coverage/
```

## 📝 Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
feat(llm): add Gemini fallback support

Implement automatic fallback to Gemini when OpenAI fails.
Includes retry logic and error handling.

Closes #123
```

```bash
fix(chat-api): handle null user platform IDs

Add validation to prevent crashes when platform ID is missing.
```

```bash
docs(readme): update installation instructions

Add missing step for environment variable setup.
```

## 🔍 Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow guidelines
- [ ] Branch is up to date with main

### PR Template

When creating a PR, include:

1. **Description**: What does this PR do?
2. **Motivation**: Why is this change needed?
3. **Testing**: How was this tested?
4. **Screenshots**: If applicable
5. **Related Issues**: Link to issues

### Review Process

1. At least one maintainer must approve
2. All CI checks must pass
3. No merge conflicts
4. Code review feedback addressed

### After Merge

- Delete your feature branch
- Update your local main branch
- Close related issues

## 🐛 Reporting Bugs

### Before Reporting

- Check existing issues
- Verify it's reproducible
- Gather relevant information

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. ...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., Windows 11]
- Deno version: [e.g., 2.0.0]
- Supabase CLI version: [e.g., 2.54.11]

**Additional Context**
Any other relevant information
```

## 💡 Feature Requests

We welcome feature requests! Please:

1. Check if it's already requested
2. Describe the feature clearly
3. Explain the use case
4. Provide examples if possible

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Deno Manual](https://deno.land/manual)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## ❓ Questions?

- Open a discussion on GitHub
- Check the [documentation](docs/)
- Review existing issues and PRs

---

Thank you for contributing to Arin Bot v2! 🎉

