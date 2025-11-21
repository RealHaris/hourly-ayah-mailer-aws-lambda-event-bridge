## API Documentation

Base URL: use the stack output `HttpApiUrl` (example)  
`https://{apiId}.execute-api.{region}.amazonaws.com/v1`

Include `Content-Type: application/json` where body is present.

### List Contacts
- Method: GET  
- Path: `/contacts`
- cURL:
```bash
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"
curl "$BASE_URL/contacts"
```
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
- cURL:
```bash
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"
curl -X POST "$BASE_URL/contacts" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com","name":"Recipient"}'
```
- Responses:
  - 201 Created:
  ```json
  { "ok": true, "id": "uuid", "email": "recipient@example.com", "name": "Recipient" }
  ```
  - 400 Bad Request: missing/invalid email
  - 409 Conflict: already exists

### Remove Contact
- Method: DELETE  
- Path: `/contacts/{id}`
- cURL:
```bash
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"
ID="CONTACT_ID_HERE"
curl -X DELETE "$BASE_URL/contacts/$ID"
```
- Responses:
  - 200 OK:
  ```json
  { "ok": true, "id": "CONTACT_ID_HERE" }
  ```
  - 400 Bad Request: missing id path parameter

### Send to One Contact
- Method: POST  
- Path: `/send/contact`
- Body:
```json
{ "id": "CONTACT_ID_HERE" }
```
- cURL:
```bash
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"
curl -X POST "$BASE_URL/send/contact" \
  -H "Content-Type: application/json" \
  -d '{"id":"CONTACT_ID_HERE"}'
```
- Responses:
  - 200 OK:
  ```json
  { "ok": true, "sent": 1 }
  ```
  - 404 Not Found: contact not found (by id)

### Send Direct by Email
- Method: POST  
- Path: `/send/direct`
- Body:
```json
{ "email": "recipient@example.com" }
```
- cURL:
```bash
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"
curl -X POST "$BASE_URL/send/direct" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com"}'
```
- Responses:
  - 200 OK:
  ```json
  { "ok": true, "sent": 1 }
  ```
  - 400 Bad Request: invalid email

### Send to All Contacts
- Method: POST  
- Path: `/send/all`
- cURL:
```bash
BASE_URL="https://{apiId}.execute-api.{region}.amazonaws.com/v1"
curl -X POST "$BASE_URL/send/all"
```
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


