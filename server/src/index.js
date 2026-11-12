import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { simpleParser } from 'mailparser';
import { google } from 'googleapis';
import supabase from './supabaseClient.js';
import { sampleEmails, sampleDigest, sampleReminders } from './sampleData.js';
import {
  processEmail,
  generateReplyDraft,
  computeContentHash,
  validateAndSanitizeDate,
  reloadAiClient,
  isAiConfigured,
  probeAiStatus,
  getCachedAiHealth,
  redactSecrets,
} from '../services/emailProcessor.js';
import { generateAcademicDigest, reloadDigestAiClient } from '../services/digestGenerator.js';
import { detectProviderConfig, fetchImapMessages } from '../services/imapService.js';
import {
  isMicrosoftOAuthConfigured,
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCodeForTokens,
  fetchMicrosoftProfileEmail,
  fetchMicrosoftMessages,
} from '../services/microsoftService.js';
import {
  isUuid,
  generateUuid,
  resolveUserId,
  deriveDeadlineLabel,
  fetchAllEmailsFromDb,
  findEmailByIdInDb,
  findByHashInDb,
  upsertEmailAndAnalysisToDb,
  updateEmailOverridesInDb,
  updateEmailReadInDb,
  updateEmailArchivedInDb,
  deleteEmailFromDb,
  syncReminderToDb,
  updateReminderInDb,
  findReminderByIdInDb,
  fetchRemindersFromDb,
  upsertDigestToDb,
  deleteUserTokenFromDb,
} from '../services/supabaseStore.js';
import {
  loadPersistedStore,
  savePersistedStore,
  loadEncryptedSecretsMap,
  saveEncryptedSecretsMap,
  saveAttachmentFile,
  readAttachmentFile,
  deleteAttachmentFolder,
  encryptString,
  decryptString,
} from '../services/localPersistence.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
const CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.CLIENT_URL || '*';

// Multer memory storage for .eml file uploads (up to 25MB, up to 15 files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 15 },
});

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || CORS_ORIGIN === '*' || origin === CORS_ORIGIN || origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
        return cb(null, true);
      }
      return cb(null, origin === FRONTEND_URL);
    },
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Load persistent state from server/data/inbox-store.json (falls back to sample data only on first run)
const initialStore = loadPersistedStore({
  emails: sampleEmails.map(e => ({ ...e, source: 'sample', user_id: 'default_student' })),
  reminders: sampleReminders,
  digest: sampleDigest,
});

let dataMode = initialStore.mode; // 'demo' | 'live'
let memoryEmails = initialStore.emails;
let memoryReminders = initialStore.reminders;
let memoryDigest = initialStore.digest;
const memoryDigestsByUser = new Map();
const demoDisabledUsers = new Set();

const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidUserIdentity(id) {
  return Boolean(id && id !== 'default_student' && VALID_EMAIL_RE.test(String(id).trim().toLowerCase()));
}
function requireUserIdentity(req, res) {
  const candidate = resolveUserId(req);
  if (!isValidUserIdentity(candidate)) {
    res.status(401).json({ error: 'Unauthorized: valid x-user-email identity header is required.' });
    return null;
  }
  return candidate;
}

// Multi-account connection registry (keyed by `${provider}:${email}`)
const connectedAccounts = new Map(
  (initialStore.accounts || []).map(acc => [`${acc.provider}:${acc.email}`, acc])
);
const privateAccountSecrets = loadEncryptedSecretsMap();

// Remove any orphaned account entries whose encrypted secret wasn't loaded
for (const key of Array.from(connectedAccounts.keys())) {
  if (!privateAccountSecrets.has(key)) {
    connectedAccounts.delete(key);
  }
}

function persistAllLocal() {
  savePersistedStore({
    mode: dataMode,
    emails: memoryEmails,
    reminders: memoryReminders,
    digest: memoryDigest,
    accounts: Array.from(connectedAccounts.values()),
  });
}

function persistSecretsLocal() {
  saveEncryptedSecretsMap(privateAccountSecrets);
}

/**
 * Transitions out of demo showcase mode cleanly once real external email accounts or real files arrive.
 */
function promoteToLiveModeIfNeeded() {
  if (dataMode === 'demo') {
    memoryEmails = memoryEmails.filter(
      e => e.source !== 'sample' && !String(e.id || '').startsWith('cue-')
    );
    const remainingIds = new Set(memoryEmails.map(e => e.id));
    memoryReminders = memoryReminders.filter(r => remainingIds.has(r.email_id || r.emailId));
    memoryDigest = null;
    dataMode = 'live';
  }
}

// Google OAuth2 Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`;

const googleConfigured = Boolean(
  GOOGLE_CLIENT_ID &&
  GOOGLE_CLIENT_SECRET &&
  !GOOGLE_CLIENT_ID.includes('your_google') &&
  !GOOGLE_CLIENT_ID.includes('your-google')
);

