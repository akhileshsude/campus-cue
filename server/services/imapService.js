import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import dns from 'node:dns/promises';

const KNOWN_PROVIDERS = {
  gmail: {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    supportsOAuth: true,
    authTypeHint: '16-character Google App Password (or OAuth 2.0)',
    prerequisites: [
      'Enable IMAP in Gmail Settings -> Forwarding and POP/IMAP -> Enable IMAP.',
      'Turn on 2-Step Verification on your Google Account (myaccount.google.com/security).',
      'Create a 16-character App Password (myaccount.google.com/apppasswords) and paste it here (not your normal login password).',
      'Alternatively, use the Google OAuth button if GOOGLE_CLIENT_ID is configured on the server.',
    ],
  },
  outlook: {
    id: 'outlook',
    label: 'Outlook / Hotmail / Microsoft 365',
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
    supportsOAuth: false,
    supportsMicrosoftOAuth: true,
    authTypeHint: 'App Password or Microsoft OAuth 2.0',
    prerequisites: [
      'Option A (Recommended — Microsoft OAuth 2.0): Set MICROSOFT_CLIENT_ID & MICROSOFT_CLIENT_SECRET in server/.env and click Connect via Microsoft below.',
      'Option B (IMAP App Password): Enable POP/IMAP in Outlook Settings -> Mail -> Sync email & generate an App Password if Basic Auth is permitted.',
      'Note: Many Microsoft 365 university tenants block password IMAP completely. Use Microsoft OAuth, Auto-Forwarding Webhook, or .eml upload.',
    ],
  },
  yahoo: {
    id: 'yahoo',
    label: 'Yahoo Mail',
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    supportsOAuth: false,
    authTypeHint: 'Yahoo App Password',
    prerequisites: [
      'Open Yahoo Account Security (login.yahoo.com/account/security).',
      'Turn on Two-step verification and click "Generate app password" -> select Other App -> copy password.',
    ],
  },
  icloud: {
    id: 'icloud',
    label: 'Apple iCloud Mail',
    host: 'imap.mail.me.com',
    port: 993,
    secure: true,
    supportsOAuth: false,
    authTypeHint: 'Apple App-Specific Password',
    prerequisites: [
      'Sign in to appleid.apple.com with Two-Factor Authentication enabled.',
      'Go to Sign-In and Security -> App-Specific Passwords -> Generate password for Campus Cue.',
    ],
  },
  zoho: {
    id: 'zoho',
    label: 'Zoho Mail',
    host: 'imappro.zoho.com',
    port: 993,
    secure: true,
    supportsOAuth: false,
    authTypeHint: 'Zoho App Password (or Zoho password if 2FA is off)',
    prerequisites: [
      'Enable IMAP Access in Zoho Mail Settings -> Mail Accounts -> IMAP.',
      'For India (.in) accounts, use host imap.zoho.in; otherwise imappro.zoho.com (port 993).',
      'If Two-Factor Authentication is active, generate an Application-Specific Password in accounts.zoho.com.',
    ],
  },
  rediffmail: {
    id: 'rediffmail',
    label: 'Rediffmail',
    host: 'imap.rediffmail.com',
    port: 993,
    secure: true,
    supportsOAuth: false,
    authTypeHint: 'Rediffmail IMAP password',
    prerequisites: [
      'Ensure IMAP access is enabled in your Rediffmail Pro / account settings.',
    ],
  },
  fastmail: {
    id: 'fastmail',
    label: 'Fastmail',
    host: 'imap.fastmail.com',
    port: 993,
    secure: true,
    supportsOAuth: false,
    authTypeHint: 'Fastmail App Password',
    prerequisites: [
      'Go to Settings -> Privacy & Security -> App Passwords and create a dedicated IMAP access password.',
    ],
  },
  proton: {
    id: 'proton',
    label: 'Proton Mail (via Local Bridge)',
    host: '127.0.0.1',
    port: 1143,
    secure: false,
    supportsOAuth: false,
    authTypeHint: 'Proton Mail Bridge IMAP password',
    prerequisites: [
      'Proton Mail end-to-end encryption requires installing and running the official Proton Mail Bridge desktop app on this machine.',
      'Copy the Bridge-generated IMAP password (host 127.0.0.1, port 1143). Or export emails as .eml / set up forwarding.',
    ],
  },
};

const DOMAIN_TO_PROVIDER = {
  'gmail.com': 'gmail',
  'googlemail.com': 'gmail',
  'outlook.com': 'outlook',
  'hotmail.com': 'outlook',
  'live.com': 'outlook',
  'msn.com': 'outlook',
  'yahoo.com': 'yahoo',
  'yahoo.co.in': 'yahoo',
  'yahoo.in': 'yahoo',
  'ymail.com': 'yahoo',
  'rocketmail.com': 'yahoo',
  'icloud.com': 'icloud',
  'me.com': 'icloud',
  'mac.com': 'icloud',
  'zoho.com': 'zoho',
  'zohomail.com': 'zoho',
  'zoho.in': 'zoho',
  'zohomail.in': 'zoho',
  'rediffmail.com': 'rediffmail',
  'fastmail.com': 'fastmail',
  'fastmail.fm': 'fastmail',
  'proton.me': 'proton',
  'protonmail.com': 'proton',
  'pm.me': 'proton',
};

