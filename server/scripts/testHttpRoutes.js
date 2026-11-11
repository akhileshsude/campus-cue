process.env.DISABLE_LOCAL_PERSIST = 'true';

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

const { app } = await import('../src/index.js');

/**
 * Invoke the Express app in-process without opening network sockets.
 */
function dispatch(method, url, { body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.originalUrl = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;

    if (body !== null) {
      req._body = true;
      req.body = body;
    }

    const resHeaders = {};
    const chunks = [];
    const res = new EventEmitter();
    res.statusCode = 200;
    res.locals = {};
    res.headersSent = false;
    res.setHeader = (k, v) => {
      resHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.removeHeader = (k) => {
      delete resHeaders[k.toLowerCase()];
    };
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      res.headersSent = true;
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      resolve({ status: res.statusCode, headers: resHeaders, body: json });
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (obj) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(obj));
      return res;
    };
    res.send = (val) => {
      if (typeof val === 'object' && !Buffer.isBuffer(val)) return res.json(val);
      res.end(val);
      return res;
    };
    res.redirect = (target) => {
      res.statusCode = 302;
      res.setHeader('location', target);
      res.end('');
      return res;
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, headers: resHeaders, body: { error: 'Not Found' } });
    });
  });
}

console.log('🧪 Running Real-Data Express HTTP Route Integration Suite...');

// 1. Clear Demo Showcase -> Clean Live Inbox Mode
const clearRes = await dispatch('POST', '/api/emails/clear-demo');
assert.equal(clearRes.status, 200);
assert.equal(clearRes.body.dataMode, 'live');
assert.equal(clearRes.body.emailsCount, 0);
console.log('  ✓ POST /api/emails/clear-demo transitioned cleanly to empty live mode');

// 2. Health reflects live mode
const health = await dispatch('GET', '/api/health');
assert.equal(health.status, 200);
assert.equal(health.body.dataMode, 'live');
assert.equal(health.body.imapSupported, true);
console.log(`  ✓ GET /api/health OK (aiMode: ${health.body.aiMode}, dataMode: ${health.body.dataMode})`);

// 3. Ingest real user email under User A
const realEmailPayload = {
  sender: 'Placement Office <tpo@iitb.ac.in>',
  recipient: 'kaveri@iitb.ac.in',
  subject: 'Microsoft SWE Intern Test Schedule',
  body: 'Please submit your placement consent form on the portal by tomorrow 6:00 PM.',
  received_at: '2026-11-11T10:00:00.000Z',
  save_as_new: true,
};
const ingest1 = await dispatch('POST', '/api/emails/process', {
  body: realEmailPayload,
  headers: { 'x-user-email': 'kaveri@iitb.ac.in' },
});
assert.equal(ingest1.status, 201);
assert.ok(ingest1.body.email.id);
assert.equal(ingest1.body.email.category, 'Placements');
console.log('  ✓ POST /api/emails/process saved user-scoped real email');

// 4. Duplicate ingestion skips redundant AI call
const ingestDup = await dispatch('POST', '/api/emails/process', {
  body: realEmailPayload,
  headers: { 'x-user-email': 'kaveri@iitb.ac.in' },
});
assert.equal(ingestDup.status, 200);
assert.equal(ingestDup.body.skipped, true);
console.log('  ✓ SHA-256 deduplication skipped duplicate ingestion');

// 5. Multi-user isolation verification
const listKaveri = await dispatch('GET', '/api/emails', {
  headers: { 'x-user-email': 'kaveri@iitb.ac.in' },
});
assert.equal(listKaveri.body.emails.length, 1);

const listOtherUser = await dispatch('GET', '/api/emails', {
  headers: { 'x-user-email': 'arjun@outlook.com' },
});
assert.equal(listOtherUser.body.emails.length, 0);
console.log('  ✓ Multi-user isolation prevents leaking private emails across email IDs');

const emailId = ingest1.body.email.id;

// 6. Student Overrides + Deadline Completion
const overrideRes = await dispatch('PATCH', `/api/emails/${emailId}/override`, {
  body: {
    category: 'Academics',
    priority: 'Medium',
    deadline: '2026-11-18T17:00:00.000Z',
    deadline_completed: true,
  },
});
assert.equal(overrideRes.status, 200);
assert.equal(overrideRes.body.email.edited_by_user, true);
assert.equal(overrideRes.body.email.user_category, 'Academics');
assert.equal(overrideRes.body.email.deadline_completed, true);
console.log('  ✓ PATCH /api/emails/:id/override updated classification, deadline & completion');