function createGoogleOAuthClient() {
  if (!googleConfigured) return null;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

async function restoreSavedTokensFromDb() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('user_tokens').select('*');
    if (!error && Array.isArray(data)) {
      let restored = 0;
      for (const row of data) {
        if (!row.access_token) continue;
        const provider = row.provider || 'google';
        if (provider === 'google' && !googleConfigured) continue;
        if (provider === 'microsoft' && !isMicrosoftOAuthConfigured()) continue;

        const email = row.user_id && row.user_id.includes('@') ? row.user_id : `connected-${provider}`;
        const key = `${provider}:${email}`;
        connectedAccounts.set(key, {
          email,
          provider,
          providerLabel: provider === 'microsoft' ? 'Microsoft 365 / Outlook OAuth' : 'Gmail OAuth 2.0',
          host: provider === 'microsoft' ? 'graph.microsoft.com' : 'gmail.googleapis.com',
          connectedAt: row.created_at,
          lastSyncedAt: row.updated_at,
        });
        privateAccountSecrets.set(key, {
          tokens: {
            access_token: decryptString(row.access_token),
            refresh_token: row.refresh_token ? decryptString(row.refresh_token) : undefined,
            expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
          },
        });
        restored += 1;
      }
      if (restored > 0) {
        persistAllLocal();
        persistSecretsLocal();
        console.log(`🔑 Restored ${restored} OAuth session(s) from Supabase.`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not restore OAuth tokens:', err.message);
  }
}
restoreSavedTokensFromDb();

async function hydrateFromSupabase() {
  if (!supabase) return;
  try {
    const dbEmails = await fetchAllEmailsFromDb(supabase);
    if (Array.isArray(dbEmails) && (dbEmails.length > 0 || dataMode === 'live')) {
      dataMode = 'live';
      memoryEmails = dbEmails;
      const dbReminders = await fetchRemindersFromDb(supabase, dbEmails);
      if (Array.isArray(dbReminders)) {
        memoryReminders = dbReminders;
      }
      persistAllLocal();
      console.log(`🗄️ Hydrated ${memoryEmails.length} email(s) & ${memoryReminders.length} reminder(s) from Supabase.`);
    }
  } catch (err) {
    console.warn('⚠️ Startup Supabase hydration failed:', err.message);
  }
}

const dbReadyPromise = hydrateFromSupabase();
probeAiStatus()
  .then((probe) => {
    console.log(`🤖 Initial AI probe: aiMode=${probe.aiMode}, model=${probe.model}${probe.error ? `, note=${probe.error}` : ''}`);
  })
  .catch(() => {});

async function findOrLoadEmailIndex(id, userId) {
  let idx = memoryEmails.findIndex(e => e.id === id && isEmailVisibleToUser(e, userId));
  if (idx !== -1) return idx;
  if (supabase && isUuid(id)) {
    const dbEmail = await findEmailByIdInDb(supabase, id, userId);
    if (dbEmail) {
      memoryEmails.unshift(dbEmail);
      return 0;
    }
  }
  return -1;
}

async function findOrLoadReminderIndex(id, userId) {
  let idx = memoryReminders.findIndex(r => r.id === id && (!r.user_id || r.user_id === userId));
  if (idx !== -1) return idx;
  if (supabase && isUuid(id)) {
    const dbRem = await findReminderByIdInDb(supabase, id, userId);
    if (dbRem) {
      memoryReminders.unshift(dbRem);
      return 0;
    }
  }
  return -1;
}

function getEffectiveCategory(email) {
  return email.user_category || email.category || 'Announcements';
}

function getEffectivePriority(email) {
  return email.user_priority || email.priority || 'Medium';
}

function getEffectiveDeadline(email) {
  return email.user_deadline || email.deadline || null;
}

function getPublicConnectedAccounts(ownerFilter = '') {
  const all = Array.from(connectedAccounts.values());
  if (!ownerFilter) return [];
  return all.filter(a => a.ownerUserId === ownerFilter || a.email === ownerFilter);
}

function isEmailVisibleToUser(email, userId) {
  if (!userId || !isValidUserIdentity(userId)) return false;
  if (email.source === 'sample' || String(email.id || '').startsWith('cue-')) {
    return dataMode === 'demo' && !demoDisabledUsers.has(userId);
  }
  return String(email.user_id || '').toLowerCase() === userId;
}

async function syncReminderForEmail(emailObj, aiResult) {
  if (aiResult.needs_reply || aiResult.needs_action || aiResult.needs_followup) {
    const remIndex = memoryReminders.findIndex(r => (r.email_id || r.emailId) === emailObj.id);
    const existing = remIndex >= 0 ? memoryReminders[remIndex] : null;
    const reminderId =
      existing?.id && isUuid(existing.id)
        ? existing.id
        : isUuid(emailObj.id)
        ? generateUuid()
        : existing?.id || `rem-${emailObj.id}`;
    const reminderType = aiResult.needs_reply ? 'reply' : 'action';
    const reminderNote = aiResult.reminder_note || aiResult.required_action || 'Action required';

    const reminderData = {
      id: reminderId,
      user_id: emailObj.user_id || 'default_student',
      email_id: emailObj.id,
      emailId: emailObj.id,
      sender: emailObj.sender,
      senderName: emailObj.senderName || emailObj.sender,
      subject: emailObj.subject,
      reminder_type: reminderType,
      reminder_note: reminderNote,
      reminder_text: `${emailObj.subject}: ${reminderNote}`,
      status: existing?.status || 'pending',
      due_date: getEffectiveDeadline(emailObj),
      snoozed_until: existing?.snoozed_until || null,
      is_completed: existing?.is_completed || false,
      created_at: emailObj.received_at || new Date().toISOString(),
    };

    const syncedId = await syncReminderToDb(supabase, reminderData);
    if (syncedId && isUuid(syncedId)) {
      reminderData.id = syncedId;
    }

    if (remIndex >= 0) {
      memoryReminders[remIndex] = reminderData;
    } else {
      memoryReminders.unshift(reminderData);
    }
  }
}

async function ingestSingleEmail({
  source = 'paste',
  externalId = null,
  sender = 'Unknown Sender',
  senderName = '',
  recipient = null,
  subject = 'No Subject',
  body = '',
  receivedAt = new Date().toISOString(),
  attachments = [],
  attachmentPayloads = [],
  userId = 'default_student',
  isRead = false,
  forceReprocess = false,
}) {
  const cleanBody = (body || '').trim() || 'Empty correspondence body.';
  const cleanSender = (sender || 'Unknown Sender').trim();
  const cleanSubject = (subject || 'No Subject').trim();
  const resolvedSenderName =
    senderName ||
    (cleanSender.includes('<') ? cleanSender.split('<')[0].trim() : cleanSender) ||
    'Collegiate Sender';

  const contentHash = computeContentHash(cleanSender, cleanSubject, cleanBody);

  if (!forceReprocess) {
    const existingMem = memoryEmails.find(
      e => e.content_hash === contentHash && (e.user_id || 'default_student') === userId
    );
    if (existingMem) {
      return { email: existingMem, skipped: true };
    }
    const existingDb = await findByHashInDb(supabase, userId, contentHash);
    if (existingDb) {
      if (!memoryEmails.some(e => e.id === existingDb.id)) {
        memoryEmails.unshift(existingDb);
      }
      return { email: existingDb, skipped: true };
    }
  }

  const aiResult = await processEmail({
    subject: cleanSubject,
    body: cleanBody,
    sender: cleanSender,
    receivedAt,
  });

  const newId = generateUuid();
  const savedAttachmentFiles = [];

  if (Array.isArray(attachmentPayloads) && attachmentPayloads.length > 0) {
    for (const att of attachmentPayloads) {
      const savedName = saveAttachmentFile(newId, att.filename, att.content);
      savedAttachmentFiles.push(savedName || att.filename);
    }
  }

  const attachmentList =
    savedAttachmentFiles.length > 0
      ? savedAttachmentFiles
      : Array.isArray(attachments)
      ? attachments
      : [];

  const resolvedDeadlineLabel = aiResult.deadline
    ? deriveDeadlineLabel(cleanSubject, aiResult.deadline_label)
    : aiResult.deadline_label || null;
  const resolvedSource = aiResult._source || 'heuristic';
  const resolvedModel = aiResult._model || (resolvedSource === 'gemini' ? 'gemini-3.5-flash-lite' : resolvedSource);

  const newEmail = {
    id: newId,
    user_id: userId,
    source,
    external_id: externalId,
    gmail_id: source === 'gmail' ? externalId : undefined,
    content_hash: contentHash,
    recipient: recipient || userId || null,
    sender: cleanSender,
    senderName: resolvedSenderName,
    subject: cleanSubject,
    body: cleanBody,
    attachments: attachmentList,
    has_saved_attachments: savedAttachmentFiles.length > 0,
    category: aiResult.category,
    user_category: null,
    priority: aiResult.priority,
    user_priority: null,
    priority_reason: aiResult.priority_reason,
    received_at: receivedAt,
    deadline: aiResult.deadline,
    user_deadline: null,
    deadline_completed: false,
    deadline_label: resolvedDeadlineLabel,
    deadline_confidence: aiResult.deadline_confidence,
    required_action: aiResult.required_action,
    needs_followup: aiResult.needs_followup,
    needs_reply: aiResult.needs_reply,
    needs_action: aiResult.needs_action,
    reminder_note: aiResult.reminder_note,
    summary: aiResult.summary,
    analysis_source: resolvedSource,
    model: resolvedModel,
    status: aiResult.status || 'processed',
    error: aiResult.error || null,
    edited_by_user: false,
    is_read: Boolean(isRead),
    is_archived: false,
    ai_processed: aiResult.status !== 'failed',
    processed_at: new Date().toISOString(),
  };

  memoryEmails.unshift(newEmail);
  await upsertEmailAndAnalysisToDb(supabase, newEmail, userId);
  await syncReminderForEmail(newEmail, aiResult);

  return { email: newEmail, skipped: false, aiResult };
}

async function ingestBatchWithPacing(items, { source, userId }) {
  const newEmails = [];
  let skippedCount = 0;
  const BATCH_SIZE = 2;
  const DELAY_MS = 1000;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const slice = items.slice(i, i + BATCH_SIZE);
    let calledAiInBatch = false;

    for (const item of slice) {
      const res = await ingestSingleEmail({
        source,
        externalId: item.external_id || null,
        sender: item.sender,
        senderName: item.senderName,
        recipient: item.recipient || null,
        subject: item.subject,
        body: item.body,
        receivedAt: item.receivedAt || new Date().toISOString(),
        attachments: item.attachments || [],
        attachmentPayloads: item.attachmentPayloads || [],
        userId,
        isRead: Boolean(item.is_read),
      });

      if (res.skipped) {
        skippedCount += 1;
      } else {
        calledAiInBatch = true;
        newEmails.push(res.email);
      }
    }

    if (calledAiInBatch && i + BATCH_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return { newEmails, skippedCount };
}

// ============================================================================
// Sync Runners (reused by individual endpoints + Sync All button)
// ============================================================================

async function syncSingleGoogleAccount(key, userId) {
  const account = connectedAccounts.get(key);
  const secret = privateAccountSecrets.get(key);
  if (!account || !secret?.tokens?.access_token) return { emails: [], skipped: 0 };

  const client = createGoogleOAuthClient();
  if (!client) return { emails: [], skipped: 0 };

  client.setCredentials(secret.tokens);

  // Refresh if token is close to expiry
  if (secret.tokens.expiry_date && Date.now() > secret.tokens.expiry_date - 60000 && secret.tokens.refresh_token) {
    try {
      const { credentials } = await client.refreshAccessToken();
      secret.tokens = { ...secret.tokens, ...credentials };
      client.setCredentials(secret.tokens);
      persistSecretsLocal();
      if (supabase && userId) {
        try {
          await supabase.from('user_tokens').upsert(
            {
              user_id: userId.toLowerCase(),
              provider: 'google',
              access_token: encryptString(secret.tokens.access_token),
              refresh_token: secret.tokens.refresh_token ? encryptString(secret.tokens.refresh_token) : null,
              token_expiry: secret.tokens.expiry_date ? new Date(secret.tokens.expiry_date).toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,provider' }
          );
        } catch (dbErr) {
          console.warn('⚠️ Supabase refreshed token sync error:', dbErr.message);
        }
      }
    } catch {
      // Proceed; API will catch invalid/revoked token cleanly
    }
  }

  const gmail = google.gmail({ version: 'v1', auth: client });
  const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
  const messages = listRes.data.messages || [];
  const parsedMessages = [];
  let skipped = 0;

  for (const msgRef of messages.slice(0, 15)) {
    const exists = memoryEmails.some(e => e.gmail_id === msgRef.id || e.external_id === msgRef.id);
    if (exists) {
      skipped += 1;
      continue;
    }

    const msg = await gmail.users.messages.get({ userId: 'me', id: msgRef.id, format: 'full' });
    const headers = msg.data.payload?.headers || [];
    const getHeader = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject') || 'No Subject';
    const sender = getHeader('From') || 'Unknown Sender';
    const dateHeader = getHeader('Date');
    const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

    let body = msg.data.snippet || '';
    const findPlainPart = parts => {
      for (const part of parts || []) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          const nested = findPlainPart(part.parts);
          if (nested) return nested;
        }
      }
      return null;
    };
    const extractedText = findPlainPart(msg.data.payload?.parts);
    if (extractedText) {
      body = extractedText;
    } else if (msg.data.payload?.body?.data) {
      body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
    }

    parsedMessages.push({
      external_id: msgRef.id,
      recipient: account.email,
      sender,
      senderName: sender.split('<')[0].trim() || 'Collegiate Sender',
      subject,
      body,
      receivedAt,
      attachments: [],
    });
  }

  promoteToLiveModeIfNeeded();
  const { newEmails, skippedCount } = await ingestBatchWithPacing(parsedMessages, {
    source: 'gmail',
    userId: userId || account.email,
  });

  connectedAccounts.set(key, { ...account, lastSyncedAt: new Date().toISOString() });
  return { emails: newEmails, skipped: skipped + skippedCount };
}

async function syncSingleMicrosoftAccount(key, userId) {
  const account = connectedAccounts.get(key);
  const secret = privateAccountSecrets.get(key);
  if (!account || !secret?.tokens?.access_token) return { emails: [], skipped: 0 };

  const { messages, tokens: updatedTokens } = await fetchMicrosoftMessages(secret.tokens, 15);
  secret.tokens = updatedTokens;
  persistSecretsLocal();

  promoteToLiveModeIfNeeded();
  const { newEmails, skippedCount } = await ingestBatchWithPacing(messages, {
    source: 'microsoft',
    userId: userId || account.email,
  });

  connectedAccounts.set(key, { ...account, lastSyncedAt: new Date().toISOString() });
  return { emails: newEmails, skipped: skippedCount };
}

async function syncSingleImapAccount(key, userId, limit = 15) {
  const account = connectedAccounts.get(key);
  const secret = privateAccountSecrets.get(key);
  if (!account || !secret) return { emails: [], skipped: 0 };

  const { messages } = await fetchImapMessages({ ...secret, limit });
  promoteToLiveModeIfNeeded();
  const { newEmails, skippedCount } = await ingestBatchWithPacing(messages, {
    source: 'imap',
    userId: userId || secret.email,
  });

  connectedAccounts.set(key, { ...account, lastSyncedAt: new Date().toISOString() });
  return { emails: newEmails, skipped: skippedCount };
}

// ============================================================================
// Routes
// ============================================================================

app.get('/api/health', async (req, res) => {
  await dbReadyPromise;
  const candidate = resolveUserId(req);
  const accounts = isValidUserIdentity(candidate) ? getPublicConnectedAccounts(candidate) : [];
  const aiProbe = await probeAiStatus();

  res.json({
    status: 'ok',
    service: 'Campus Cue API',
    dataMode,
    aiMode: aiProbe.aiMode,
    model: aiProbe.model,
    aiModel: aiProbe.model,
    aiError: aiProbe.error,
    error: aiProbe.error,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    geminiConfigured: aiProbe.aiMode === 'live',
    supabaseConnected: Boolean(supabase),
    localPersistenceEnabled: process.env.DISABLE_LOCAL_PERSIST !== 'true',
    gmailConfigured: googleConfigured,
    microsoftConfigured: isMicrosoftOAuthConfigured(),
    gmailConnected: accounts.some(a => a.provider === 'google'),
    microsoftConnected: accounts.some(a => a.provider === 'microsoft'),
    imapSupported: true,
    connectedAccountsCount: accounts.length,
    connectedAccounts: accounts,
  });
});

// Configure or clear Gemini API Key at runtime (writes to gitignored server/.env & probes live AI)
app.post('/api/settings/ai-key', async (req, res) => {
  const rawKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

  if (rawKey && (rawKey.includes('your_gemini') || rawKey.length < 15)) {
    return res.status(400).json({ error: 'Please enter a valid Gemini API key from Google AI Studio.' });
  }

  process.env.GEMINI_API_KEY = rawKey;
  reloadAiClient(rawKey);
  reloadDigestAiClient(rawKey);

  if (process.env.DISABLE_LOCAL_PERSIST !== 'true') {
    try {
      const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const envPath = path.join(serverRoot, '.env');
      let lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
      let updatedKey = false;
      lines = lines.map((line) => {
        if (line.startsWith('GEMINI_API_KEY=')) {
          updatedKey = true;
          return `GEMINI_API_KEY=${rawKey}`;
        }
        return line;
      });
      if (!updatedKey) {
        lines.push(`GEMINI_API_KEY=${rawKey}`);
      }
      fs.writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });
    } catch (err) {
      console.warn('⚠️ Could not persist GEMINI_API_KEY to server/.env:', err.message);
    }
  }

  const aiProbe = await probeAiStatus();
  const isLive = aiProbe.aiMode === 'live';

  res.json({
    success: true,
    geminiConfigured: isLive,
    aiMode: aiProbe.aiMode,
    model: aiProbe.model,
    aiModel: aiProbe.model,
    aiError: aiProbe.error,
    message: isLive
      ? `Gemini key verified live on ${aiProbe.model}! You can reprocess any basic-analysis emails now.`
      : rawKey
      ? `Key saved, but AI probe stayed offline: ${aiProbe.error}`
      : 'Gemini API key cleared. Switched to offline basic-analysis mode.',
  });
});