/**
 * Safely resolve MX records with a short timeout so offline environments never stall.
 */
async function safeResolveMx(domain) {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 1800));
    const records = await Promise.race([dns.resolveMx(domain), timeout]);
    return Array.isArray(records) ? records.map((r) => (r.exchange || '').toLowerCase()) : [];
  } catch {
    return [];
  }
}

/**
 * Detects email provider, IMAP host/port, OAuth support, and user prerequisites for ANY email ID.
 */
export async function detectProviderConfig(rawEmail = '') {
  const email = (rawEmail || '').trim().toLowerCase();
  const atIdx = email.indexOf('@');

  if (atIdx < 1 || atIdx === email.length - 1 || !email.includes('.', atIdx)) {
    return {
      valid: false,
      email,
      domain: '',
      providerId: 'unknown',
      providerLabel: 'Invalid Email Format',
      host: '',
      port: 993,
      secure: true,
      supportsOAuth: false,
      authTypeHint: 'Enter a valid email address (e.g. name@college.edu)',
      prerequisites: ['Enter a valid email ID to auto-detect server settings and prerequisites.'],
    };
  }

  const domain = email.slice(atIdx + 1);
  const directKey = DOMAIN_TO_PROVIDER[domain];

  if (directKey) {
    const preset = KNOWN_PROVIDERS[directKey];
    let host = preset.host;
    if (domain.endsWith('.in') && directKey === 'zoho') {
      host = 'imap.zoho.in';
    }
    return {
      valid: true,
      email,
      domain,
      detectedVia: 'domain_preset',
      ...preset,
      host,
    };
  }

  // Custom / University domain (e.g., iitb.ac.in, stanford.edu, company.com)
  const mxHosts = await safeResolveMx(domain);
  const joinedMx = mxHosts.join(' ');

  if (joinedMx.includes('google.com') || joinedMx.includes('googlemail.com')) {
    return {
      valid: true,
      email,
      domain,
      detectedVia: 'mx_google_workspace',
      ...KNOWN_PROVIDERS.gmail,
      providerLabel: `Google Workspace (${domain})`,
      prerequisites: [
        `Detected that ${domain} mail is hosted on Google Workspace.`,
        'Option A (Gmail OAuth): Works if your university IT admin allows third-party Google apps and GOOGLE_CLIENT_ID is set.',
        'Option B (App Password + IMAP): Turn on 2-Step Verification and create a 16-char Google App Password (recommended if OAuth is in Testing mode).',
        'Fallback: If university IT blocks both OAuth and App Passwords, set up auto-forwarding to the Inbound Webhook or upload .eml files.',
      ],
    };
  }

  if (joinedMx.includes('outlook.com') || joinedMx.includes('protection.outlook')) {
    return {
      valid: true,
      email,
      domain,
      detectedVia: 'mx_microsoft_365',
      ...KNOWN_PROVIDERS.outlook,
      providerLabel: `Microsoft 365 (${domain})`,
      prerequisites: [
        `Detected that ${domain} mail is hosted on Microsoft 365 / Exchange Online.`,
        'Many university M365 tenants disable Basic IMAP authentication globally.',
        'If your college disables IMAP passwords, set up an Outlook auto-forward rule to the Campus Cue Webhook or export messages as .eml files.',
      ],
    };
  }

  if (joinedMx.includes('zoho')) {
    return {
      valid: true,
      email,
      domain,
      detectedVia: 'mx_zoho',
      ...KNOWN_PROVIDERS.zoho,
      host: domain.endsWith('.in') ? 'imap.zoho.in' : 'imappro.zoho.com',
      providerLabel: `Zoho Custom Domain (${domain})`,
    };
  }

  // Generic institutional webmail / Zimbra / Roundcube / Postfix / cPanel
  return {
    valid: true,
    email,
    domain,
    detectedVia: 'custom_imap',
    id: 'custom',
    label: `Custom / University Mail Server (${domain})`,
    providerLabel: `Custom / University Server (${domain})`,
    host: `mail.${domain}`,
    port: 993,
    secure: true,
    supportsOAuth: false,
    authTypeHint: 'College webmail password or App Password',
    prerequisites: [
      `Enter your university IMAP host (commonly mail.${domain} or imap.${domain}, SSL port 993). Check your campus IT webmail settings if unsure.`,
      'Enter your webmail login email ID and password (or App Password if campus SSO/2FA is enabled).',
      'If your campus webmail requires VPN or blocks external IMAP, use Auto-Forwarding Webhook or upload .eml files.',
    ],
  };
}

/**
 * Translate low-level IMAP / network errors into clear, actionable user guidance.
 */
