## API Documentation

Base URL: use the stack output `HttpApiUrl` (example)  
`https://{apiId}.execute-api.{region}.amazonaws.com/v1`

Include `Content-Type: application/json` where body is present.

### List Contacts
- Method: GET  
- Path: `/contacts`
- Response 200:
```json
{
  "ok": true,
  "items": [
    { "email": "recipient@example.com", "name": "Recipient", "createdAt": "2025-01-01T00:00:00.000Z" }
  ]
}
```

### Add Contact
- Method: POST  
- Path: `/contacts`
- Body:
```json
{ "email": "recipient@example.com", "name": "Recipient" }
```
- Responses:
  - 201 Created:
  ```json
  { "ok": true, "email": "recipient@example.com", "name": "Recipient" }
  ```
  - 400 Bad Request: missing/invalid email
  - 409 Conflict: already exists

### Remove Contact
- Method: DELETE  
- Path: `/contacts/{email}`
- Responses:
  - 200 OK:
  ```json
  { "ok": true, "email": "recipient@example.com" }
  ```
  - 400 Bad Request: missing email path parameter

### Send to One Contact
- Method: POST  
- Path: `/send/contact`
- Body:
```json
{ "email": "recipient@example.com" }
```
- Responses:
  - 200 OK:
  ```json
  { "ok": true, "sent": 1 }
  ```
  - 404 Not Found: contact not found

### Send to All Contacts
- Method: POST  
- Path: `/send/all`
- Responses:
  - 200 OK:
  ```json
  {
    "ok": true,
    "sent": 2,
    "failed": 0,
    "details": [
      { "to": "a@example.com", "ok": true },
      { "to": "b@example.com", "ok": true }
    ]
  }
  ```

### Notes
- Emails are sent with Gmail SMTP using a Secrets Manager secret `gmail/ayah-mailer` containing:
```json
{ "username": "you@gmail.com", "app_password": "APP_PASSWORD" }
```
- The scheduled hourly run stores the ayah in DynamoDB (`Ayahs` table) before sending.


