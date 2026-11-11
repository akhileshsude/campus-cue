let extractedEmails = [];
let detectedTabEmail = '';

const userEmailInput = document.getElementById('userEmail');
const apiBaseInput = document.getElementById('apiBase');
const quickSyncBtn = document.getElementById('quickSyncBtn');
const scanBtn = document.getElementById('scanBtn');
const importBtn = document.getElementById('importBtn');
const openAppBtn = document.getElementById('openAppBtn');
const previewBox = document.getElementById('previewBox');
const statusBox = document.getElementById('statusBox');

chrome.storage.local.get(['userEmail', 'apiBase'], (res) => {
  if (res.userEmail) userEmailInput.value = res.userEmail;
  if (res.apiBase) apiBaseInput.value = res.apiBase;
});

function showStatus(msg, type = 'success') {
  statusBox.textContent = msg;
  statusBox.className = `status-box ${type}`;
}

function hideStatus() {
  statusBox.className = 'status-box hidden';
}

function renderPreview(items) {
  if (!items || items.length === 0) {
    previewBox.className = 'preview-box hidden';
    importBtn.classList.add('hidden');
    return;
  }
  previewBox.className = 'preview-box';
  previewBox.innerHTML = '';

  const header = document.createElement('div');
  header.style.fontWeight = '700';
  header.style.marginBottom = '6px';
  header.textContent = `Extracted ${items.length} email(s):`;
  previewBox.appendChild(header);

  items.slice(0, 12).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'preview-item';
    const subj = document.createElement('strong');
    subj.textContent = item.subject || '(No Subject)';
    const from = document.createElement('div');
    from.style.color = '#5c6b62';
    from.textContent = item.from || 'Unknown Sender';
    row.appendChild(subj);
    row.appendChild(from);
    previewBox.appendChild(row);
  });

  if (items.length > 12) {
    const more = document.createElement('div');
    more.style.marginTop = '4px';
    more.style.color = '#5c6b62';
    more.textContent = `+ ${items.length - 12} more email(s)`;
    previewBox.appendChild(more);
  }
}

/**
 * Executed inside the active authenticated webmail browser tab.
 */