app.get('/api/emails', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { category, priority, status, unreadOnly, includeArchived, onlyArchived, page, limit } = req.query;

  try {
    if (supabase) {
      const dbUserEmails = await fetchAllEmailsFromDb(supabase, userId);
      if (Array.isArray(dbUserEmails)) {
        if (dbUserEmails.length > 0) dataMode = 'live';
        memoryEmails = [
          ...dbUserEmails,
          ...memoryEmails.filter(e => String(e.user_id || '').toLowerCase() !== userId),
        ];
      }
    }

    let results = memoryEmails.filter(e => isEmailVisibleToUser(e, userId));

    if (onlyArchived === 'true') {
      results = results.filter(e => Boolean(e.is_archived));
    } else if (includeArchived !== 'true') {
      results = results.filter(e => !e.is_archived);
    }

    if (category && category !== 'All') {
      results = results.filter(e => getEffectiveCategory(e).toLowerCase() === category.toLowerCase());
    }

    if (priority && priority !== 'All') {
      results = results.filter(e => getEffectivePriority(e).toLowerCase() === priority.toLowerCase());
    }

    if (unreadOnly === 'true' || status === 'unread') {
      results = results.filter(e => !e.is_read);
    } else if (status === 'read') {
      results = results.filter(e => e.is_read);
    }

    const total = results.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 0;

    let paginated = results;
    if (limitNum > 0) {
      const start = (pageNum - 1) * limitNum;
      paginated = results.slice(start, start + limitNum);
    }

    res.json({
      dataMode: demoDisabledUsers.has(userId) ? 'live' : dataMode,
      emails: paginated,
      count: paginated.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1,
      source: supabase ? 'supabase' : dataMode === 'live' ? 'local_live_store' : 'sample_data',
    });
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Failed to fetch emails', details: err.message });
  }
});

// Download attachment saved during .eml / IMAP ingestion
app.get('/api/emails/:id/attachments/:filename', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id, filename } = req.params;
  const idx = await findOrLoadEmailIndex(id, userId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Email not found for active user' });
  }

  const att = readAttachmentFile(id, filename);
  if (!att) {
    return res.status(404).json({
      error: 'Attachment binary not available',
      message: 'This email only contains attachment filename metadata (e.g., showcase sample or webmail snippet). Upload the .eml file or sync via IMAP to download actual attachments.',
    });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
  res.send(att.buffer);
});

