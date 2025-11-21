# Local Testing Guide

## How Environment Variables Work in AWS

When you deploy with SAM, environment variables are **automatically injected** into your Lambda functions from the `template.yaml` file:

1. **In `template.yaml`** (lines 10-16):
   ```yaml
   Globals:
     Function:
       Environment:
         Variables:
           CONTACTS_TABLE_NAME: !Ref ContactsTable  # DynamoDB table name
           AYAHS_TABLE_NAME: !Ref AyahsTable        # DynamoDB table name
           GMAIL_SECRET_ID: !Ref GmailSecretId      # From Parameters
           MAIL_FROM: !Ref MailFrom                 # From Parameters
           EMAIL_SUBJECT: !Ref EmailSubject         # From Parameters
   ```

2. **When Lambda runs**, these become `process.env.CONTACTS_TABLE_NAME`, etc.

3. **Gmail credentials** are stored in **AWS Secrets Manager** (not env vars). The code fetches them at runtime using the `GMAIL_SECRET_ID` env var.

**No `.env` file needed** - everything is configured in CloudFormation/SAM!

---

## Local Testing Setup

### Option 1: SAM Local (Recommended)

SAM Local runs your functions locally and can connect to real AWS services (DynamoDB, Secrets Manager).

#### Prerequisites
- Docker Desktop running (SAM Local uses Docker)
- AWS credentials configured (`aws configure`)
- Real DynamoDB tables exist in AWS (or use DynamoDB Local)

#### Step 1: Set up environment variables

Create a file `env.json` for local testing:

```json
{
  "ListContactsFunction": {
    "CONTACTS_TABLE_NAME": "Contacts",
    "AYAHS_TABLE_NAME": "Ayahs",
    "GMAIL_SECRET_ID": "gmail/ayah-mailer",
    "MAIL_FROM": "harisxstudy@gmail.com",
    "EMAIL_SUBJECT": "Random Ayah"
  },
  "AddContactFunction": {
    "CONTACTS_TABLE_NAME": "Contacts",
    "AYAHS_TABLE_NAME": "Ayahs",
    "GMAIL_SECRET_ID": "gmail/ayah-mailer",
    "MAIL_FROM": "harisxstudy@gmail.com",
    "EMAIL_SUBJECT": "Random Ayah"
  },
  "DeleteContactFunction": {
    "CONTACTS_TABLE_NAME": "Contacts",
    "AYAHS_TABLE_NAME": "Ayahs",
    "GMAIL_SECRET_ID": "gmail/ayah-mailer",
    "MAIL_FROM": "harisxstudy@gmail.com",
    "EMAIL_SUBJECT": "Random Ayah"
  },
  "SendContactFunction": {
    "CONTACTS_TABLE_NAME": "Contacts",
    "AYAHS_TABLE_NAME": "Ayahs",
    "GMAIL_SECRET_ID": "gmail/ayah-mailer",
    "MAIL_FROM": "harisxstudy@gmail.com",
    "EMAIL_SUBJECT": "Random Ayah"
  },
  "SendAllFunction": {
    "CONTACTS_TABLE_NAME": "Contacts",
    "AYAHS_TABLE_NAME": "Ayahs",
    "GMAIL_SECRET_ID": "gmail/ayah-mailer",
    "MAIL_FROM": "harisxstudy@gmail.com",
    "EMAIL_SUBJECT": "Random Ayah"
  },
  "ScheduledSendFunction": {
    "CONTACTS_TABLE_NAME": "Contacts",
    "AYAHS_TABLE_NAME": "Ayahs",
    "GMAIL_SECRET_ID": "gmail/ayah-mailer",
    "MAIL_FROM": "harisxstudy@gmail.com",
    "EMAIL_SUBJECT": "Random Ayah"
  }
}
```

#### Step 2: Test individual functions

```powershell
# Build first
sam build

# Test ListContactsFunction
sam local invoke ListContactsFunction --env-vars env.json

# Test AddContactFunction (with event)
sam local invoke AddContactFunction --env-vars env.json --event events/add-contact.json

# Test SendAllFunction
sam local invoke SendAllFunction --env-vars env.json

# Test ScheduledSendFunction
sam local invoke ScheduledSendFunction --env-vars env.json
```

