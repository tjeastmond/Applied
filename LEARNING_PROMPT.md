# Applied.dev Agent API Learning Prompt

You have access to the Applied.dev Agent API.

First, discover the API instructions by calling:

GET http://localhost:3030/api/agent

The discovery endpoint is public. Protected application endpoints require bearer-token authentication:

Authorization: Bearer oTt7mU17S1wxSHjiiqsCFw5o-endARP98vjf7IgPXJo

Authentication setup:

- Preferred: sign in to the app → Admin → Agent API Tokens → create a named token → copy it immediately → use Authorization: Bearer <token>
- Optional bootstrap: pnpm agent:token prints AGENT_API_TOKEN=... for .env.local; restart the dev server; register it in Admin to manage/revoke from the UI
- Deployed hosts: DB tokens persist on Turso; AGENT_API_TOKEN env still works additively on Vercel
- Do not use APP_ACCESS_TOKEN for agent endpoints
- If no agent token is configured (no env token and no active DB tokens), protected endpoints return 503

Available actions:

1. List applications:
   GET http://localhost:3030/api/agent/applications
   GET http://localhost:3030/api/agent/applications?search=engineer
   GET http://localhost:3030/api/agent/applications?search=interviewing

   Optional query parameter:
   - search: case-insensitive filter for title, company, status, status label, URL, and applied date

   Response:
   {
   "applications": [
   {
   "id": "uuid",
   "url": "https://example.com/job-posting",
   "status": "to_apply",
   "title": "Role title",
   "company": "Company name",
   "appliedAt": "YYYY-MM-DD",
   "updatedAt": "ISO timestamp"
   }
   ]
   }

   Status values you may see: applied, to_apply, interviewing, waiting, rejected, offer, passed.

2. Create an application from a job URL:
   POST http://localhost:3030/api/agent/applications
   Content-Type: application/json

   Body:
   {
   "url": "https://example.com/job-posting"
   }

   Only "url" is accepted. Extra fields are ignored.

   Response (201):
   {
   "id": "uuid",
   "url": "https://example.com/job-posting",
   "status": "to_apply",
   "title": "Parsed title",
   "company": "Parsed company",
   "appliedAt": "YYYY-MM-DD",
   "updatedAt": "ISO timestamp"
   }

   The parser may also store salaryRange and fullJd when found, but those fields are not returned by the agent API.

Rules:

- You may only list applications and create new applications from job URLs.
- Do not attempt to edit applications.
- Do not attempt to change statuses.
- Do not attempt to delete applications.
- Do not access notes, backups, imports, raw database data, or unrelated API routes.
- Applications created through this API are automatically assigned status to_apply.
- If creating from a URL fails because title or company cannot be parsed, report the failure instead of retrying with invented data.
- Errors use { "error": "message" } with status 400 (bad request), 401 (unauthorized), or 503 (agent token not configured).

When using the API, always start with the discovery endpoint, then use only the documented agent endpoints.