app.post('/api/emails/process', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id, subject, body, sender, recipient, received_at, receivedAt, save_as_new, force_reprocess } = req.body;

  let emailIndex = -1;
  let targetEmail = null;
  if (id) {
    emailIndex = await findOrLoadEmailIndex(id, userId);
    if (emailIndex !== -1) targetEmail = memoryEmails[emailIndex];
    else return res.status(404).json({ error: 'Email not found for active user' });
  }

  const emailToProcess = {
    subject: subject || targetEmail?.subject || '',
    body: body || targetEmail?.body || '',
    sender: sender || targetEmail?.sender || 'Unknown Sender',
    receivedAt: received_at || receivedAt || targetEmail?.received_at || new Date().toISOString(),
  };

  if (!emailToProcess.subject && !emailToProcess.body) {
    return res.status(400).json({ error: 'Subject and body are required to process an email' });
  }

  try {
    if (id && targetEmail) {
      const aiResult = await processEmail(emailToProcess);
      const resolvedSource = aiResult._source || 'heuristic';
      const resolvedModel = aiResult._model || (resolvedSource === 'gemini' ? 'gemini-3.5-flash-lite' : resolvedSource);
      const updated = {
        ...targetEmail,
        content_hash: computeContentHash(emailToProcess.sender, emailToProcess.subject, emailToProcess.body),
        category: aiResult.category,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        deadline: aiResult.deadline,
        deadline_label: aiResult.deadline
          ? deriveDeadlineLabel(emailToProcess.subject, aiResult.deadline_label)
          : null,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        needs_reply: aiResult.needs_reply,
        needs_action: aiResult.needs_action,
        reminder_note: aiResult.reminder_note,
        analysis_source: resolvedSource,
        model: resolvedModel,
        status: aiResult.status || 'processed',
        error: aiResult.error || null,
        ai_processed: aiResult.status !== 'failed',
        processed_at: new Date().toISOString(),
      };

      memoryEmails[emailIndex] = updated;
      await upsertEmailAndAnalysisToDb(supabase, updated, targetEmail.user_id || userId);
      await syncReminderForEmail(updated, aiResult);
      memoryDigestsByUser.delete(userId);
      persistAllLocal();

      return res.json({ message: 'Email processed successfully with AI', email: updated, aiResult });
    }

    if (save_as_new) {
      demoDisabledUsers.add(userId);
      promoteToLiveModeIfNeeded();
      const result = await ingestSingleEmail({
        source: 'paste',
        sender: emailToProcess.sender,
        recipient: recipient || userId,
        subject: emailToProcess.subject,
        body: emailToProcess.body,
        receivedAt: emailToProcess.receivedAt,
        userId,
        forceReprocess: Boolean(force_reprocess),
      });

      if (!result.skipped) {
        memoryDigestsByUser.delete(userId);
      }
      persistAllLocal();

      if (result.skipped) {
        return res.json({
          message: 'Email already processed. Reusing existing intelligence.',
          skipped: true,
          email: result.email,
          aiResult: result.email,
        });
      }

      return res.status(201).json({
        message: result.email.status === 'failed'
          ? 'Email saved, but AI analysis failed (basic fallback active)'
          : result.email.analysis_source === 'gemini'
          ? 'Email ingested, analyzed with Gemini and saved'
          : 'Email saved with basic analysis (AI offline)',
        email: result.email,
        aiResult: result.aiResult,
      });
    }

    const aiResult = await processEmail(emailToProcess);
    res.json({
      message: 'Email analyzed successfully',
      content_hash: computeContentHash(emailToProcess.sender, emailToProcess.subject, emailToProcess.body),
      aiResult,
    });
  } catch (err) {
    console.error('Error processing email with AI:', err);
    res.status(500).json({ error: 'Failed to process email with AI', details: redactSecrets(err.message) });
  }
});

app.post('/api/emails/:id/reprocess', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const emailIndex = await findOrLoadEmailIndex(id, userId);
  const targetEmail = emailIndex !== -1 ? memoryEmails[emailIndex] : null;

  if (!targetEmail) {
    return res.status(404).json({ error: 'Email not found to reprocess' });
  }

  try {
    const aiResult = await processEmail({
      subject: targetEmail.subject,
      body: targetEmail.body,
      sender: targetEmail.sender,
      receivedAt: targetEmail.received_at,
    });

    const resolvedSource = aiResult._source || 'heuristic';
    const resolvedModel = aiResult._model || (resolvedSource === 'gemini' ? 'gemini-3.5-flash-lite' : resolvedSource);
    const updated = {
      ...targetEmail,
      category: aiResult.category,
      summary: aiResult.summary,
      priority: aiResult.priority,
      priority_reason: aiResult.priority_reason,
      deadline: aiResult.deadline,
      deadline_label: aiResult.deadline
        ? deriveDeadlineLabel(targetEmail.subject, aiResult.deadline_label)
        : null,
      deadline_confidence: aiResult.deadline_confidence,
      required_action: aiResult.required_action,
      needs_followup: aiResult.needs_followup,
      needs_reply: aiResult.needs_reply,
      needs_action: aiResult.needs_action,
      reminder_note: aiResult.reminder_note,
      analysis_source: resolvedSource,
      model: resolvedModel,
      status: aiResult.status || 'processed',
      error: aiResult.error || null,
      ai_processed: aiResult.status !== 'failed',
      processed_at: new Date().toISOString(),
    };

    memoryEmails[emailIndex] = updated;
    await upsertEmailAndAnalysisToDb(supabase, updated, targetEmail.user_id || userId);
    await syncReminderForEmail(updated, aiResult);
    memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.json({
      message: updated.status === 'failed'
        ? 'Reprocess attempted, but Gemini AI failed'
        : resolvedSource === 'gemini'
        ? 'Email reprocessed successfully with Gemini AI'
        : 'AI offline — basic heuristic analysis refreshed',
      email: updated,
      aiResult,
    });
  } catch (err) {
    console.error('Error reprocessing email:', err);
    res.status(500).json({ error: 'Failed to reprocess email', details: redactSecrets(err.message) });
  }
});

async function runBatchReprocess(userId, { onlyBasic = false } = {}) {
  if (supabase) {
    const dbEmails = await fetchAllEmailsFromDb(supabase, userId);
    if (Array.isArray(dbEmails)) {
      memoryEmails = [
        ...dbEmails,
        ...memoryEmails.filter(e => String(e.user_id || '').toLowerCase() !== userId),
      ];
    }
  }
  const visible = memoryEmails.filter(e => {
    if (e.is_archived || !isEmailVisibleToUser(e, userId)) return false;
    if (!onlyBasic) return true;
    return e.source !== 'sample' && (e.analysis_source !== 'gemini' || e.status === 'failed');
  });

  const results = [];
  const BATCH_SIZE = 2;
  const DELAY_BETWEEN_BATCHES_MS = 1200;

  for (let i = 0; i < visible.length; i += BATCH_SIZE) {
    const slice = visible.slice(i, i + BATCH_SIZE);
    const batchPromises = slice.map(async (email) => {
      const aiResult = await processEmail({
        subject: email.subject,
        body: email.body,
        sender: email.sender,
        receivedAt: email.received_at,
      });

      const resolvedSource = aiResult._source || 'heuristic';
      const resolvedModel = aiResult._model || (resolvedSource === 'gemini' ? 'gemini-3.5-flash-lite' : resolvedSource);
      const updated = {
        ...email,
        category: aiResult.category,
        summary: aiResult.summary,
        priority: aiResult.priority,
        priority_reason: aiResult.priority_reason,
        deadline: aiResult.deadline,
        deadline_label: aiResult.deadline
          ? deriveDeadlineLabel(email.subject, aiResult.deadline_label)
          : null,
        deadline_confidence: aiResult.deadline_confidence,
        required_action: aiResult.required_action,
        needs_followup: aiResult.needs_followup,
        needs_reply: aiResult.needs_reply,
        needs_action: aiResult.needs_action,
        reminder_note: aiResult.reminder_note,
        analysis_source: resolvedSource,
        model: resolvedModel,
        status: aiResult.status || 'processed',
        error: aiResult.error || null,
        ai_processed: aiResult.status !== 'failed',
        processed_at: new Date().toISOString(),
      };

      await upsertEmailAndAnalysisToDb(supabase, updated, email.user_id || userId);
      await syncReminderForEmail(updated, aiResult);
      return updated;
    });

    const batchResults = await Promise.all(batchPromises);
    for (const updated of batchResults) {
      const idx = memoryEmails.findIndex(e => e.id === updated.id);
      if (idx !== -1) memoryEmails[idx] = updated;
      results.push(updated);
    }

    if (i + BATCH_SIZE < visible.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  memoryDigestsByUser.delete(userId);
  persistAllLocal();
  return results;
}

app.post('/api/emails/process-all', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  try {
    const results = await runBatchReprocess(userId, { onlyBasic: false });
    res.json({
      message: `Batch processed ${results.length} emails with queue pacing`,
      count: results.length,
      emails: results,
    });
  } catch (err) {
    console.error('Error batch processing emails:', err);
    res.status(500).json({ error: 'Failed to batch process emails', details: redactSecrets(err.message) });
  }
});

app.post('/api/emails/reprocess-basic', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  try {
    const results = await runBatchReprocess(userId, { onlyBasic: true });
    res.json({
      message: results.length === 0
        ? 'No basic-analysis or failed emails found to reprocess.'
        : `Reprocessed ${results.length} basic/failed email(s)`,
      count: results.length,
      emails: results,
    });
  } catch (err) {
    console.error('Error reprocessing basic emails:', err);
    res.status(500).json({ error: 'Failed to reprocess basic emails', details: redactSecrets(err.message) });
  }
});

app.patch('/api/emails/:id/override', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const { category, priority, deadline, deadline_completed } = req.body;

  const emailIndex = await findOrLoadEmailIndex(id, userId);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  const email = memoryEmails[emailIndex];

  if (category !== undefined) {
    email.user_category = category === 'default' || category === null ? null : category;
  }
  if (priority !== undefined) {
    email.user_priority = priority === 'default' || priority === null ? null : priority;
  }
  if (deadline !== undefined) {
    if (deadline === null || deadline === '') {
      email.user_deadline = null;
    } else {
      const sanitized = validateAndSanitizeDate(deadline);
      email.user_deadline = sanitized.validDate || deadline;
    }
  }
  if (typeof deadline_completed === 'boolean') {
    email.deadline_completed = deadline_completed;
  }

  email.edited_by_user = Boolean(email.user_category || email.user_priority || email.user_deadline);

  if (deadline !== undefined) {
    const remIndex = memoryReminders.findIndex(r => (r.email_id || r.emailId) === email.id);
    if (remIndex >= 0) {
      memoryReminders[remIndex].due_date = getEffectiveDeadline(email);
    }
  }

  memoryDigestsByUser.delete(userId);
  persistAllLocal();

  await updateEmailOverridesInDb(supabase, id, {
    user_category: email.user_category,
    user_priority: email.user_priority,
    user_deadline: email.user_deadline,
    deadline_completed: email.deadline_completed,
  }, userId);

  res.json({ message: 'Student correction saved successfully', email });
});