#### Step 3: Run local API server

```powershell
# Start local API Gateway
sam local start-api --env-vars env.json

# In another terminal, test endpoints:
# GET http://localhost:3000/contacts
# POST http://localhost:3000/contacts
# etc.
```

#### Test with cURL against local API

```bash
# When sam local start-api is running
BASE_URL="http://127.0.0.1:3000"

# List contacts
curl "$BASE_URL/contacts"

# Add contact
curl -X POST "$BASE_URL/contacts" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Send to one contact
curl -X POST "$BASE_URL/send/contact" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Send to all contacts
curl -X POST "$BASE_URL/send/all"

# Remove a contact
curl -X DELETE "$BASE_URL/contacts/test@example.com"
```

**Note**: SAM Local will use your AWS credentials to connect to real DynamoDB and Secrets Manager. Make sure:
- Your AWS credentials are configured (`aws configure`)
- The DynamoDB tables exist in your AWS account
- The Secrets Manager secret exists

---

### Option 2: Direct Node.js Testing (Without SAM)

For quick testing without Docker, you can run handlers directly with Node.js.

#### Step 1: Create a test script

Create `test-local.js`:

```javascript
// Set environment variables
process.env.CONTACTS_TABLE_NAME = 'Contacts';
process.env.AYAHS_TABLE_NAME = 'Ayahs';
process.env.GMAIL_SECRET_ID = 'gmail/ayah-mailer';
process.env.MAIL_FROM = 'harisxstudy@gmail.com';
process.env.EMAIL_SUBJECT = 'Random Ayah';

// Import and test
const handler = require('./src/handlers/listContacts');

// Mock event
const event = {};

handler.handler(event)
  .then(result => {
    console.log('Success:', JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('Error:', err);
  });
```

#### Step 2: Run with Node.js

```powershell
node test-local.js
```

**Note**: This requires:
- AWS credentials configured
- Real DynamoDB tables in AWS
- Real Secrets Manager secret

---

### Option 3: Mock AWS Services (Advanced)

For true local testing without AWS, you can mock DynamoDB and Secrets Manager:

1. Use **DynamoDB Local** (Docker container)
2. Mock Secrets Manager responses
3. Create a local test harness

This is more complex but allows testing without any AWS resources.

---

## Quick Test Examples

### Test List Contacts

```powershell
# Using SAM Local
sam build
sam local invoke ListContactsFunction --env-vars env.json
```

### Test Add Contact

First, create `events/add-contact.json`:
```json
{
  "body": "{\"email\":\"test@example.com\",\"name\":\"Test User\"}"
}
```

Then:
```powershell
sam local invoke AddContactFunction --env-vars env.json --event events/add-contact.json
```

### Test Send All

```powershell
sam local invoke SendAllFunction --env-vars env.json
```

---

## Troubleshooting

### "Cannot find module" errors
- Run `npm install` first
- Make sure you're in the project root

### "Table not found" errors
- Ensure DynamoDB tables exist in AWS: `aws dynamodb list-tables`
- Check your AWS region matches where tables exist
- Verify AWS credentials: `aws sts get-caller-identity`

### "Secret not found" errors
- Ensure Secrets Manager secret exists: `aws secretsmanager list-secrets`
- Check the secret name matches `GMAIL_SECRET_ID` in env.json

### Docker issues with SAM Local
- Ensure Docker Desktop is running
- Check Docker is accessible: `docker ps`

---

## Environment Variables Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `CONTACTS_TABLE_NAME` | CloudFormation `!Ref ContactsTable` | DynamoDB table name for contacts |
| `AYAHS_TABLE_NAME` | CloudFormation `!Ref AyahsTable` | DynamoDB table name for ayahs |
| `GMAIL_SECRET_ID` | Parameter `GmailSecretId` | Secrets Manager secret name/ARN |
| `MAIL_FROM` | Parameter `MailFrom` | Gmail "from" address |
| `EMAIL_SUBJECT` | Parameter `EmailSubject` | Email subject prefix |

All are set automatically during deployment - no manual `.env` file needed!