function extractEmailsFromPage() {
  const host = window.location.hostname.toLowerCase();
  const results = [];
  let pageOwnerEmail = '';

  const parseDateSafe = (str) => {
    if (!str) return new Date().toISOString();
    const cleaned = String(str).replace(/at\s+/i, '').trim();
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  const accountBtn = document.querySelector('a[aria-label*="Google Account"], button[aria-label*="Account manager"]');
  if (accountBtn) {
    const m = (accountBtn.getAttribute('aria-label') || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m) pageOwnerEmail = m[0].toLowerCase();
  }
  if (!pageOwnerEmail) {
    const titleMatch = document.title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (titleMatch) pageOwnerEmail = titleMatch[0].toLowerCase();
  }

  // 1. GMAIL WEB (mail.google.com)
  if (host.includes('mail.google.com')) {
    const openSubjectEl = document.querySelector('h2.hP');
    const bodyEls = Array.from(document.querySelectorAll('.a3s.aiL, .a3s'));

    if (openSubjectEl && bodyEls.length > 0) {
      const subject = openSubjectEl.innerText.trim();
      const senderEls = Array.from(document.querySelectorAll('.gD'));
      const lastSenderEl = senderEls[senderEls.length - 1];
      const senderEmail = lastSenderEl?.getAttribute('email') || '';
      const senderName = lastSenderEl?.getAttribute('name') || lastSenderEl?.innerText?.trim() || '';
      const from = senderEmail
        ? senderName
          ? `${senderName} <${senderEmail}>`
          : senderEmail
        : senderName || 'Gmail Sender';

      const dateEls = Array.from(document.querySelectorAll('.g3'));
      const lastDateEl = dateEls[dateEls.length - 1];
      const dateStr = lastDateEl?.getAttribute('title') || lastDateEl?.innerText || '';

      const fullBody = bodyEls
        .map((el) => (el.innerText || '').trim())
        .filter(Boolean)
        .join('\n\n---\n\n');

      if (fullBody) {
        results.push({
          from,
          to: pageOwnerEmail || undefined,
          subject,
          text: fullBody,
          date: parseDateSafe(dateStr),
          is_read: true,
        });
      }
    }

    if (results.length === 0) {
      const rows = Array.from(document.querySelectorAll('tr.zA')).slice(0, 25);
      for (const row of rows) {
        const senderSpan = row.querySelector('.yW span[email], .yW .yP, .yW .zF');
        const senderEmail = senderSpan?.getAttribute('email') || '';
        const senderName = senderSpan?.getAttribute('name') || senderSpan?.innerText?.trim() || 'Sender';
        const from = senderEmail ? `${senderName} <${senderEmail}>` : senderName;

        const subjEl = row.querySelector('.bog, .y6 span');
        const subject = subjEl?.innerText?.trim() || '';
        const snippetEl = row.querySelector('.y2');
        const snippet = (snippetEl?.innerText || '').replace(/^\s*-\s*/, '').trim();
        const dateEl = row.querySelector('.xW span[title], .xW');
        const dateStr = dateEl?.getAttribute('title') || dateEl?.innerText || '';
        const isRead = row.classList.contains('yO') && !row.classList.contains('zE');

        if (subject) {
          results.push({
            from,
            to: pageOwnerEmail || undefined,
            subject,
            text: snippet || subject,
            date: parseDateSafe(dateStr),
            is_read: isRead,
          });
        }
      }
    }

    return { ownerEmail: pageOwnerEmail, emails: results, provider: 'Gmail Web' };
  }

  // 2. OUTLOOK WEB / MICROSOFT 365
  if (host.includes('outlook.')) {
    const bodyEl = document.querySelector('[aria-label="Message body"], [role="document"]');
    const subjEl = document.querySelector('[role="heading"][aria-level="2"], span[id*="Subject"]');

    if (bodyEl && subjEl && bodyEl.innerText.trim().length > 15) {
      const fromEl = document.querySelector('[aria-label^="From:"], .OZZZK, [data-testid="SenderName"]');
      const dateEl = document.querySelector('[data-testid="SentReceivedSavedTime"], time');
      results.push({
        from: fromEl?.innerText?.replace(/^From:\s*/i, '').trim() || 'Outlook Sender',
        to: pageOwnerEmail || undefined,
        subject: subjEl.innerText.trim(),
        text: bodyEl.innerText.trim(),
        date: parseDateSafe(dateEl?.getAttribute('datetime') || dateEl?.innerText),
        is_read: true,
      });
    }

    if (results.length === 0) {
      const options = Array.from(document.querySelectorAll('[role="option"][aria-label]')).slice(0, 25);
      for (const opt of options) {
        const aria = opt.getAttribute('aria-label') || '';
        const lines = (opt.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length >= 2) {
          results.push({
            from: lines[0],
            to: pageOwnerEmail || undefined,
            subject: lines[1],
            text: lines.slice(2).join(' — ') || lines[1],
            date: new Date().toISOString(),
            is_read: !aria.toLowerCase().startsWith('unread'),
          });
        }
      }
    }

    return { ownerEmail: pageOwnerEmail, emails: results, provider: 'Outlook Web' };
  }

  // 3. ROUNDCUBE / ZIMBRA / GENERIC CAMPUS WEBMAIL
  const rcRows = Array.from(document.querySelectorAll('table.messagelist tr.message, #zl__TV-main__rows .Row')).slice(0, 25);
  if (rcRows.length > 0) {
    for (const row of rcRows) {
      const subj = row.querySelector('.subject, .Subject, .zmRowSubject')?.innerText?.trim();
      const from = row.querySelector('.fromto, .adr, .From')?.innerText?.trim() || host;
      const dateStr = row.querySelector('.date, .Date')?.innerText?.trim();
      if (subj) {
        results.push({
          from,
          to: pageOwnerEmail || undefined,
          subject: subj,
          text: subj,
          date: parseDateSafe(dateStr),
          is_read: !row.classList.contains('unread'),
        });
      }
    }
    if (results.length > 0) {
      return { ownerEmail: pageOwnerEmail, emails: results, provider: host };
    }
  }

  let frameText = '';
  try {
    const rcFrame = document.querySelector('iframe#messagecontframe');
    if (rcFrame?.contentDocument?.body) {
      frameText = rcFrame.contentDocument.body.innerText.trim();
    }
  } catch {
    // ignore cross-origin iframe
  }

  const h1Text = document.querySelector('h1, h2, .subject, #subject')?.innerText?.trim() || document.title;
  const pageText = frameText || document.querySelector('main, [role="main"], .message-body')?.innerText?.trim() || '';

  if (pageText.length > 20) {
    results.push({
      from: host,
      to: pageOwnerEmail || undefined,
      subject: h1Text || 'College Webmail Message',
      text: pageText.slice(0, 12000),
      date: new Date().toISOString(),
      is_read: false,
    });
  }

  return { ownerEmail: pageOwnerEmail, emails: results, provider: host };
}

async function scanActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab detected.');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractEmailsFromPage,
  });
  if (result?.ownerEmail && !userEmailInput.value) {
    userEmailInput.value = result.ownerEmail;
    detectedTabEmail = result.ownerEmail;
  }
  return result;
}