app.patch('/api/emails/:id/category', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const { category } = req.body;

  const validCategories = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];
  const targetCategory = category === 'default' ? null : category;

  if (targetCategory && !validCategories.includes(targetCategory)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const emailIndex = await findOrLoadEmailIndex(id, userId);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  memoryEmails[emailIndex].user_category = targetCategory;
  memoryEmails[emailIndex].edited_by_user = Boolean(
    targetCategory || memoryEmails[emailIndex].user_priority || memoryEmails[emailIndex].user_deadline
  );

  memoryDigestsByUser.delete(userId);
  persistAllLocal();
  await updateEmailOverridesInDb(supabase, id, { user_category: targetCategory }, userId);

  res.json({ message: 'User category override saved successfully', email: memoryEmails[emailIndex] });
});

app.patch('/api/emails/:id/read', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const { is_read } = req.body;

  const emailIndex = await findOrLoadEmailIndex(id, userId);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  const nextRead = is_read !== undefined ? Boolean(is_read) : !memoryEmails[emailIndex].is_read;
  memoryEmails[emailIndex].is_read = nextRead;
  persistAllLocal();
  await updateEmailReadInDb(supabase, id, nextRead, userId);

  res.json({ message: 'Email read status updated', email: memoryEmails[emailIndex] });
});

app.patch('/api/emails/:id/archive', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const { is_archived } = req.body;

  const emailIndex = await findOrLoadEmailIndex(id, userId);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  const nextArchived = is_archived !== undefined ? Boolean(is_archived) : !memoryEmails[emailIndex].is_archived;
  memoryEmails[emailIndex].is_archived = nextArchived;
  memoryDigestsByUser.delete(userId);
  persistAllLocal();
  await updateEmailArchivedInDb(supabase, id, nextArchived, userId);

  res.json({
    message: nextArchived ? 'Email archived' : 'Email restored to Inbox',
    email: memoryEmails[emailIndex],
  });
});

app.delete('/api/emails/:id', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const emailIndex = await findOrLoadEmailIndex(id, userId);
  if (emailIndex === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }

  memoryEmails.splice(emailIndex, 1);
  memoryReminders = memoryReminders.filter(r => (r.email_id || r.emailId) !== id);
  memoryDigestsByUser.delete(userId);
  deleteAttachmentFolder(id);
  persistAllLocal();
  await deleteEmailFromDb(supabase, id, userId);

  res.json({ message: 'Email deleted permanently', id });
});

// Clear Showcase Samples -> Switch to Clean Real Inbox Mode (never touches Supabase)
app.post('/api/emails/clear-demo', (req, res) => {
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  demoDisabledUsers.add(userId);
  promoteToLiveModeIfNeeded();
  memoryDigestsByUser.delete(userId);
  persistAllLocal();
  res.json({
    message: 'Sample showcase emails cleared. Campus Cue is now in Live Inbox Mode.',
    dataMode: 'live',
    emailsCount: memoryEmails.filter(e => isEmailVisibleToUser(e, userId)).length,
  });
});

app.post('/api/reset-demo', (req, res) => {
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  demoDisabledUsers.delete(userId);
  dataMode = 'demo';
  const nonSampleEmails = memoryEmails.filter(e => e.source !== 'sample' && !String(e.id || '').startsWith('cue-'));
  const nonSampleIds = new Set(nonSampleEmails.map(e => e.id));
  const nonSampleReminders = memoryReminders.filter(r => nonSampleIds.has(r.email_id || r.emailId));
  memoryEmails = [
    ...nonSampleEmails,
    ...JSON.parse(JSON.stringify(sampleEmails.map(e => ({ ...e, source: 'sample', user_id: 'sample_showcase' })))),
  ];
  memoryReminders = [
    ...nonSampleReminders,
    ...JSON.parse(JSON.stringify(sampleReminders)),
  ];
  memoryDigestsByUser.delete(userId);
  memoryDigest = JSON.parse(JSON.stringify(sampleDigest));
  persistAllLocal();

  res.json({
    message: 'Demo state reset successfully to default showcase data',
    dataMode,
    emailsCount: memoryEmails.filter(e => isEmailVisibleToUser(e, userId)).length,
    remindersCount: memoryReminders.length,
  });
});

// ============================================================================
// Academic Command Center Digest Routes
// ============================================================================

async function handleGetTodayDigest(req, res) {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const studentName = req.query.studentName || '';

  try {
    if (supabase) {
      const dbUserEmails = await fetchAllEmailsFromDb(supabase, userId);
      if (Array.isArray(dbUserEmails)) {
        if (dbUserEmails.length > 0) dataMode = 'live';
        memoryEmails = [
          ...dbUserEmails,
          ...memoryEmails.filter(e => String(e.user_id || '').toLowerCase() !== userId),
        ];
      }

      if (demoDisabledUsers.has(userId) || dataMode === 'live') {
        const { data, error } = await supabase
          .from('digests')
          .select('*')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.content) {
          memoryDigestsByUser.set(userId, data.content);
          return res.json({ digest: data.content, source: 'supabase_cached', date: todayStr });
        }
      }
    }

    const userCached = memoryDigestsByUser.get(userId);
    if (userCached && userCached.date === todayStr && (!studentName || userCached.studentName === studentName)) {
      return res.json({ digest: userCached, source: 'memory_cached', date: todayStr });
    }

    const activeEmails = memoryEmails.filter(e => !e.is_archived && isEmailVisibleToUser(e, userId));
    if (activeEmails.length === 0) {
      return res.json({
        digest: {
          date: todayStr,
          studentName,
          overview: 'Your live inbox is currently empty. Connect an email account, upload .eml files, or paste an email to generate your daily briefing.',
          important_new_emails: [],
          upcoming_deadlines: [],
          uncertain_deadlines: [],
          urgent_announcements: [],
          placement_opportunities: [],
          pending_actions: [],
          _source: 'empty',
          model: 'none',
          ai_error: null,
        },
        source: 'empty_live',
        date: todayStr,
      });
    }

    if (!demoDisabledUsers.has(userId) && dataMode === 'demo' && activeEmails.every(e => e.source === 'sample')) {
      return res.json({
        digest: {
          ...sampleDigest,
          date: todayStr,
          studentName,
          _source: 'heuristic',
          model: 'sample',
          ai_error: null,
        },
        source: 'sample_digest',
        date: todayStr,
      });
    }

    const synthesized = await generateAcademicDigest({
      structuredEmails: activeEmails,
      studentName,
    });
    synthesized.studentName = studentName;

    memoryDigestsByUser.set(userId, synthesized);
    persistAllLocal();

    if (activeEmails.some(e => e.source !== 'sample')) {
      await upsertDigestToDb(supabase, userId, todayStr, synthesized);
    }

    res.json({ digest: synthesized, source: 'generated', date: todayStr });
  } catch (err) {
    console.error('Error fetching today digest:', err);
    res.status(500).json({ error: 'Failed to retrieve academic digest', details: redactSecrets(err.message) });
  }
}

app.get('/api/digest/today', handleGetTodayDigest);
app.get('/api/digest', handleGetTodayDigest);

app.post('/api/digest/generate', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { studentName } = req.body || {};
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    if (supabase) {
      const dbUserEmails = await fetchAllEmailsFromDb(supabase, userId);
      if (Array.isArray(dbUserEmails)) {
        if (dbUserEmails.length > 0) dataMode = 'live';
        memoryEmails = [
          ...dbUserEmails,
          ...memoryEmails.filter(e => String(e.user_id || '').toLowerCase() !== userId),
        ];
      }
    }

    const activeEmails = memoryEmails.filter(e => !e.is_archived && isEmailVisibleToUser(e, userId));
    const digest = await generateAcademicDigest({
      structuredEmails: activeEmails,
      studentName: studentName || '',
    });
    digest.studentName = studentName || '';

    memoryDigestsByUser.set(userId, digest);
    persistAllLocal();

    if (activeEmails.some(e => e.source !== 'sample')) {
      await upsertDigestToDb(supabase, userId, todayStr, digest);
    }

    res.json({
      message: digest._source === 'gemini'
        ? 'Academic digest refreshed with Gemini AI'
        : 'Digest built with basic offline analysis',
      digest,
    });
  } catch (err) {
    console.error('Error generating academic digest:', err);
    res.status(500).json({ error: 'Failed to generate academic digest', details: redactSecrets(err.message) });
  }
});

