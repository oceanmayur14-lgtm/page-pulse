const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      return sendJson(res, 200, { status: 'ok' });
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/audit') {
      return handleAudit(req, res);
    }

    if (req.method === 'GET') {
      return serveStatic(requestUrl.pathname, res);
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: 'Unexpected server error' });
  }
});

async function handleAudit(req, res) {
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  const normalized = normalizeAuditUrl(payload && payload.url);
  if (!normalized.ok) {
    return sendJson(res, 400, { error: normalized.error });
  }

  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(normalized.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'PagePulseAudit/1.0 (+https://digitalheroesco.com)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
      }
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error.name === 'AbortError'
      ? 'The request timed out after 10 seconds.'
      : 'The page could not be fetched. Check that the URL is reachable.';
    return sendJson(res, error.name === 'AbortError' ? 504 : 502, { error: message });
  }
  clearTimeout(timeout);

  const responseTimeMs = Math.round(performance.now() - started);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) {
    return sendJson(res, 415, {
      error: 'The URL did not return an HTML page.',
      httpStatus: response.status,
      responseTimeMs,
      contentType: contentType || 'unknown',
      finalUrl: response.url
    });
  }

  let html;
  try {
    html = await readResponseText(response);
  } catch (error) {
    return sendJson(res, 502, { error: error.message, httpStatus: response.status, responseTimeMs });
  }

  const report = analyzeHtml(html);
  return sendJson(res, 200, {
    url: normalized.url,
    finalUrl: response.url,
    httpStatus: response.status,
    ok: response.ok,
    responseTimeMs,
    contentType,
    ...report
  });
}

function normalizeAuditUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: 'URL is required.' };
  }

  let candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: 'Only HTTP and HTTPS URLs are supported.' };
    }
    if (!parsed.hostname || isPrivateHost(parsed.hostname)) {
      return { ok: false, error: 'Please enter a public website URL.' };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: 'Enter a valid URL, for example https://example.com.' };
  }
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1') return true;

  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function analyzeHtml(html) {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  const title = decodeEntities(firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i)).trim();
  const metaDescription = getMetaDescription(html);
  const h1Count = countMatches(html, /<h1\b[^>]*>/gi);
  const imagesMissingAlt = countImagesMissingAlt(html);
  const visibleText = decodeEntities(withoutNoise.replace(/<[^>]+>/g, ' '));
  const words = visibleText.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g) || [];

  return {
    title: title || null,
    metaDescription: metaDescription || null,
    h1Count,
    imagesMissingAlt,
    wordCount: words.length
  };
}

function getMetaDescription(html) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const name = getAttribute(tag, 'name') || getAttribute(tag, 'property');
    if (name && name.toLowerCase() === 'description') {
      return decodeEntities(getAttribute(tag, 'content') || '').trim();
    }
  }
  return '';
}

function countImagesMissingAlt(html) {
  const imageTags = html.match(/<img\b[^>]*>/gi) || [];
  return imageTags.filter((tag) => {
    const alt = getAttribute(tag, 'alt');
    return alt === null || alt.trim() === '';
  }).length;
}

function getAttribute(tag, attributeName) {
  const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? '';
}

function firstMatch(value, pattern) {
  const match = value.match(pattern);
  return match ? match[1] : '';
}

function countMatches(value, pattern) {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, ' ');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', () => reject(new Error('Could not read request body.')));
  });
}

async function readResponseText(response) {
  const reader = response.body && response.body.getReader ? response.body.getReader() : null;
  if (!reader) return response.text();

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      throw new Error('The HTML response is too large to audit safely.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

function serveStatic(requestPath, res) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallbackData) => {
        if (fallbackError) return sendText(res, 404, 'Not found');
        sendBuffer(res, 200, fallbackData, 'text/html; charset=utf-8');
      });
      return;
    }
    sendBuffer(res, 200, data, MIME_TYPES[path.extname(filePath)] || 'application/octet-stream');
  });
}

function sendJson(res, statusCode, payload) {
  sendBuffer(res, statusCode, Buffer.from(JSON.stringify(payload)), 'application/json; charset=utf-8');
}

function sendText(res, statusCode, text) {
  sendBuffer(res, statusCode, Buffer.from(text), 'text/plain; charset=utf-8');
}

function sendBuffer(res, statusCode, data, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

server.listen(PORT, () => {
  console.log(`Page Pulse running on http://localhost:${PORT}`);
});