async function postBatchToServer(emails) {
  const userEmail = (userEmailInput.value || detectedTabEmail || '').trim().toLowerCase();
  const apiBase = (apiBaseInput.value || 'http://localhost:5001').replace(/\/+$/, '');
  chrome.storage.local.set({ userEmail, apiBase });

  const res = await fetch(`${apiBase}/api/emails/inbound-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userEmail ? { 'x-user-email': userEmail } : {}),
    },
    body: JSON.stringify({
      userEmail,
      sourceLabel: 'browser_extension',
      emails,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || `HTTP ${res.status}`);
  }
  return data;
}

quickSyncBtn.addEventListener('click', async () => {
  hideStatus();
  quickSyncBtn.disabled = true;
  quickSyncBtn.textContent = 'Scanning & Importing...';

  try {
    const result = await scanActiveTab();
    extractedEmails = result?.emails || [];
    if (extractedEmails.length === 0) {
      renderPreview([]);
      showStatus('No emails found on this page. Open your Gmail, Outlook, or college inbox tab first.', 'error');
      return;
    }
    renderPreview(extractedEmails);
    const data = await postBatchToServer(extractedEmails);
    showStatus(
      `Synced ${data.count} new email(s)${data.skippedCount > 0 ? ` (${data.skippedCount} already in clg.inbox)` : ''}! Click "Open clg.inbox" to view.`,
      'success'
    );
  } catch (err) {
    showStatus(`Sync failed: ${err.message}`, 'error');
  } finally {
    quickSyncBtn.disabled = false;
    quickSyncBtn.textContent = '⚡ 1-Click Sync Open Webmail Tab';
  }
});

scanBtn.addEventListener('click', async () => {
  hideStatus();
  try {
    const result = await scanActiveTab();
    extractedEmails = result?.emails || [];
    renderPreview(extractedEmails);
    if (extractedEmails.length === 0) {
      showStatus('No emails found on this tab. Open an inbox or message first.', 'error');
    } else {
      importBtn.classList.remove('hidden');
      importBtn.disabled = false;
      showStatus(`Previewed ${extractedEmails.length} email(s) from ${result.provider}.`, 'success');
    }
  } catch (err) {
    showStatus(`Scan error: ${err.message}`, 'error');
  }
});

importBtn.addEventListener('click', async () => {
  if (extractedEmails.length === 0) return;
  importBtn.disabled = true;
  importBtn.textContent = 'Importing...';
  try {
    const data = await postBatchToServer(extractedEmails);
    showStatus(`Imported ${data.count} new email(s) (${data.skippedCount} duplicates skipped).`, 'success');
    importBtn.classList.add('hidden');
  } catch (err) {
    showStatus(`Import failed: ${err.message}`, 'error');
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Import Previewed Emails';
  }
});

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' });
});
