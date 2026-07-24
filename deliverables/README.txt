Page Pulse Deliverables README

This document explains, how to run and test the Page Pulse tool, and it covers the API contract, plus it summarizes three design choices with the little bit of reasoning behind each one. There’s also the latest Vercel deployment notes.

## Setup

1. Open a terminal in the `Digital heroes` project folder.
2. Install dependencies:

```bash
npm install
```

3. Run the app locally:

```bash
npm start
```

4. Open your browser at:

```text
http://localhost:3000
```

5. To run parser tests:

```bash
npm test
```

## API Contract

### POST `/api/audit`

Request body:

```json
{
  "url": "https://digitalheroesco.com"
}
```

Response rules (roughly, but still precise):

- `200 OK` – the page was fetched and audited just fine.
- `400 Bad Request` – the request body is missing , or the URL is not valid.
- `415 Unsupported Media Type` – the target URL did not send back HTML.
- `502 Bad Gateway` – the page could not be fetched.
- `504 Gateway Timeout` – the page fetch hit a timeout, before finishing.

Success response body example:

```json
{
  "url": "https://digitalheroesco.com/",
  "finalUrl": "https://digitalheroesco.com/",
  "httpStatus": 200,
  "ok": true,
  "responseTimeMs": 531,
  "contentType": "text/html; charset=utf-8",
  "title": "Digital Heroes",
  "metaDescription": "...",
  "h1Count": 1,
  "imagesMissingAlt": 0,
  "wordCount": 482
}
```

# Design Decisions
1. Defensive parser helpers
   - I kept URL normalization and HTML analysis separate with `normalizeAuditUrl` and `analyzeHtml`.
   - This makes the API route easier to test, maintain, and reason about, and prevented parsing bugs from crashing the whole endpoint.

2. Minimal external surface area
   - The service uses built-in Node APIs and a small serverless handler.
   - That keeps the deployment lightweight for Vercel and avoids extra dependencies for HTML parsing.

3. Explicit failure modes
   - The route returns clear JSON errors for invalid input, non-HTML responses, timeouts, and fetch failures.
   - That makes the client UI simpler and improves defensive behavior for public URLs.

#Deployment

the app is deployed using vercel at "https://page-pulse-eight.vercel.app"
