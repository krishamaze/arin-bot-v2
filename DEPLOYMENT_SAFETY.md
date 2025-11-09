# Deployment Safety Guide

## The Problem

When you have multiple Supabase projects on the same machine, deploying to the wrong one wastes time and causes confusion. This guide helps prevent project mix-ups.

## Quick Prevention Rules

### 1. Always Verify Before Deploying

```bash
# Quick check - takes 2 seconds
.\verify-project.ps1

# Or manually:
supabase status
```

Look for your project ID in the output.  
**Expected for this project**: `opaxtxfxropmjrrqlewh`

### 2. Use the Safe Deployment Script

```bash
# Instead of:
supabase functions deploy chat-api

# Use the safe script:
.\deploy.ps1
```

The script automatically:
- Verifies the correct project is linked
- Shows clear error messages if wrong project
- Provides fix instructions
- Uses explicit project ref for deployment

### 3. Keep Each Project in Its Own Folder

```
d:\arin-bot-v2\        ← Project opaxtxfxropmjrrqlewh
d:\aider-helper\       ← Project tuspvfrsbkkdmmqeqtae (example)
```

**Never work on both projects in the same folder.**

### 4. Check the Link When Switching Projects

```bash
# When you open a project folder, run:
.\verify-project.ps1

# Wrong project? Fix it:
supabase unlink
supabase link --project-ref opaxtxfxropmjrrqlewh
```

### 5. Use Explicit Project Refs in Commands

```bash
# Safe: Explicit project ref
supabase functions deploy chat-api --project-ref opaxtxfxropmjrrqlewh

# Risky: Uses linked project (might be wrong)
supabase functions deploy chat-api
```

## Scripts

### `deploy.ps1` - Safe Deployment Script

Automatically verifies project before deploying:

```powershell
.\deploy.ps1

# Deploy specific function
.\deploy.ps1 -FunctionName chat-api

# Skip verification (not recommended)
.\deploy.ps1 -SkipVerification
```

**Features:**
- ✅ Verifies correct project is linked
- ✅ Reads project ID from `.project-id` file
- ✅ Shows clear error messages
- ✅ Provides fix instructions
- ✅ Uses explicit project ref for deployment

### `verify-project.ps1` - Project Verification

Quick check of project status:

```powershell
.\verify-project.ps1
```

**Shows:**
- Current linked project (if detectable)
- Expected project ID
- Deployment status
- Manual verification steps

## Project Identification

### `.project-id` File

This file stores the expected project ID:

```
opaxtxfxropmjrrqlewh
```

The deployment script reads this file automatically.  
If the file doesn't exist, the script uses the default from the script.

### Manual Verification

1. **Check Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/opaxtxfxropmjrrqlewh
   ```

2. **Check deployed functions:**
   ```bash
   supabase functions list
   ```

3. **Check project link:**
   ```bash
   supabase link --help
   ```

## Quick Mental Checklist

Before **any** deployment:

1. ✅ **Am I in the right folder?**
   - Check the current directory
   - Verify it's the correct project folder

2. ✅ **Does `supabase status` show the right project?**
   - Run: `supabase status` or `.\verify-project.ps1`
   - Verify project ID matches: `opaxtxfxropmjrrqlewh`

3. ✅ **Does my `.env` match this project?**
   - Check `SUPABASE_URL` in `.env`
   - Should contain: `opaxtxfxropmjrrqlewh`

**Remember:** Taking 10 seconds to verify saves 10 minutes of fixing mistakes.

## Common Scenarios

### Scenario 1: Wrong Project Linked

**Symptoms:**
- Deployment goes to wrong project
- Functions appear in different dashboard

**Fix:**
```bash
supabase unlink
supabase link --project-ref opaxtxfxropmjrrqlewh
.\deploy.ps1
```

### Scenario 2: Multiple Projects on Same Machine

**Prevention:**
- Keep each project in separate folder
- Use `.project-id` file in each project
- Always run `.\verify-project.ps1` before deploying
- Use `.\deploy.ps1` instead of direct CLI commands

### Scenario 3: Switching Between Projects

**When switching:**
1. Close current terminal/workspace
2. Open new project folder
3. Run `.\verify-project.ps1`
4. Verify project ID is correct
5. Proceed with deployment

## Emergency Fixes

### Deployed to Wrong Project?

1. **Stop immediately** - Don't deploy more
2. **Verify correct project:**
   ```bash
   .\verify-project.ps1
   ```
3. **Fix the link:**
   ```bash
   supabase unlink
   supabase link --project-ref opaxtxfxropmjrrqlewh
   ```
4. **Redeploy to correct project:**
   ```bash
   .\deploy.ps1
   ```

### Can't Determine Linked Project?

1. **Check Supabase Dashboard:**
   - Look at function deployment timestamps
   - Check which project received recent deployments

2. **Check function URLs:**
   - Compare function URLs in code
   - Match with project dashboard

3. **Unlink and relink:**
   ```bash
   supabase unlink
   supabase link --project-ref opaxtxfxropmjrrqlewh
   ```

## Best Practices

1. **Always use `.\deploy.ps1`** - Never deploy directly with CLI
2. **Run `.\verify-project.ps1` first** - Quick check before any deployment
3. **Keep `.project-id` file** - Helps scripts identify correct project
4. **Use explicit project refs** - When using CLI directly, always specify `--project-ref`
5. **Separate project folders** - Never work on multiple projects in same folder
6. **Verify after switching** - Always verify when switching between projects

## Integration with CI/CD

If using CI/CD, always specify project ref explicitly:

```yaml
# GitHub Actions example
- name: Deploy function
  run: |
    supabase functions deploy chat-api --project-ref opaxtxfxropmjrrqlewh
```

Never rely on linked projects in CI/CD environments.

## Troubleshooting

### Script Says Wrong Project

**Check:**
1. Is `.project-id` file correct?
2. Is Supabase CLI linked to correct project?
3. Are you in the correct project folder?

**Fix:**
```bash
# Update .project-id if needed
echo "opaxtxfxropmjrrqlewh" > .project-id

# Relink project
supabase unlink
supabase link --project-ref opaxtxfxropmjrrqlewh

# Verify
.\verify-project.ps1
```

### Script Can't Detect Project

**Possible causes:**
- Project not linked
- Supabase CLI not installed
- Not logged in to Supabase

**Fix:**
```bash
# Login
supabase login

# Link project
supabase link --project-ref opaxtxfxropmjrrqlewh

# Verify
.\verify-project.ps1
```

## Summary

**Golden Rule**: Always verify before deploying.

**Quick Commands:**
```bash
# Verify project
.\verify-project.ps1

# Safe deployment
.\deploy.ps1
```

**This Project ID**: `opaxtxfxropmjrrqlewh`

**Dashboard**: https://supabase.com/dashboard/project/opaxtxfxropmjrrqlewh

---

**Remember**: A few seconds of verification prevents hours of debugging!

