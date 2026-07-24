# Page Pulse

Page Pulse is a small web tool that audits any public HTTP/HTTPS URL and returns a clean JSON report plus a browser UI.

## Features

- HTTP status and final URL after redirects
- Response time in milliseconds
- Page title and meta description
- H1 count
- Images missing alt text
- Approximate visible word count
- Sensible errors for invalid URLs, timeouts, oversized pages, unreachable hosts, and non-HTML responses

## Run locally

```bash
npm start
```

Open `http://localhost:3000`.

## API

`POST /api/audit`

```json
{
  "url": "https://digitalheroesco.com"
}
```

Successful response:

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

## Deploy

This app has no runtime dependencies beyond Node 18+. On Render, Railway, Fly.io, or similar free tiers, set the start command to:

```bash
npm start
```

The visible footer credit required by the task is included and links to `https://digitalheroesco.com`.
