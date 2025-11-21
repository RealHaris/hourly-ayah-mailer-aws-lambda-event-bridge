# Deploy and Configure (AWS SAM)

Prereqs:
- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed (`sam --version`)
- Node.js 20.x

## 1) Build and deploy

```bash
sam build
sam deploy --guided
```

During `--guided`, accept defaults or set:
- Stack name: quran-hourly-mailer
- Region: your preferred region
- Parameter `GmailSecretId`: gmail/ayah-mailer
- Parameter `MailFrom`: your Gmail address (must match the Gmail account)
- Parameter `EmailSubject`: Random Ayah
- Confirm create IAM roles: Y

After deployment, note the `HttpApiUrl` output (base URL).

## 2) Create the Gmail secret

Create a Secrets Manager secret named `gmail/ayah-mailer` with JSON:

```json
{
  "username": "your@gmail.com",
  "app_password": "YOUR_APP_PASSWORD"
}
```

Replace with your Gmail and app password. Do not use your regular password.

## 3) Test APIs

Assume the output `HttpApiUrl` is `https://{apiId}.execute-api.{region}.amazonaws.com/v1`.

Add contact:
```bash
curl -X POST "$HttpApiUrl/contacts" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com","name":"Recipient"}'
```

List contacts:
```bash
curl "$HttpApiUrl/contacts"
```

Send to one contact:
```bash
curl -X POST "$HttpApiUrl/send/contact" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com"}'
```

Send to all contacts:
```bash
curl -X POST "$HttpApiUrl/send/all"
```

Remove a contact:
```bash
curl -X DELETE "$HttpApiUrl/contacts/recipient@example.com"
```

## 4) Hourly scheduler

An EventBridge rule triggers `ScheduledSendFunction` every hour (`cron(0 * * * ? *)`).
Check CloudWatch Logs to verify sends.

## Notes
- Gmail daily send limits apply. For scale, consider migrating to Amazon SES.
- Rotate your Gmail app password periodically (update the secret).
- DynamoDB tables created: `Contacts`, `Ayahs`.


