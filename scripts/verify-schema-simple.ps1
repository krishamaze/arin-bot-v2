# Simple schema verification using Supabase CLI
Write-Host "Verifying Wingman Schema" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Check if we can query the database
Write-Host "Checking if tables exist..." -ForegroundColor Yellow

# Use Supabase CLI to query schema
$tables = @("users", "conversations", "messages", "bot_suggestions")

foreach ($table in $tables) {
    Write-Host "Checking table: $table" -ForegroundColor Gray
    
    # Try to get table info using Supabase CLI
    $result = supabase db remote exec "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table';" 2>&1
    
    if ($result -match "1" -or $result -match $table) {
        Write-Host "✅ Table '$table' exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Could not verify table '$table'" -ForegroundColor Yellow
        Write-Host "   Result: $result" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Schema verification complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: For detailed verification, use Supabase Dashboard SQL Editor:" -ForegroundColor Yellow
Write-Host "https://supabase.com/dashboard/project/opaxtxfxropmjrrqlewh/sql" -ForegroundColor White

