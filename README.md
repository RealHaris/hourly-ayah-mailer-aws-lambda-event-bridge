## Quran Hourly Ayah Mailer (AWS SAM, Node.js)

Hourly Lambda fetches a random Quran ayah (Arabic + English), stores it in DynamoDB, and emails all contacts using Gmail (app password). Includes HTTP APIs to manage contacts and manually trigger sends.

### Architecture
- EventBridge Rule (every hour) → Lambda `ScheduledSendFunction`
- Quran API: `https://api.alquran.cloud`
- Data:
  - DynamoDB `Contacts` (pk: `id`, GSI: `EmailIndex` on `email`)
  - DynamoDB `Ayahs`    (pk: `id`)
- Email: Gmail SMTP via Nodemailer. Gmail credentials are stored in AWS Secrets Manager (`gmail/ayah-mailer`).
- HTTP API (API Gateway HTTP API) endpoints:
  - POST `/send/all`
  - POST `/send/contact` (by contact id in body)
  - POST `/send/direct` (by raw email in body)
  - POST `/contacts`
  - DELETE `/contacts/{id}`
  - GET `/contacts`
  - GET `/unsubscribe?id={id}`

### Prerequisites
- AWS CLI, SAM CLI, Node.js 20
- AWS account/credentials configured (IAM user or SSO)
- Docker Desktop (for local testing with SAM Local)

### Local Testing

**How environment variables work**: They're automatically set from `template.yaml` during deployment - no `.env` file needed! See [LOCAL_TESTING.md](LOCAL_TESTING.md) for details. During deployment we also expose `HTTP_API_URL` to functions so emails can include a working unsubscribe link.

**Quick local test**:
```powershell
# Build
sam build

# Test a function locally (requires AWS credentials and real DynamoDB tables)
sam local invoke ListContactsFunction --env-vars env.json

# Or run local API server
sam local start-api --env-vars env.json
```

See [LOCAL_TESTING.md](LOCAL_TESTING.md) for complete local testing guide.

### Quick start (PowerShell)
Set your values:
```powershell
$Region   = "us-east-1"
$Stack    = "quran-hourly-mailer"
$MailFrom = "you@gmail.com"
$Proj     = "D:\apps\wrok\extras\aws-lambda"
```

Install tools (if needed):
```powershell
winget install -e --id Amazon.AWSCLI --source winget --accept-source-agreements --accep-package-agreements
winget install -e --id AWS.AWSSAMCLI --source winget --accept-source-agreements --accept-package-agreements
winget install -e --id OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements
```

Verify:
```powershell
aws --version
sam --version
node -v
npm -v
```

Configure AWS (one of):
```powershell
# A) Access keys
aws configure set region $Region
aws configure set aws_access_key_id "YOUR_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "YOUR_SECRET_ACCESS_KEY"

# B) SSO
aws configure sso
aws sso login
```

Install deps:
```powershell
Set-Location $Proj
npm ci --omit=dev
```

Create/Update Gmail Secrets Manager secret:
```powershell
# First-time create:
$AppPassword = "YOUR_APP_PASSWORD"   # use your Gmail app password
$SecretJson = @{ username=$MailFrom; app_password=$AppPassword } | ConvertTo-Json -Compress
aws secretsmanager create-secret --name "gmail/ayah-mailer" --secret-string $SecretJson --region $Region

# If exists, update:
# aws secretsmanager put-secret-value --secret-id "gmail/ayah-mailer" --secret-string $SecretJson --region $Region
```

Build and deploy:
```powershell
sam build
sam deploy `
  --stack-name $Stack `
  --region $Region `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --no-confirm-changeset `
  --parameter-overrides "GmailSecretId=gmail/ayah-mailer" "MailFrom=$MailFrom"
```

Get API URL:
```powershell
$StackDesc = aws cloudformation describe-stacks --stack-name $Stack --region $Region | ConvertFrom-Json
$ApiUrl = ($StackDesc.Stacks[0].Outputs | Where-Object { $_.OutputKey -eq 'HttpApiUrl' }).OutputValue
$ApiUrl
```

