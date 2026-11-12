import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'inbox-store.json');
const VAULT_PATH = path.join(DATA_DIR, 'vault.json');
const KEY_PATH = path.join(DATA_DIR, '.keystore');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getOrCreateEncryptionKey() {
  if (process.env.TOKEN_ENCRYPTION_KEY && process.env.TOKEN_ENCRYPTION_KEY.length >= 32) {
    return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest();
  }
  ensureDir(DATA_DIR);
  if (fs.existsSync(KEY_PATH)) {
    const raw = fs.readFileSync(KEY_PATH, 'utf8').trim();
    if (raw.length === 64) return Buffer.from(raw, 'hex');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
}

function encryptPayload(obj) {
  const key = getOrCreateEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptPayload(tokenStr) {
  const [ivHex, tagHex, dataHex] = String(tokenStr || '').split(':');
  if (!ivHex || !tagHex || !dataHex) return null;
  const key = getOrCreateEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

export function encryptString(plaintext) {
  if (!plaintext) return plaintext || null;
  if (String(plaintext).startsWith('enc:v1:')) return plaintext;
  return `enc:v1:${encryptPayload({ v: String(plaintext) })}`;
}

export function decryptString(ciphertext) {
  if (!ciphertext) return null;
  const raw = String(ciphertext);
  if (!raw.startsWith('enc:v1:')) return raw;
  const parsed = decryptPayload(raw.slice('enc:v1:'.length));
  return parsed?.v ?? null;
}

export function loadPersistedStore(defaultState) {
  if (process.env.DISABLE_LOCAL_PERSIST === 'true') {
    return {
      mode: 'demo',
      emails: JSON.parse(JSON.stringify(defaultState.emails || [])),
      reminders: JSON.parse(JSON.stringify(defaultState.reminders || [])),
      digest: defaultState.digest ? JSON.parse(JSON.stringify(defaultState.digest)) : null,
      accounts: [],
      existsOnDisk: false,
    };
  }
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return {
        mode: 'demo',
        emails: JSON.parse(JSON.stringify(defaultState.emails || [])),
        reminders: JSON.parse(JSON.stringify(defaultState.reminders || [])),
        digest: defaultState.digest ? JSON.parse(JSON.stringify(defaultState.digest)) : null,
        accounts: [],
        existsOnDisk: false,
      };
    }
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      mode: raw.mode === 'live' ? 'live' : 'demo',
      emails: Array.isArray(raw.emails) ? raw.emails : [],
      reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
      digest: raw.digest || null,
      accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
      existsOnDisk: true,
    };
  } catch (err) {
    console.warn('⚠️ Failed to read local persistence store:', err.message);
    return {
      mode: 'demo',
      emails: JSON.parse(JSON.stringify(defaultState.emails || [])),
      reminders: JSON.parse(JSON.stringify(defaultState.reminders || [])),
      digest: defaultState.digest ? JSON.parse(JSON.stringify(defaultState.digest)) : null,
      accounts: [],
      existsOnDisk: false,
    };
  }
}

export function savePersistedStore(state) {
  if (process.env.DISABLE_LOCAL_PERSIST === 'true') return;
  try {
    ensureDir(DATA_DIR);
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(
      tmpPath,
      JSON.stringify(
        {
          mode: state.mode || 'live',
          emails: state.emails || [],
          reminders: state.reminders || [],
          digest: state.digest || null,
          accounts: state.accounts || [],
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.warn('⚠️ Failed to save local persistence store:', err.message);
  }
}

export function loadEncryptedSecretsMap() {
  const result = new Map();
  if (process.env.DISABLE_LOCAL_PERSIST === 'true') return result;
  try {
    if (!fs.existsSync(VAULT_PATH)) return result;
    const raw = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
    for (const [k, enc] of Object.entries(raw || {})) {
      try {
        const val = decryptPayload(enc);
        if (val) result.set(k, val);
      } catch {
        // Ignore stale or undecryptable entries
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not load encrypted credentials vault:', err.message);
  }
  return result;
}

export function saveEncryptedSecretsMap(secretsMap) {
  if (process.env.DISABLE_LOCAL_PERSIST === 'true') return;
  try {
    ensureDir(DATA_DIR);
    const payload = {};
    for (const [k, v] of secretsMap.entries()) {
      payload[k] = encryptPayload(v);
    }
    const tmpPath = `${VAULT_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
    fs.renameSync(tmpPath, VAULT_PATH);
  } catch (err) {
    console.warn('⚠️ Could not persist encrypted credentials vault:', err.message);
  }
}

function sanitizeFilename(name = 'attachment.bin') {
  return path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment.bin';
}

export function saveAttachmentFile(emailId, filename, buffer) {
  if (process.env.DISABLE_LOCAL_PERSIST === 'true' || !buffer || !Buffer.isBuffer(buffer)) return null;
  try {
    // Cap per-attachment local cache at 10MB
    if (buffer.length > 10 * 1024 * 1024) return null;
    const targetDir = path.join(ATTACHMENTS_DIR, path.basename(String(emailId)));
    ensureDir(targetDir);
    const safeName = sanitizeFilename(filename);
    const fullPath = path.join(targetDir, safeName);
    fs.writeFileSync(fullPath, buffer);
    return safeName;
  } catch {
    return null;
  }
}

export function readAttachmentFile(emailId, filename) {
  try {
    const safeId = path.basename(String(emailId));
    const safeName = sanitizeFilename(filename);
    const fullPath = path.join(ATTACHMENTS_DIR, safeId, safeName);
    if (!fs.existsSync(fullPath)) return null;
    return {
      path: fullPath,
      filename: safeName,
      buffer: fs.readFileSync(fullPath),
    };
  } catch {
    return null;
  }
}

export function deleteAttachmentFolder(emailId) {
  try {
    const safeId = path.basename(String(emailId));
    const targetDir = path.join(ATTACHMENTS_DIR, safeId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup error
  }
}

