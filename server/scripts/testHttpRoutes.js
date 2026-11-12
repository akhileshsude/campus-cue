process.env.DISABLE_LOCAL_PERSIST = 'true';
process.env.DISABLE_SUPABASE = 'true';
process.env.GEMINI_API_KEY = '';
process.env.AI_API_KEY = '';

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

const { app } = await import('../src/index.js');

const USER_A = 'kaveri@iitb.ac.in';
const USER_B = 'arjun@outlook.com';

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

// 0. Unauthenticated requests MUST receive 401 and zero data
for (const [method, endpoint] of [
  ['GET', '/api/emails'],
  ['GET', '/api/reminders'],
  ['GET', '/api/digest/today'],
  ['GET', '/api/auth/status'],
  ['POST', '/api/emails/clear-demo'],
  ['POST', '/api/reset-demo'],
]) {
  const unauthRes = await dispatch(method, endpoint);
  assert.equal(unauthRes.status, 401, `${method} ${endpoint} without x-user-email should return 401`);
  assert.equal(unauthRes.body?.emails, undefined);
  assert.equal(unauthRes.body?.reminders, undefined);
}
console.log('  ✓ Unauthenticated data routes return 401 with zero data leaked');

// 1. Clear Demo Showcase -> Clean Live Inbox Mode under User A
const clearRes = await dispatch('POST', '/api/emails/clear-demo', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(clearRes.status, 200);
assert.equal(clearRes.body.dataMode, 'live');
assert.equal(clearRes.body.emailsCount, 0);
console.log('  ✓ POST /api/emails/clear-demo transitioned cleanly to empty live mode');

// 2. Health reflects live mode & transparent AI offline probe
const health = await dispatch('GET', '/api/health');
assert.equal(health.status, 200);
assert.equal(health.body.dataMode, 'live');
assert.equal(health.body.aiMode, 'offline');
assert.ok(health.body.model);
assert.ok(health.body.aiError);
assert.equal(health.body.imapSupported, true);
console.log(`  ✓ GET /api/health OK (aiMode: ${health.body.aiMode}, model: ${health.body.model})`);

// 3. Empty digest returns consistent schema including uncertain_deadlines
const emptyDigestRes = await dispatch('GET', '/api/digest/today?studentName=Kaveri', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(emptyDigestRes.status, 200);
assert.ok(Array.isArray(emptyDigestRes.body.digest.uncertain_deadlines));
assert.ok(Array.isArray(emptyDigestRes.body.digest.upcoming_deadlines));
console.log('  ✓ GET /api/digest/today empty live shape includes uncertain_deadlines array');

// 4. Ingest real user email under User A (offline -> basic/heuristic analysis + specific deadline_label)
const realEmailPayload = {
  sender: 'Placement Office <tpo@iitb.ac.in>',
  recipient: USER_A,
  subject: 'Microsoft SWE Intern Test Schedule',
  body: 'Please submit your placement consent form on the portal by tomorrow 6:00 PM.',
  received_at: '2026-11-11T10:00:00.000Z',
  save_as_new: true,
};
const ingest1 = await dispatch('POST', '/api/emails/process', {
  body: realEmailPayload,
  headers: { 'x-user-email': USER_A },
});
assert.equal(ingest1.status, 201);
assert.ok(ingest1.body.email.id);
assert.equal(ingest1.body.email.category, 'Placements');
assert.equal(ingest1.body.email.analysis_source, 'heuristic');
assert.notEqual(ingest1.body.email.deadline_label, 'Action Deadline');
console.log('  ✓ POST /api/emails/process saved user-scoped real email with transparent heuristic metadata');

// 5. Duplicate ingestion skips redundant AI call
const ingestDup = await dispatch('POST', '/api/emails/process', {
  body: realEmailPayload,
  headers: { 'x-user-email': USER_A },
});
assert.equal(ingestDup.status, 200);
assert.equal(ingestDup.body.skipped, true);
console.log('  ✓ SHA-256 deduplication skipped duplicate ingestion');

// 6. Strict multi-user isolation across User A and User B
const listUserA = await dispatch('GET', '/api/emails', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(listUserA.body.emails.length, 1);

const listUserB = await dispatch('GET', '/api/emails', {
  headers: { 'x-user-email': USER_B },
});
assert.equal(listUserB.body.emails.length, 0);

const emailId = ingest1.body.email.id;
const crossReadB = await dispatch('GET', `/api/emails/${emailId}`, {
  headers: { 'x-user-email': USER_B },
});
assert.equal(crossReadB.status, 404);
const crossDeleteB = await dispatch('DELETE', `/api/emails/${emailId}`, {
  headers: { 'x-user-email': USER_B },
});
assert.equal(crossDeleteB.status, 404);
console.log('  ✓ Multi-user isolation prevents leaking or mutating private emails across accounts');

// 7. Student Overrides + Deadline Completion
const overrideRes = await dispatch('PATCH', `/api/emails/${emailId}/override`, {
  headers: { 'x-user-email': USER_A },
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

// 8. Archive & Unarchive flow
const archRes = await dispatch('PATCH', `/api/emails/${emailId}/archive`, {
  headers: { 'x-user-email': USER_A },
  body: { is_archived: true },
});
assert.equal(archRes.status, 200);
assert.equal(archRes.body.email.is_archived, true);

const listActive = await dispatch('GET', '/api/emails', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(listActive.body.emails.length, 0);

const listArchived = await dispatch('GET', '/api/emails?onlyArchived=true', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(listArchived.body.emails.length, 1);
console.log('  ✓ PATCH /api/emails/:id/archive filters active vs archived views');

// 9. Inbound Webhook Forwarding
const inboundRes = await dispatch('POST', '/api/emails/inbound', {
  body: {
    from: 'CS Dept <cs@college.edu>',
    to: USER_B,
    subject: 'Compiler Design Project Demo',
    text: 'Demos start next Tuesday in Lab 2.',
  },
});
assert.equal(inboundRes.status, 201);
assert.equal(inboundRes.body.email.source, 'webhook');
console.log('  ✓ POST /api/emails/inbound processed forwarded webhook email');

// 9b. Batch Inbound Ingestion (Browser Extension / Apps Script + is_read preservation)
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

// 10. Reprocess Basic endpoint + Single Reprocess + Delete cleanup
const reprocessBasicRes = await dispatch('POST', '/api/emails/reprocess-basic', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(reprocessBasicRes.status, 200);
assert.equal(typeof reprocessBasicRes.body.count, 'number');

const reprocessRes = await dispatch('POST', `/api/emails/${emailId}/reprocess`, {
  headers: { 'x-user-email': USER_A },
});
assert.equal(reprocessRes.status, 200);
assert.ok(reprocessRes.body.email.processed_at);

const deleteRes = await dispatch('DELETE', `/api/emails/${emailId}`, {
  headers: { 'x-user-email': USER_A },
});
assert.equal(deleteRes.status, 200);
const verifyDeleted = await dispatch('GET', '/api/emails?includeArchived=true', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(verifyDeleted.body.emails.length, 0);
console.log('  ✓ POST /reprocess-basic, /reprocess and DELETE /api/emails/:id verified');

// 11. Real Digest on live user inbox
const digestRes = await dispatch('GET', '/api/digest/today?studentName=Arjun', {
  headers: { 'x-user-email': USER_B },
});
assert.equal(digestRes.status, 200);
assert.ok(digestRes.body.digest.overview);
assert.ok(Array.isArray(digestRes.body.digest.uncertain_deadlines));
assert.equal(digestRes.body.digest._source, 'heuristic');
console.log('  ✓ Live digest synthesized dynamically from user-specific real emails with transparent _source');

// 12. Reset Demo Data restores showcase
const resetRes = await dispatch('POST', '/api/reset-demo', {
  headers: { 'x-user-email': USER_A },
});
assert.equal(resetRes.status, 200);
assert.equal(resetRes.body.dataMode, 'demo');
assert.ok(resetRes.body.emailsCount >= 8);
console.log('  ✓ POST /api/reset-demo restores showcase cleanly');

// 13. Runtime Gemini AI Key validation, redaction & offline fallback
const badAiKeyRes = await dispatch('POST', '/api/settings/ai-key', {
  body: { apiKey: 'too-short' },
});
assert.equal(badAiKeyRes.status, 400);

const fakeKey = 'AIzaSyFakeIntegrationKeyValue_99999';
const invalidKeyRes = await dispatch('POST', '/api/settings/ai-key', {
  body: { apiKey: fakeKey },
});
assert.equal(invalidKeyRes.status, 200);
assert.equal(invalidKeyRes.body.aiMode, 'offline');
assert.equal(invalidKeyRes.body.geminiConfigured, false);
assert.ok(!JSON.stringify(invalidKeyRes.body).includes(fakeKey), 'API response must redact key');

const clearAiKeyRes = await dispatch('POST', '/api/settings/ai-key', {
  body: { apiKey: '' },
});
assert.equal(clearAiKeyRes.status, 200);
assert.equal(clearAiKeyRes.body.geminiConfigured, false);
assert.equal(clearAiKeyRes.body.aiMode, 'offline');
console.log('  ✓ POST /api/settings/ai-key validates keys, probes offline state, and redacts secrets cleanly');

console.log('🎉 ALL 14 HTTP INTEGRATION TESTS PASSED SUCCESSFULLY!');
