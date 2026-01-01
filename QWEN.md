# Quran Hourly Ayah Mailer - AWS Lambda Project

## Project Overview

This is a serverless AWS application built with AWS SAM (Serverless Application Model) that sends hourly Quran verses (Ayahs) to subscribers via email. The application fetches random Quran verses from the Quran API, stores them in DynamoDB, and emails them to registered contacts using Gmail's SMTP service.

### Architecture Components

- **AWS Lambda Functions**: Handle various operations including scheduled verse sending, contact management, and email delivery
- **DynamoDB Tables**: Store contacts, verses, and user data with Global Secondary Indexes for efficient querying
- **EventBridge**: Triggers the scheduled verse sending function hourly
- **API Gateway HTTP API**: Provides REST endpoints for contact management and manual verse sending
- **AWS Secrets Manager**: Stores Gmail credentials and API secrets securely
- **Nodemailer**: Handles email delivery via Gmail SMTP

### Key Features

- **Scheduled Verse Delivery**: Automatically sends a random Quran verse every hour to all subscribed contacts
- **REST API**: HTTP endpoints for managing contacts and manually triggering verse delivery
- **Email Management**: Includes unsubscribe functionality and contact management
- **Audio Attachments**: Attaches audio recitations to emails when available
- **Authentication System**: User registration/login with JWT tokens and password reset functionality

## Building and Running

### Prerequisites

- AWS CLI
- AWS SAM CLI
- Node.js 20
- Docker Desktop (for local testing with SAM Local)

### Local Development

1. **Install Dependencies**:
   ```bash
   npm ci --omit=dev
   ```

2. **Local Testing**:
   ```bash
   # Build the application
   sam build

   # Test a function locally (requires AWS credentials and real DynamoDB tables)
   sam local invoke ListContactsFunction --env-vars env.json

   # Or run local API server
   sam local start-api --env-vars env.json
   ```

3. **Using test-local.js**:
   ```bash
   # List contacts locally
   npm run local:list

   # Add a contact
   npm run local:add

   # Send to a contact
   npm run local:send:contact

   # Run scheduled send locally
   npm run local:scheduled
   ```

### Deployment

1. **Configure AWS credentials** (access keys or SSO)

2. **Create Gmail Secrets Manager secret**:
   ```bash
   aws secretsmanager create-secret --name "gmail/ayah-mailer" --secret-string '{"username":"you@gmail.com","app_password":"YOUR_APP_PASSWORD"}'
   ```

3. **Build and deploy**:
   ```bash
   sam build
   sam deploy \
     --stack-name quran-hourly-mailer \
     --region us-east-1 \
     --capabilities CAPABILITY_IAM \
     --resolve-s3 \
     --no-confirm-changeset \
     --parameter-overrides "GmailSecretId=gmail/ayah-mailer" "MailFrom=you@gmail.com"
   ```

### Environment Variables

The application uses several environment variables that are automatically set from the SAM template:

- `CONTACTS_TABLE_NAME`: Name of the contacts DynamoDB table
- `AYAHS_TABLE_NAME`: Name of the verses DynamoDB table
- `USERS_TABLE_NAME`: Name of the users DynamoDB table
- `GMAIL_SECRET_ID`: Secrets Manager secret name for Gmail credentials
- `APP_SECRETS_ID`: Secrets Manager secret name for API credentials
- `MAIL_FROM`: Email address to send from
- `HTTP_API_URL`: Public base URL for the HTTP API
- `QURAN_API_OAUTH_URL`: Quran API OAuth URL
- `OTP_TTL_MINUTES`: Minutes until OTP expires

## Development Conventions

### Code Structure

- `src/handlers/`: Contains individual Lambda function handlers
- `src/lib/`: Shared utility libraries for common operations
- `template.yaml`: SAM template defining the infrastructure
- `package.json`: Dependencies and scripts

### Lambda Functions

- `ScheduledSendFunction`: Runs hourly to send verses to all contacts
- `SendAllFunction`: Manually trigger sending to all contacts
- `SendContactFunction`: Send verse to a specific contact by ID
- `SendDirectFunction`: Send verse to an email address directly
- `AddContactFunction`: Add a new contact to the system
- `DeleteContactFunction`: Remove a contact
- `ListContactsFunction`: List all contacts
- `UnsubscribeFunction`: Handle unsubscribe requests
- `RegisterFunction`: User registration
- `LoginFunction`: User authentication
- `ForgotPasswordFunction`: Password reset functionality

### Libraries

- `email.js`: Handles email sending via Nodemailer and Gmail SMTP
- `quran.js`: Fetches Quran verses from the Quran API
- `dynamo.js`: DynamoDB operations for contacts, verses, and users
- `secrets.js`: Securely retrieves secrets from AWS Secrets Manager
- `auth.js`: Authentication and JWT handling
- `users.js`: User management operations
- `validation.js`: Input validation utilities

### API Endpoints

- `POST /send/all`: Send verse to all contacts
- `POST /send/contact`: Send verse to specific contact by ID
- `POST /send/direct`: Send verse to raw email in body
- `POST /contacts`: Add a new contact
- `PUT /contacts/{id}`: Update a contact
- `DELETE /contacts/{id}`: Remove a contact
- `GET /contacts`: List all contacts
- `GET /unsubscribe?id={id}`: Unsubscribe by contact ID
- `POST /register`: User registration
- `POST /login`: User login
- `POST /forgot-password`: Password reset request
- `POST /verify-otp-reset-password`: Verify OTP for password reset
- `POST /refresh-token`: Refresh JWT tokens

## Security

- Gmail credentials are stored in AWS Secrets Manager
- API secrets (Quran API credentials, JWT secrets) are stored in AWS Secrets Manager
- Email addresses are stored encrypted in DynamoDB
- Authentication uses JWT tokens with refresh token functionality
- CORS is configured to allow all origins (may need adjustment for production)

## Monitoring and Maintenance

- CloudWatch logs provide function execution logs
- EventBridge rule can be monitored for scheduled execution
- DynamoDB tables can be scanned to view current data
- AWS CloudFormation provides stack status and resource information