// ============================================================================
// Follow-up Reminders Routes
// ============================================================================

app.get('/api/reminders', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  try {
    if (supabase) {
      const dbUserEmails = await fetchAllEmailsFromDb(supabase, userId);
      if (Array.isArray(dbUserEmails)) {
        if (dbUserEmails.length > 0) dataMode = 'live';
        memoryEmails = [
          ...dbUserEmails,
          ...memoryEmails.filter(e => String(e.user_id || '').toLowerCase() !== userId),
        ];
      }
      const userEmails = memoryEmails.filter(e => isEmailVisibleToUser(e, userId));
      const dbUserReminders = await fetchRemindersFromDb(supabase, userEmails, userId);
      if (Array.isArray(dbUserReminders)) {
        memoryReminders = [
          ...dbUserReminders,
          ...memoryReminders.filter(r => String(r.user_id || '').toLowerCase() !== userId),
        ];
      }
    }

    const activeIds = new Set(
      memoryEmails
        .filter(e => !e.is_archived && isEmailVisibleToUser(e, userId))
        .map(e => e.id)
    );
    const visibleReminders = memoryReminders.filter(r => activeIds.has(r.email_id || r.emailId));

    const now = new Date();
    const activePending = visibleReminders.filter(r => {
      if (r.status === 'done' || r.is_completed) return false;
      if (r.status === 'snoozed' && r.snoozed_until && new Date(r.snoozed_until) > now) return false;
      return true;
    });

    const replyReminders = visibleReminders.filter(r => r.reminder_type === 'reply');
    const actionReminders = visibleReminders.filter(r => r.reminder_type !== 'reply');

    res.json({
      reminders: visibleReminders,
      pendingCount: activePending.length,
      replyCount: replyReminders.filter(r => r.status === 'pending').length,
      actionCount: actionReminders.filter(r => r.status === 'pending').length,
      source: supabase ? 'supabase' : 'local_store',
    });
  } catch (err) {
    console.error('Error retrieving reminders:', err);
    res.status(500).json({ error: 'Failed to retrieve reminders', details: err.message });
  }
});

app.patch('/api/reminders/:id', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id } = req.params;
  const { status, is_completed, snooze_days } = req.body;

  const reminderIndex = await findOrLoadReminderIndex(id, userId);
  if (reminderIndex === -1) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  const reminder = memoryReminders[reminderIndex];
  const emailIdx = await findOrLoadEmailIndex(reminder.email_id || reminder.emailId, userId);
  if (emailIdx === -1) {
    return res.status(404).json({ error: 'Reminder not found for active user' });
  }

  if (status) {
    reminder.status = status;
    reminder.is_completed = status === 'done';
  } else if (typeof is_completed === 'boolean') {
    reminder.is_completed = is_completed;
    reminder.status = is_completed ? 'done' : 'pending';
  }

  if (status === 'snoozed') {
    const days = parseInt(snooze_days, 10) || 1;
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    reminder.snoozed_until = snoozeDate.toISOString();
  } else if (status === 'pending' || status === 'done') {
    reminder.snoozed_until = null;
  }

  persistAllLocal();

  await updateReminderInDb(supabase, id, {
    status: reminder.status,
    snoozed_until: reminder.snoozed_until,
  }, userId);

  res.json({ message: 'Reminder updated successfully', reminder });
});

// ============================================================================
// Universal Real Email Ingestion (EML, IMAP, Google OAuth, Microsoft OAuth, Webhook)
// ============================================================================

async function parseRawEmailBuffer(buffer, fallbackTitle = 'No Subject') {
  const parsed = await simpleParser(buffer);
  const senderText = parsed.from?.text || parsed.headers.get('from') || 'Unknown Sender';
  const senderName = parsed.from?.value?.[0]?.name || senderText.split('<')[0].trim() || 'Collegiate Sender';
  const recipientText = parsed.to?.text || parsed.headers.get('to') || null;
  const subject = parsed.subject || fallbackTitle || 'No Subject';
  const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();

  let bodyText = (parsed.text || '').trim();
  if (!bodyText && parsed.html) {
    bodyText = parsed.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const validAtts = (parsed.attachments || []).filter(a => a.filename);
  return {
    external_id: parsed.messageId || null,
    sender: senderText,
    senderName,
    recipient: recipientText,
    subject,
    body: bodyText || 'Empty correspondence body.',
    receivedAt,
    attachments: validAtts.map(a => a.filename),
    attachmentPayloads: validAtts.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}

app.post('/api/emails/upload-eml', upload.array('emlFiles', 15), async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No .eml or .mbox files provided in upload request' });
    }

    const parsedItems = [];
    for (const file of req.files) {
      const lowerName = (file.originalname || '').toLowerCase();
      if (lowerName.endsWith('.mbox')) {
        // Split standard MBOX archive by envelope separator lines ("From address timestamp")
        const rawStr = file.buffer.toString('utf8');
        const chunks = rawStr.split(/\r?\n(?=From \S+ )/).map(chunk => chunk.replace(/^From [^\r\n]*\r?\n/, '')).filter(c => c.trim().length > 20);
        for (const msgChunk of chunks.slice(0, 40)) {
          parsedItems.push(await parseRawEmailBuffer(Buffer.from(msgChunk, 'utf8'), 'Imported Archive Email'));
        }
      } else {
        parsedItems.push(await parseRawEmailBuffer(file.buffer, file.originalname.replace(/\.eml$/i, '')));
      }
    }

    demoDisabledUsers.add(userId);
    promoteToLiveModeIfNeeded();
    const { newEmails, skippedCount } = await ingestBatchWithPacing(parsedItems, {
      source: 'eml',
      userId,
    });

    if (newEmails.length > 0) memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.status(201).json({
      message: `Processed ${newEmails.length} email(s)${skippedCount > 0 ? ` (${skippedCount} duplicate skipped)` : ''}`,
      count: newEmails.length,
      skippedCount,
      emails: newEmails,
    });
  } catch (err) {
    console.error('Error processing .eml/.mbox files:', err);
    res.status(500).json({ error: 'Failed to parse uploaded email files', details: err.message });
  }
});

app.get('/api/emails/detect-provider', async (req, res) => {
  const email = req.query.email || '';
  const config = await detectProviderConfig(email);
  res.json(config);
});

app.post('/api/emails/connect-imap', async (req, res) => {
  await dbReadyPromise;
  const headerUser = resolveUserId(req);
  const { email, password, host, port, secure, limit } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email ID and Password / App Password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ownerUserId = isValidUserIdentity(headerUser) ? headerUser : normalizedEmail;
  if (!isValidUserIdentity(ownerUserId)) {
    return res.status(401).json({ error: 'Unauthorized: valid x-user-email identity is required.' });
  }

  try {
    const { account, messages } = await fetchImapMessages({
      email: normalizedEmail,
      password,
      host,
      port,
      secure,
      limit: Number(limit) || 15,
    });

    const key = `imap:${normalizedEmail}`;
    const accountRecord = {
      ...account,
      ownerUserId,
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };
    connectedAccounts.set(key, accountRecord);
    privateAccountSecrets.set(key, {
      email: normalizedEmail,
      password,
      host: account.host,
      port: account.port,
      secure: account.secure,
    });
    persistSecretsLocal();

    demoDisabledUsers.add(ownerUserId);
    promoteToLiveModeIfNeeded();
    const { newEmails, skippedCount } = await ingestBatchWithPacing(messages, {
      source: 'imap',
      userId: ownerUserId,
    });

    memoryDigestsByUser.delete(ownerUserId);
    persistAllLocal();

    res.json({
      success: true,
      dataMode: 'live',
      account: accountRecord,
      count: newEmails.length,
      fetchedCount: messages.length,
      skippedCount,
      message: `Connected ${normalizedEmail} (${account.providerLabel}) — synced ${newEmails.length} real email(s)${skippedCount > 0 ? `, ${skippedCount} already indexed` : ''}.`,
      emails: newEmails,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: 'IMAP Connection Failed', details: err.message });
  }
});

app.post('/api/emails/sync-imap', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const targetEmail = (req.body?.email || '').trim().toLowerCase();
  const imapKeys = Array.from(connectedAccounts.keys()).filter(k => {
    const acc = connectedAccounts.get(k);
    const owned = acc?.ownerUserId === userId || acc?.email === userId;
    return k.startsWith('imap:') && owned && (!targetEmail || k === `imap:${targetEmail}`);
  });

  if (imapKeys.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No IMAP account connected. Connect an email ID first.',
    });
  }

  try {
    const allSynced = [];
    let totalSkipped = 0;

    for (const key of imapKeys) {
      const resSync = await syncSingleImapAccount(key, userId, Number(req.body?.limit) || 15);
      allSynced.push(...resSync.emails);
      totalSkipped += resSync.skipped;
    }

    if (allSynced.length > 0) memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.json({
      success: true,
      count: allSynced.length,
      skippedCount: totalSkipped,
      message: `Synced ${allSynced.length} new email(s)${totalSkipped > 0 ? ` (${totalSkipped} duplicates skipped)` : ''}`,
      emails: allSynced,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'IMAP Sync Failed', details: err.message });
  }
});

