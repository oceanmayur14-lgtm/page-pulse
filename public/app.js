const form = document.querySelector('#audit-form');
const input = document.querySelector('#url-input');
const button = document.querySelector('#audit-button');
const message = document.querySelector('#message');
const report = document.querySelector('#report');

const fields = {
  reportTitle: document.querySelector('#report-title'),
  statusPill: document.querySelector('#status-pill'),
  httpStatus: document.querySelector('#http-status'),
  responseTime: document.querySelector('#response-time'),
  h1Count: document.querySelector('#h1-count'),
  missingAlt: document.querySelector('#missing-alt'),
  wordCount: document.querySelector('#word-count'),
  pageTitle: document.querySelector('#page-title'),
  metaDescription: document.querySelector('#meta-description'),
  finalUrl: document.querySelector('#final-url')
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = input.value.trim();
  if (!url) {
    showMessage('Enter a URL to audit.');
    return;
  }

  setLoading(true);
  showMessage('Auditing page...', 'info');

  try {
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'The audit failed.');
      report.hidden = true;
      return;
    }

    renderReport(data);
    message.hidden = true;
  } catch {
    showMessage('Could not reach the audit service. Try again in a moment.');
    report.hidden = true;
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Auditing...' : 'Audit';
}

function showMessage(text, type = 'error') {
  message.textContent = text;
  message.className = `message ${type === 'info' ? 'info' : ''}`.trim();
  message.hidden = false;
}

function renderReport(data) {
  fields.reportTitle.textContent = data.title || new URL(data.finalUrl || data.url).hostname;
  fields.statusPill.textContent = data.ok ? 'Reachable' : 'Fetched with issue';
  fields.httpStatus.textContent = String(data.httpStatus);
  fields.responseTime.textContent = `${data.responseTimeMs} ms`;
  fields.h1Count.textContent = String(data.h1Count);
  fields.missingAlt.textContent = String(data.imagesMissingAlt);
  fields.wordCount.textContent = String(data.wordCount);
  fields.pageTitle.textContent = data.title || 'No title found';
  fields.metaDescription.textContent = data.metaDescription || 'No meta description found';
  fields.finalUrl.textContent = data.finalUrl || data.url;
  fields.finalUrl.href = data.finalUrl || data.url;
  report.hidden = false;
}
