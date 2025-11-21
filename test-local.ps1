# Local Testing Script for AWS Lambda Functions
# Usage: .\test-local.ps1 <function-name>
# Example: .\test-local.ps1 ListContactsFunction

param(
    [Parameter(Mandatory=$true)]
    [string]$FunctionName
)

# Set environment variables
$env:CONTACTS_TABLE_NAME = "Contacts"
$env:AYAHS_TABLE_NAME = "Ayahs"
$env:GMAIL_SECRET_ID = "gmail/ayah-mailer"
$env:MAIL_FROM = "harisxstudy@gmail.com"
$env:EMAIL_SUBJECT = "Random Ayah"
$env:HTTP_API_URL = "http://127.0.0.1:3000"

Write-Host "Testing $FunctionName..." -ForegroundColor Cyan
Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "  CONTACTS_TABLE_NAME = $env:CONTACTS_TABLE_NAME"
Write-Host "  AYAHS_TABLE_NAME = $env:AYAHS_TABLE_NAME"
Write-Host "  GMAIL_SECRET_ID = $env:GMAIL_SECRET_ID"
Write-Host "  MAIL_FROM = $env:MAIL_FROM"
Write-Host "  EMAIL_SUBJECT = $env:EMAIL_SUBJECT"
Write-Host "  HTTP_API_URL = $env:HTTP_API_URL"
Write-Host ""

# Build first
Write-Host "Building SAM application..." -ForegroundColor Yellow
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Determine event file
$eventFile = $null
switch ($FunctionName) {
    "AddContactFunction" { $eventFile = "events/add-contact.json" }
    "SendContactFunction" { $eventFile = "events/send-contact.json" }
    "DeleteContactFunction" { $eventFile = "events/delete-contact.json" }
    "SendDirectFunction" { $eventFile = "events/send-direct.json" }
    "UnsubscribeFunction" { $eventFile = "events/unsubscribe.json" }
}

# Invoke function
Write-Host "Invoking $FunctionName..." -ForegroundColor Yellow
if ($eventFile -and (Test-Path $eventFile)) {
    sam local invoke $FunctionName --env-vars env.json --event $eventFile
} else {
    sam local invoke $FunctionName --env-vars env.json
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nTest completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nTest failed!" -ForegroundColor Red
    exit 1
}