// Unified Sync Across ALL Connected Accounts (Gmail OAuth + Microsoft OAuth + IMAP)
app.post('/api/emails/sync-all', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const accounts = getPublicConnectedAccounts(userId);
  if (accounts.length === 0) {
    return res.json({ success: true, count: 0, skippedCount: 0, message: 'No live email accounts connected yet.' });
  }

  const allEmails = [];
  let totalSkipped = 0;
  const errors = [];

  for (const acc of accounts) {
    const key = `${acc.provider}:${acc.email}`;
    try {
      let r = { emails: [], skipped: 0 };
      if (acc.provider === 'google') r = await syncSingleGoogleAccount(key, userId);
      else if (acc.provider === 'microsoft') r = await syncSingleMicrosoftAccount(key, userId);
      else r = await syncSingleImapAccount(key, userId, 15);

      allEmails.push(...r.emails);
      totalSkipped += r.skipped;
    } catch (err) {
      errors.push(`${acc.email}: ${err.message}`);
    }
  }

  if (allEmails.length > 0) memoryDigestsByUser.delete(userId);
  persistAllLocal();

  res.json({
    success: errors.length === 0 || allEmails.length > 0,
    count: allEmails.length,
    skippedCount: totalSkipped,
    errors,
    emails: allEmails,
    message:
      allEmails.length > 0
        ? `Synced ${allEmails.length} new email(s) across ${accounts.length} connected account(s)`
        : errors.length > 0
        ? `Sync errors: ${errors.join('; ')}`
        : 'All connected inboxes are already up to date.',
  });
});

app.post('/api/emails/disconnect', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const email = (req.body?.email || '').trim().toLowerCase();
  const provider = (req.body?.provider || '').trim().toLowerCase();

  if (email && provider) {
    const key = `${provider}:${email}`;
    const acc = connectedAccounts.get(key);
    if (acc && (acc.ownerUserId === userId || acc.email === userId)) {
      connectedAccounts.delete(key);
      privateAccountSecrets.delete(key);
      await deleteUserTokenFromDb(supabase, email, provider);
    }
  } else if (email) {
    for (const key of Array.from(connectedAccounts.keys())) {
      const acc = connectedAccounts.get(key);
      if (key.endsWith(`:${email}`) && (acc?.ownerUserId === userId || acc?.email === userId)) {
        connectedAccounts.delete(key);
        privateAccountSecrets.delete(key);
      }
    }
    await deleteUserTokenFromDb(supabase, email);
  }

  persistSecretsLocal();
  persistAllLocal();

  res.json({ success: true, accounts: getPublicConnectedAccounts(userId) });
});

app.post('/api/emails/inbound', async (req, res) => {
  await dbReadyPromise;
  const configuredSecret = process.env.INBOUND_WEBHOOK_SECRET;
  if (configuredSecret) {
    const provided = req.headers['x-webhook-secret'] || req.query.secret || req.body?.secret;
    if (provided !== configuredSecret) {
      return res.status(401).json({ error: 'Invalid or missing webhook secret' });
    }
  }

  const bodyPayload = req.body || {};
  const from = bodyPayload.from || bodyPayload.sender || 'Forwarded Sender';
  const to = bodyPayload.to || bodyPayload.recipient || null;
  const subject = bodyPayload.subject || bodyPayload.Subject || 'Forwarded Email';
  const rawHtml = bodyPayload.html || bodyPayload['body-html'] || '';
  let text = bodyPayload.text || bodyPayload.body || bodyPayload['body-plain'] || bodyPayload['stripped-text'] || '';

  if (!text && rawHtml) {
    text = rawHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!subject && !text) {
    return res.status(400).json({ error: 'Inbound payload must include subject or text/body content.' });
  }

  const receivedAt = bodyPayload.date || bodyPayload.received_at || new Date().toISOString();
  const recipientStr = Array.isArray(to) ? to[0] : to;
  const headerUser = resolveUserId(req);
  const bodyUser = resolveUserId(req, recipientStr);
  const userId = isValidUserIdentity(headerUser) ? headerUser : bodyUser;
  if (!isValidUserIdentity(userId)) {
    return res.status(401).json({ error: 'Unauthorized: valid x-user-email header or recipient email is required.' });
  }

  try {
    demoDisabledUsers.add(userId);
    promoteToLiveModeIfNeeded();
    const result = await ingestSingleEmail({
      source: 'webhook',
      externalId: bodyPayload.messageId || bodyPayload['Message-Id'] || null,
      sender: from,
      recipient: recipientStr || userId,
      subject,
      body: text,
      receivedAt: new Date(receivedAt).toISOString(),
      attachments: Array.isArray(bodyPayload.attachments) ? bodyPayload.attachments : [],
      userId,
    });

    if (!result.skipped) memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.status(result.skipped ? 200 : 201).json({
      success: true,
      skipped: result.skipped,
      message: result.skipped ? 'Duplicate forwarded email skipped' : 'Inbound email processed and saved',
      email: result.email,
    });
  } catch (err) {
    console.error('Inbound webhook error:', err);
    res.status(500).json({ error: 'Failed to process inbound webhook email', details: redactSecrets(err.message) });
  }
});

// Batch Inbound Ingestion (for Browser Webmail Extension, Google Apps Script, & Forwarding batches)
app.post('/api/emails/inbound-batch', async (req, res) => {
  await dbReadyPromise;
  const configuredSecret = process.env.INBOUND_WEBHOOK_SECRET;
  if (configuredSecret) {
    const provided = req.headers['x-webhook-secret'] || req.query.secret || req.body?.secret;
    if (provided !== configuredSecret) {
      return res.status(401).json({ error: 'Invalid or missing webhook secret' });
    }
  }

  const rawList = Array.isArray(req.body?.emails) ? req.body.emails : [];
  if (rawList.length === 0) {
    return res.status(400).json({ error: 'Expected non-empty emails array in request body' });
  }

  const explicitUser = req.body?.userEmail || '';
  const headerUser = resolveUserId(req);
  const userId = isValidUserIdentity(headerUser) ? headerUser : resolveUserId(req, explicitUser);
  if (!isValidUserIdentity(userId)) {
    return res.status(401).json({ error: 'Unauthorized: valid x-user-email header or userEmail is required.' });
  }

  const normalizedItems = rawList.slice(0, 30).map((item) => {
    const from = item.from || item.sender || 'Webmail Sender';
    const to = item.to || item.recipient || explicitUser || userId;
    const subject = item.subject || 'No Subject';
    let text = item.text || item.body || '';
    if (!text && item.html) {
      text = String(item.html)
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return {
      external_id: item.external_id || item.messageId || null,
      sender: from,
      senderName: from.includes('<') ? from.split('<')[0].trim() : from,
      recipient: Array.isArray(to) ? to[0] : to,
      subject,
      body: text || subject,
      receivedAt: item.date || item.received_at || new Date().toISOString(),
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      is_read: Boolean(item.is_read),
    };
  });

  try {
    demoDisabledUsers.add(userId);
    promoteToLiveModeIfNeeded();
    const { newEmails, skippedCount } = await ingestBatchWithPacing(normalizedItems, {
      source: 'webhook',
      userId,
    });

    if (newEmails.length > 0) memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.status(201).json({
      success: true,
      count: newEmails.length,
      skippedCount,
      message: `Imported ${newEmails.length} real email(s)${skippedCount > 0 ? ` (${skippedCount} duplicate skipped)` : ''}`,
      emails: newEmails,
    });
  } catch (err) {
    console.error('Inbound batch error:', err);
    res.status(500).json({ error: 'Failed to process inbound batch', details: redactSecrets(err.message) });
  }
});

// Connected Accounts & Auth Status
app.get('/api/auth/status', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const accounts = getPublicConnectedAccounts(userId);
  const googleAccounts = accounts.filter(a => a.provider === 'google');
  const microsoftAccounts = accounts.filter(a => a.provider === 'microsoft');

  res.json({
    dataMode: demoDisabledUsers.has(userId) ? 'live' : dataMode,
    configured: googleConfigured,
    googleConfigured,
    microsoftConfigured: isMicrosoftOAuthConfigured(),
    connected: accounts.length > 0,
    gmailConnected: googleAccounts.length > 0,
    microsoftConnected: microsoftAccounts.length > 0,
    connectedEmail: googleAccounts[0]?.email || microsoftAccounts[0]?.email || accounts[0]?.email || null,
    accounts,
    webhookProtected: Boolean(process.env.INBOUND_WEBHOOK_SECRET),
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    redirectUri: GOOGLE_REDIRECT_URI,
  });
});

