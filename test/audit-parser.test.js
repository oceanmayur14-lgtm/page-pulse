const assert = require('assert');
const { normalizeAuditUrl, analyzeHtml } = require('../api/audit');

const html = `<!doctype html>
<html>
  <head>
    <title>Audit Test</title>
    <meta name="description" content="A defensive parser test page." />
  </head>
  <body>
    <h1>Heading Here</h1>
    <img src="icon.png" alt="" />
    <img src="logo.png" alt="Logo" />
    <p>Content words count here.</p>
  </body>
</html>`;

const report = analyzeHtml(html);
assert.strictEqual(report.title, 'Audit Test');
assert.strictEqual(report.metaDescription, 'A defensive parser test page.');
assert.strictEqual(report.h1Count, 1);
assert.strictEqual(report.imagesMissingAlt, 1);
assert.strictEqual(report.wordCount, 8);

const badEmpty = normalizeAuditUrl('');
assert.strictEqual(badEmpty.ok, false);
assert.strictEqual(badEmpty.error, 'URL is required.');

const badScheme = normalizeAuditUrl('ftp://example.com');
assert.strictEqual(badScheme.ok, false);
assert.strictEqual(badScheme.error, 'Only HTTP and HTTPS URLs are supported.');

const normalized = normalizeAuditUrl('example.com');
assert.strictEqual(normalized.ok, true);
assert.strictEqual(normalized.url, 'https://example.com/');

console.log('✅ audit parser tests passed.');