function formatImapError(err, config) {
  const msg = (err?.message || '').toLowerCase();
  const responseText = (err?.responseText || '').toLowerCase();
  const combined = `${msg} ${responseText}`;

  if (combined.includes('application-specific password') || combined.includes('web login required')) {
    return `Provider requires an App Password instead of your normal password (${config.host}). Enable 2-Step Verification and generate an App Password in your account security settings.`;
  }

  if (combined.includes('authenticationfailed') || combined.includes('invalid credentials') || err?.authenticationFailed) {
    if (config.id === 'gmail') {
      return 'Gmail rejected credentials. Google blocks regular passwords over IMAP — generate a 16-character App Password at myaccount.google.com/apppasswords (requires 2-Step Verification).';
    }
    if (config.id === 'outlook') {
      return 'Microsoft/Outlook rejected IMAP Basic Auth login. Microsoft has disabled Basic password auth on most Outlook & university M365 accounts — please use Email Auto-Forwarding Webhook or .eml drop instead.';
    }
    return `Authentication failed on ${config.host}. Verify your email ID and password/App Password (and check that IMAP access is enabled in webmail settings).`;
  }

  if (combined.includes('enotfound') || combined.includes('getaddrinfo')) {
    return `Could not reach IMAP server "${config.host}". Expand Advanced IMAP Settings and enter the exact IMAP server host provided by your email/campus IT team (e.g., imap.${config.domain} or mail.${config.domain}).`;
  }

  if (combined.includes('etimedout') || combined.includes('timeout') || combined.includes('econnrefused')) {
    return `Connection timed out connecting to ${config.host}:${config.port}. Verify the host/port or check if your university mail server requires campus Wi-Fi/VPN.`;
  }

  return err?.message || 'Failed to connect to IMAP server.';
}

/**
 * Connects to ANY IMAP server, fetches recent INBOX emails, parses MIME content via mailparser, and closes cleanly.
 */
export async function fetchImapMessages({
  email,
  password,
  host,
  port = 993,
  secure = true,
  mailbox = 'INBOX',
  limit = 15,
}) {
  if (!email || !password) {
    throw new Error('Email ID and password (or App Password) are required.');
  }

  const detected = await detectProviderConfig(email);
  const resolvedHost = (host || detected.host || '').trim();
  const resolvedPort = Number(port) || detected.port || 993;
  const resolvedSecure = typeof secure === 'boolean' ? secure : detected.secure;

  if (!resolvedHost) {
    throw new Error('Could not determine IMAP host. Please provide an IMAP server hostname.');
  }

  const client = new ImapFlow({
    host: resolvedHost,
    port: resolvedPort,
    secure: resolvedSecure,
    auth: {
      user: email.trim(),
      pass: password,
    },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  const fetchedEmails = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox);

    try {
      const totalExists = client.mailbox?.exists || 0;
      if (totalExists === 0) {
        return {
          account: {
            email: email.trim().toLowerCase(),
            provider: detected.id || 'imap',
            providerLabel: detected.providerLabel || detected.label,
            host: resolvedHost,
            port: resolvedPort,
            secure: resolvedSecure,
          },
          messages: [],
        };
      }

      const startSeq = Math.max(1, totalExists - Math.max(1, Math.min(limit, 30)) + 1);
      const range = `${startSeq}:${totalExists}`;

      for await (const msg of client.fetch(range, { uid: true, envelope: true, source: true, internalDate: true })) {
        if (!msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const senderText = parsed.from?.text || msg.envelope?.from?.[0]?.address || 'Unknown Sender';
        const senderName =
          parsed.from?.value?.[0]?.name ||
          msg.envelope?.from?.[0]?.name ||
          senderText.split('<')[0].trim() ||
          'Collegiate Sender';

        const subject = parsed.subject || msg.envelope?.subject || 'No Subject';
        const receivedAt = parsed.date
          ? parsed.date.toISOString()
          : msg.internalDate
          ? new Date(msg.internalDate).toISOString()
          : new Date().toISOString();

        let bodyText = (parsed.text || '').trim();
        if (!bodyText && parsed.html) {
          bodyText = parsed.html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        if (!bodyText) {
          bodyText = 'Empty correspondence body.';
        }

        const validAttachments = (parsed.attachments || []).filter((a) => a.filename);
        const attachmentNames = validAttachments.map((a) => a.filename);

        fetchedEmails.push({
          external_id: parsed.messageId || `imap-${email.trim().toLowerCase()}-${msg.uid}`,
          recipient: email.trim().toLowerCase(),
          sender: senderText,
          senderName,
          subject,
          body: bodyText,
          receivedAt,
          attachments: attachmentNames,
          attachmentPayloads: validAttachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType || 'application/octet-stream',
            size: a.size || a.content?.length || 0,
          })),
        });
      }
    } finally {
      lock.release();
    }

    // Newest first
    fetchedEmails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    return {
      account: {
        email: email.trim().toLowerCase(),
        provider: detected.id || 'imap',
        providerLabel: detected.providerLabel || detected.label,
        host: resolvedHost,
        port: resolvedPort,
        secure: resolvedSecure,
      },
      messages: fetchedEmails,
    };
  } catch (err) {
    throw new Error(formatImapError(err, { ...detected, host: resolvedHost, port: resolvedPort }));
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore cleanup errors on already-closed sockets
    }
  }
}