// 7. Archive & Unarchive flow
const archRes = await dispatch('PATCH', `/api/emails/${emailId}/archive`, {
  body: { is_archived: true },
});
assert.equal(archRes.status, 200);
assert.equal(archRes.body.email.is_archived, true);

const listActive = await dispatch('GET', '/api/emails', {
  headers: { 'x-user-email': 'kaveri@iitb.ac.in' },
});
assert.equal(listActive.body.emails.length, 0);

const listArchived = await dispatch('GET', '/api/emails?onlyArchived=true', {
  headers: { 'x-user-email': 'kaveri@iitb.ac.in' },
});
assert.equal(listArchived.body.emails.length, 1);
console.log('  ✓ PATCH /api/emails/:id/archive filters active vs archived views');

// 8. Inbound Webhook Forwarding
const inboundRes = await dispatch('POST', '/api/emails/inbound', {
  body: {
    from: 'CS Dept <cs@college.edu>',
    to: 'arjun@outlook.com',
    subject: 'Compiler Design Project Demo',
    text: 'Demos start next Tuesday in Lab 2.',
  },
});
assert.equal(inboundRes.status, 201);
assert.equal(inboundRes.body.email.source, 'webhook');
console.log('  ✓ POST /api/emails/inbound processed forwarded webhook email');

// 8b. Batch Inbound Ingestion (Browser Extension / Apps Script + is_read preservation)
const batchRes = await dispatch('POST', '/api/emails/inbound-batch', {
  body: {
    userEmail: 'student@locked-college.edu',
    emails: [
      {
        from: 'Hostel Warden <warden@locked-college.edu>',
        subject: 'Hostel Fee Payment Notice',
        text: 'Submit your semester hostel fee receipt by 25 Nov 2026.',
        is_read: true,
      },
      {
        from: 'Hostel Warden <warden@locked-college.edu>',
        subject: 'Hostel Fee Payment Notice',
        text: 'Submit your semester hostel fee receipt by 25 Nov 2026.',
      },
    ],
  },
});
assert.equal(batchRes.status, 201);
assert.equal(batchRes.body.count, 1);
assert.equal(batchRes.body.skippedCount, 1);
assert.equal(batchRes.body.emails[0].is_read, true);
console.log('  ✓ POST /api/emails/inbound-batch processed batch, preserved is_read, & deduplicated within batch');

// 9. Single Reprocess + Delete cleanup
const reprocessRes = await dispatch('POST', `/api/emails/${emailId}/reprocess`);
assert.equal(reprocessRes.status, 200);
assert.ok(reprocessRes.body.email.processed_at);

const deleteRes = await dispatch('DELETE', `/api/emails/${emailId}`);
assert.equal(deleteRes.status, 200);
const verifyDeleted = await dispatch('GET', '/api/emails?includeArchived=true', {
  headers: { 'x-user-email': 'kaveri@iitb.ac.in' },
});
assert.equal(verifyDeleted.body.emails.length, 0);
console.log('  ✓ POST /reprocess and DELETE /api/emails/:id verified');

// 10. Real Digest on live user inbox
const digestRes = await dispatch('GET', '/api/digest/today?studentName=Arjun', {
  headers: { 'x-user-email': 'arjun@outlook.com' },
});
assert.equal(digestRes.status, 200);
assert.ok(digestRes.body.digest.overview);
console.log('  ✓ Live digest synthesized dynamically from user-specific real emails');

// 11. Reset Demo Data restores showcase
const resetRes = await dispatch('POST', '/api/reset-demo');
assert.equal(resetRes.status, 200);
assert.equal(resetRes.body.dataMode, 'demo');
assert.ok(resetRes.body.emailsCount >= 8);
console.log('  ✓ POST /api/reset-demo restores showcase cleanly');

// 12. Runtime Gemini AI Key config validation & reset
const badAiKeyRes = await dispatch('POST', '/api/settings/ai-key', {
  body: { apiKey: 'too-short' },
});
assert.equal(badAiKeyRes.status, 400);

const clearAiKeyRes = await dispatch('POST', '/api/settings/ai-key', {
  body: { apiKey: '' },
});
assert.equal(clearAiKeyRes.status, 200);
assert.equal(clearAiKeyRes.body.geminiConfigured, false);
assert.equal(clearAiKeyRes.body.aiMode, 'heuristic');
console.log('  ✓ POST /api/settings/ai-key validates keys and reloads AI client cleanly');

console.log('🎉 ALL 12 HTTP INTEGRATION TESTS PASSED SUCCESSFULLY!');