// Google OAuth Routes
app.get('/api/auth/google', (req, res) => {
  const client = createGoogleOAuthClient();
  if (!client) {
    return res.status(400).json({
      error: 'Google OAuth not configured on backend',
      code: 'CONFIG_MISSING',
      message: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env, or use Universal IMAP sync with a 16-char Google App Password.',
    });
  }

  try {
    const loginHint = typeof req.query.login_hint === 'string' && req.query.login_hint.includes('@')
      ? req.query.login_hint.trim()
      : undefined;

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      ...(loginHint ? { login_hint: loginHint } : {}),
    });

    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate Google OAuth', details: err.message });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/?gmail_error=${encodeURIComponent(error)}`);
  }

  const client = createGoogleOAuthClient();
  if (!code || !client) {
    return res.redirect(`${FRONTEND_URL}/?gmail_error=no_code_provided`);
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    let profileEmail = 'connected-gmail';
    try {
      const gmail = google.gmail({ version: 'v1', auth: client });
      const profileRes = await gmail.users.getProfile({ userId: 'me' });
      if (profileRes?.data?.emailAddress) {
        profileEmail = profileRes.data.emailAddress.toLowerCase();
      }
    } catch (profErr) {
      console.warn('⚠️ Could not fetch Gmail profile email:', profErr.message);
    }

    const key = `google:${profileEmail}`;
    connectedAccounts.set(key, {
      email: profileEmail,
      ownerUserId: profileEmail,
      provider: 'google',
      providerLabel: 'Gmail OAuth 2.0',
      host: 'gmail.googleapis.com',
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    });
    privateAccountSecrets.set(key, { tokens });
    persistSecretsLocal();

    if (supabase) {
      try {
        await supabase.from('user_tokens').upsert(
          {
            user_id: profileEmail,
            provider: 'google',
            access_token: encryptString(tokens.access_token),
            refresh_token: tokens.refresh_token ? encryptString(tokens.refresh_token) : null,
            token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' }
        );
      } catch (dbErr) {
        console.warn('⚠️ Supabase token save error:', dbErr.message);
      }
    }

    // Auto-import immediately on OAuth return so the user lands directly on real emails!
    try {
      await syncSingleGoogleAccount(key, profileEmail);
    } catch (syncErr) {
      console.warn('⚠️ Initial Gmail sync on callback failed:', syncErr.message);
    }
    persistAllLocal();

    res.redirect(`${FRONTEND_URL}/?gmail=connected&email=${encodeURIComponent(profileEmail)}`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/?gmail_error=${encodeURIComponent(err.message)}`);
  }
});

app.post('/api/emails/sync-gmail', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const requestedEmail = (req.body?.email || '').trim().toLowerCase();
  const googleKeys = Array.from(connectedAccounts.keys()).filter(k => {
    const acc = connectedAccounts.get(k);
    const owned = acc?.ownerUserId === userId || acc?.email === userId;
    return k.startsWith('google:') && owned && (!requestedEmail || k === `google:${requestedEmail}`);
  });

  if (!googleConfigured || googleKeys.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Gmail OAuth Not Connected',
      code: 'NOT_CONNECTED',
      message: 'Connect a Gmail/Google Workspace account via OAuth, or use Universal IMAP Sync (App Password).',
    });
  }

  try {
    const allNewEmails = [];
    let totalSkipped = 0;

    for (const key of googleKeys) {
      const r = await syncSingleGoogleAccount(key, userId);
      allNewEmails.push(...r.emails);
      totalSkipped += r.skipped;
    }

    if (allNewEmails.length > 0) memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.json({
      success: true,
      count: allNewEmails.length,
      skippedCount: totalSkipped,
      message: `Synced ${allNewEmails.length} new collegiate email(s) from Gmail${totalSkipped > 0 ? ` (${totalSkipped} already indexed)` : ''}`,
      emails: allNewEmails,
    });
  } catch (err) {
    const isRestricted =
      err.message?.includes('access_denied') ||
      err.message?.includes('403') ||
      err.message?.includes('admin_policy_enforced');

    res.status(isRestricted ? 403 : 500).json({
      success: false,
      error: isRestricted ? 'Institutional Workspace Restriction' : 'Gmail Sync Error',
      details: isRestricted
        ? 'Your college Google Workspace administrator restricts third-party OAuth apps. You can use Universal IMAP (App Password), .eml upload, or manual paste.'
        : err.message,
    });
  }
});

// Microsoft / Outlook / Office 365 OAuth Routes
app.get('/api/auth/microsoft', (req, res) => {
  if (!isMicrosoftOAuthConfigured()) {
    return res.status(400).json({
      error: 'Microsoft OAuth not configured on backend',
      code: 'CONFIG_MISSING',
      message: 'Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to server/.env (Azure App Registration with Mail.Read) to connect Outlook/M365 accounts via OAuth.',
    });
  }
  try {
    const loginHint = typeof req.query.login_hint === 'string' ? req.query.login_hint : '';
    res.redirect(buildMicrosoftAuthUrl(loginHint));
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate Microsoft OAuth', details: err.message });
  }
});

app.get('/api/auth/microsoft/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/?microsoft_error=${encodeURIComponent(error_description || error)}`);
  }
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/?microsoft_error=no_code_provided`);
  }

  try {
    const tokens = await exchangeMicrosoftCodeForTokens(code);
    const profileEmail = (await fetchMicrosoftProfileEmail(tokens.access_token)) || 'connected-outlook';
    const key = `microsoft:${profileEmail}`;

    connectedAccounts.set(key, {
      email: profileEmail,
      ownerUserId: profileEmail,
      provider: 'microsoft',
      providerLabel: 'Microsoft 365 / Outlook OAuth',
      host: 'graph.microsoft.com',
      connectedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    });
    privateAccountSecrets.set(key, { tokens });
    persistSecretsLocal();

    if (supabase) {
      try {
        await supabase.from('user_tokens').upsert(
          {
            user_id: profileEmail,
            provider: 'microsoft',
            access_token: encryptString(tokens.access_token),
            refresh_token: tokens.refresh_token ? encryptString(tokens.refresh_token) : null,
            token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' }
        );
      } catch (dbErr) {
        console.warn('⚠️ Supabase Microsoft token save error:', dbErr.message);
      }
    }

    try {
      await syncSingleMicrosoftAccount(key, profileEmail);
    } catch (syncErr) {
      console.warn('⚠️ Initial Outlook sync on callback failed:', syncErr.message);
    }
    persistAllLocal();

    res.redirect(`${FRONTEND_URL}/?microsoft=connected&email=${encodeURIComponent(profileEmail)}`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/?microsoft_error=${encodeURIComponent(err.message)}`);
  }
});

app.post('/api/emails/sync-microsoft', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const requestedEmail = (req.body?.email || '').trim().toLowerCase();
  const msKeys = Array.from(connectedAccounts.keys()).filter(k => {
    const acc = connectedAccounts.get(k);
    const owned = acc?.ownerUserId === userId || acc?.email === userId;
    return k.startsWith('microsoft:') && owned && (!requestedEmail || k === `microsoft:${requestedEmail}`);
  });

  if (!isMicrosoftOAuthConfigured() || msKeys.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Microsoft / Outlook Not Connected',
      message: 'Connect an Outlook or Microsoft 365 account via OAuth first.',
    });
  }

  try {
    const allNewEmails = [];
    let totalSkipped = 0;

    for (const key of msKeys) {
      const r = await syncSingleMicrosoftAccount(key, userId);
      allNewEmails.push(...r.emails);
      totalSkipped += r.skipped;
    }

    if (allNewEmails.length > 0) memoryDigestsByUser.delete(userId);
    persistAllLocal();

    res.json({
      success: true,
      count: allNewEmails.length,
      skippedCount: totalSkipped,
      message: `Synced ${allNewEmails.length} new email(s) from Microsoft / Outlook`,
      emails: allNewEmails,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Microsoft Sync Error', details: redactSecrets(err.message) });
  }
});

// Smart AI Reply Drafter
app.post('/api/emails/reply', async (req, res) => {
  await dbReadyPromise;
  const userId = requireUserIdentity(req, res);
  if (!userId) return;

  const { id, intent, studentNotes, studentName, email: providedEmail } = req.body;
  const emailIdx = id ? await findOrLoadEmailIndex(id, userId) : -1;
  const targetEmail = (emailIdx !== -1 ? memoryEmails[emailIdx] : null) || providedEmail;

  if (!targetEmail) {
    return res.status(404).json({ error: 'Email not found to draft reply' });
  }

  try {
    const draft = await generateReplyDraft({
      subject: targetEmail.subject,
      body: targetEmail.body,
      sender: targetEmail.sender,
      action: targetEmail.required_action || targetEmail.followup_action,
      intent: intent || 'polite_confirm',
      studentNotes: studentNotes || '',
      studentName: studentName || '',
    });

    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate reply draft', details: redactSecrets(err.message) });
  }
});

// Start HTTP server only when launched directly (allows in-process Express testing without socket binding)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, () => {
    console.log(`🚀 Campus Cue server listening on port ${PORT} (Mode: ${dataMode})`);
    console.log(`📡 Health-check: http://localhost:${PORT}/api/health`);
    console.log(`✉️  Emails API:  http://localhost:${PORT}/api/emails`);
    console.log(`🔌 IMAP Detect:  http://localhost:${PORT}/api/emails/detect-provider`);
  });
}
