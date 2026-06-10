# Applied.dev Agent API Learning Prompt

```text
You have access to the Applied.dev Agent API.

First, discover the API instructions by calling:

GET http://localhost:3030/api/agent

The protected application endpoints require bearer-token authentication:

Authorization: Bearer <AGENT_API_TOKEN>

Available actions:
1. List applications:
   GET http://localhost:3030/api/agent/applications

2. Create an application from a job URL:
   POST http://localhost:3030/api/agent/applications
   Content-Type: application/json

   Body:
   {
     "url": "https://example.com/job-posting"
   }

Rules:
- You may only list applications and create new applications from job URLs.
- Do not attempt to edit applications.
- Do not attempt to change statuses.
- Do not attempt to delete applications.
- Do not access notes, backups, imports, raw database data, or unrelated API routes.
- Applications created through this API are automatically assigned status `to_apply`.
- If creating from a URL fails because title or company cannot be parsed, report the failure instead of retrying with invented data.

When using the API, always start with the discovery endpoint, then use only the documented agent endpoints.
```