### API quick tests (PowerShell)
```powershell
# Add contact
$body = @{ email="recipient@example.com"; name="Recipient" } | ConvertTo-Json
$created = Invoke-RestMethod -Method POST -Uri "$ApiUrl/contacts" -ContentType "application/json" -Body $body
$id = $created.id

# List contacts
Invoke-RestMethod -Uri "$ApiUrl/contacts"

# Send to one contact (by ID)
$body = @{ id="$id" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "$ApiUrl/send/contact" -ContentType "application/json" -Body $body

# Send direct (by email)
$body = @{ email="recipient@example.com" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "$ApiUrl/send/direct" -ContentType "application/json" -Body $body

# Send to all contacts
Invoke-RestMethod -Method POST -Uri "$ApiUrl/send/all"

# Unsubscribe by id (simulates clicking the link in email)
Invoke-RestMethod -Uri "$ApiUrl/unsubscribe?id=$id"
# Remove a contact
Invoke-RestMethod -Method DELETE -Uri "$ApiUrl/contacts/$id"
```

### API quick tests (cURL)
```bash
# Set your live base URL
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"

# List contacts
curl "$BASE_URL/contacts"

# Add contact
CREATE=$(curl -s -X POST "$BASE_URL/contacts" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com","name":"Recipient"}')
ID=$(echo "$CREATE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

# Send to one contact (by ID)
curl -s -X POST "$BASE_URL/send/contact" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$ID\"}"

# Send direct (by email)
curl -s -X POST "$BASE_URL/send/direct" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com"}'

# Send to all contacts
curl -X POST "$BASE_URL/send/all"

# Unsubscribe by id
curl "$BASE_URL/unsubscribe?id=$ID"
# Remove a contact
curl -X DELETE "$BASE_URL/contacts/$ID"
```

### Deploy new changes
```powershell
Set-Location $Proj
sam build
sam deploy `
  --stack-name $Stack `
  --region $Region `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --no-confirm-changeset `
  --parameter-overrides "GmailSecretId=gmail/ayah-mailer" "MailFrom=$MailFrom"
```

### View EventBridge rule and logs
```powershell
# List EventBridge rules in the stack's region
aws events list-rules --region $Region

# Get Scheduled Lambda name from stack resources
$Res = aws cloudformation describe-stack-resources --stack-name $Stack --region $Region | ConvertFrom-Json
$ScheduledFn = ($Res.StackResources | Where-Object { $_.LogicalResourceId -eq 'ScheduledSendFunction' }).PhysicalResourceId

# Tail last hour logs from scheduled function
aws logs tail "/aws/lambda/$ScheduledFn" --region $Region --since 1h
```

### View current DynamoDB data
```powershell
# List tables
aws dynamodb list-tables --region $Region

# Scan Contacts
aws dynamodb scan --table-name Contacts --region $Region

# Scan Ayahs
aws dynamodb scan --table-name Ayahs --region $Region
```

### See serverless (stack) status
```powershell
# Describe stack status and outputs
aws cloudformation describe-stacks --stack-name $Stack --region $Region

# List stack resources
aws cloudformation describe-stack-resources --stack-name $Stack --region $Region
```

### View each Lambda’s logs
```powershell
$Res = aws cloudformation describe-stack-resources --stack-name $Stack --region $Region | ConvertFrom-Json
$FnIds = @(
  'ScheduledSendFunction',
  'SendAllFunction',
  'SendContactFunction',
  'AddContactFunction',
  'DeleteContactFunction',
  'ListContactsFunction'
)
foreach ($id in $FnIds) {
  $fn = ($Res.StackResources | Where-Object { $_.LogicalResourceId -eq $id }).PhysicalResourceId
  if ($fn) {
    Write-Host "=== $id ($fn) ==="
    aws logs tail "/aws/lambda/$fn" --region $Region --since 1h
  }
}
```

### Clean up
```powershell
sam delete --stack-name $Stack --region $Region
```


