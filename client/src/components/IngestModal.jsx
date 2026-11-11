import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  MailPlus, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  ShieldAlert,
  Inbox,
  Server,
  KeyRound,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Webhook,
  Copy,
  Trash2,
  Info
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { apiFetch, apiUrl } from '../utils/api';

const SAMPLE_TEMPLATES = [
  {
    name: '⚡ Emergency Exam Shift',
    sender: 'Academic Evaluations Cell <exams@university.edu>',
    subject: 'URGENT: CS301 Operating Systems Exam Relocation to Room 402',
    body: `Dear CS301 Students,\n\nPlease be advised that due to electrical maintenance in Turing Hall, your Operating Systems midterm exam scheduled for tomorrow at 10:00 AM has been moved to Faraday Building, Room 402.\n\nYou must arrive by 9:45 AM with your student identity card. Programmable calculators and mobile phones are strictly barred.\n\nController of Examinations`,
  },
  {
    name: '💼 Placement Interview Slot',
    sender: 'Placement & Career Advisory <placements@university.edu>',
    subject: 'Amazon SDE Summer 2027: Technical Interview Slot Confirmation Required',
    body: `Dear Candidate,\n\nYou have been shortlisted for the final technical interview loop for Amazon's Software Development Engineer Internship.\n\nYou must log in to the placement handshake portal and confirm your preferred 45-minute interview time slot before tomorrow at 6:00 PM. Failure to confirm will result in forfeiting your spot to the waitlist.\n\nBest regards,\nCorporate Relations Team`,
  },
  {
    name: '📚 CS Milestone Submission',
    sender: 'Prof. Aris Thorne <a.thorne@university.edu>',
    subject: 'CS301: Distributed Storage Architecture PDF Due This Friday',
    body: `Hello Everyone,\n\nA reminder that your Phase 1 database schema diagram and distributed consensus architecture PDF are due this Friday by 11:59 PM. Please ensure your private GitHub repo has invited @ta-core as a collaborator.\n\nLate submissions will receive a 10% penalty per day.\n\nProf. Thorne`,
  },
  {
    name: '📸 Club Weekly Roundup',
    sender: 'Pixel Photography Club <pixel@university.edu>',
    subject: 'Pixel Newsletter #43: Golden Hour Composition & Sensor Cleaning',
    body: `Hey photographers!\n\nCheck out this week's featured shot by Maya on the South Quad clocktower! Read our new tutorial on how to clean your mirrorless camera sensor safely during foggy mornings.\n\nHappy clicking,\nPixel Club Committee`,
  },
];

/**
 * Parse raw clipboard text copied via Cmd+A / Cmd+C from Gmail, Outlook Web,
 * Apple Mail, or forwarded plain headers into { sender, subject, receivedDate, body }.
 */
function parseRawEmailText(rawText) {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { sender: '', subject: '', receivedDate: '', body: '', detectedCount: 0 };
  }

  const lines = normalized.split('\n');
  let sender = '';
  let subject = '';
  let receivedDate = '';
  const usedLineIndexes = new Set();

  const tryFormatLocalDateTime = (rawDate) => {
    if (!rawDate) return '';
    // Strip Gmail's trailing "(2 hours ago)" or similar parenthetical hints
    const cleaned = rawDate.replace(/\([^)]*\)/g, '').replace(/\bat\b/i, ' ').trim();
    const parsed = new Date(cleaned);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
      const tzOffsetMs = parsed.getTimezoneOffset() * 60000;
      return new Date(parsed.getTime() - tzOffsetMs).toISOString().slice(0, 16);
    }
    return '';
  };

  // Pass 1: Explicit RFC / Forwarded headers (From:, Subject:, Date:, Sent:)
  const headerScanLimit = Math.min(lines.length, 25);
  for (let i = 0; i < headerScanLimit; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const fromMatch = line.match(/^(?:From|Sender)\s*:\s*(.+)$/i);
    if (fromMatch && !sender) {
      sender = fromMatch[1].trim();
      usedLineIndexes.add(i);
      continue;
    }

    const subjectMatch = line.match(/^Subject\s*:\s*(.+)$/i);
    if (subjectMatch && !subject) {
      subject = subjectMatch[1].trim();
      usedLineIndexes.add(i);
      continue;
    }

    const dateMatch = line.match(/^(?:Date|Sent|Received)\s*:\s*(.+)$/i);
    if (dateMatch && !receivedDate) {
      const isoLocal = tryFormatLocalDateTime(dateMatch[1]);
      if (isoLocal) {
        receivedDate = isoLocal;
        usedLineIndexes.add(i);
      }
      continue;
    }

    if (/^(?:To|Cc|Bcc|Reply-To|Mailed-by|Signed-by)\s*:/i.test(line) || /^-+\s*Forwarded message\s*-+$/i.test(line)) {
      usedLineIndexes.add(i);
    }
  }

  // Pass 2: Gmail / Outlook Web Cmd+A / Cmd+C visual copy fallback
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const dateHintRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?|\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i;
  const chromeNoiseRegex = /^(?:Skip to content|Using .* screen readers|Compose|Inbox|Starred|Snoozed|Sent|Drafts|More|Labels|Reply|Reply all|Forward|Print all|In new window|External|Unsubscribe|to me|to .+)$/i;

  if (!sender || !subject) {
    const scanWindow = Math.min(lines.length, 30);
    let senderIdx = -1;

    for (let i = 0; i < scanWindow; i += 1) {
      const line = lines[i].trim();
      if (!line || usedLineIndexes.has(i)) continue;
      if (!sender && emailRegex.test(line) && line.length < 180) {
        sender = line.replace(/\s*\(via [^)]+\)\s*$/i, '').trim();
        senderIdx = i;
        usedLineIndexes.add(i);
        break;
      }
    }

    if (!receivedDate) {
      for (let i = Math.max(0, senderIdx - 2); i < Math.min(lines.length, (senderIdx >= 0 ? senderIdx : 0) + 6); i += 1) {
        const line = lines[i].trim();
        if (!line || usedLineIndexes.has(i)) continue;
        if (dateHintRegex.test(line) && line.length < 90) {
          const isoLocal = tryFormatLocalDateTime(line);
          if (isoLocal) {
            receivedDate = isoLocal;
            usedLineIndexes.add(i);
            break;
          }
        }
      }
    }

    if (!subject) {
      // Look immediately above senderIdx for a crisp subject line, else first clean short line
      const searchEnd = senderIdx > 0 ? senderIdx : Math.min(lines.length, 10);
      for (let i = searchEnd - 1; i >= 0; i -= 1) {
        const line = lines[i].trim();
        if (!line || usedLineIndexes.has(i) || chromeNoiseRegex.test(line)) {
          if (chromeNoiseRegex.test(line)) usedLineIndexes.add(i);
          continue;
        }
        if (line.length >= 3 && line.length <= 180) {
          subject = line;
          usedLineIndexes.add(i);
          break;
        }
      }

      if (!subject) {
        for (let i = 0; i < Math.min(lines.length, 10); i += 1) {
          const line = lines[i].trim();
          if (!line || usedLineIndexes.has(i) || chromeNoiseRegex.test(line)) continue;
          subject = line.slice(0, 140);
          usedLineIndexes.add(i);
          break;
        }
      }
    }
  }

  // Strip recognized header/chrome lines at top & trailing Reply/Forward chrome, keeping real body intact
  const bodyLines = lines.filter((line, idx) => {
    const trimmed = line.trim();
    if (usedLineIndexes.has(idx)) return false;
    if (idx < 25 && chromeNoiseRegex.test(trimmed)) return false;
    return true;
  });

  while (bodyLines.length > 0 && /^(?:Reply|Reply all|Forward|)$/i.test(bodyLines[bodyLines.length - 1].trim())) {
    bodyLines.pop();
  }

  const finalBody = bodyLines.join('\n').trim() || normalized;
  const detectedCount = [sender, subject, receivedDate].filter(Boolean).length;

  return {
    sender,
    subject: subject || finalBody.split('\n')[0].slice(0, 110),
    receivedDate,
    body: finalBody,
    detectedCount,
  };
}

export default function IngestModal({ 
  isOpen, 
  onClose, 
  onIngestEmail, 
  isIngesting,
  onEmlUploaded,
  onGmailSynced,
  initialTab = 'paste',
  oauthBanner = null,
}) {
  const { user, updateUser } = useUser();
  const [activeTab, setActiveTab] = useState(initialTab); // 'paste' | 'eml' | 'connect'

  // Tab 1: Paste Email state (Smart 1-Box Raw Paste + Structured Fallback)
  const [pasteMode, setPasteMode] = useState('smart'); // 'smart' | 'structured'
  const [rawPasteText, setRawPasteText] = useState('');
  const [clipboardNotice, setClipboardNotice] = useState(null);
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 16));
  const [pasteError, setPasteError] = useState(null);

  // Tab 2: .eml upload state
  const [emlFiles, setEmlFiles] = useState([]);
  const [isUploadingEml, setIsUploadingEml] = useState(false);
  const [emlUploadResult, setEmlUploadResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Tab 3: Universal Connect (IMAP + Gmail OAuth + Forwarding Webhook)
  const [authStatus, setAuthStatus] = useState({ configured: false, connected: false, accounts: [] });
  const [imapEmail, setImapEmail] = useState(user?.email || '');
  const [imapPassword, setImapPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapSecure, setImapSecure] = useState(true);
  const [showAdvancedImap, setShowAdvancedImap] = useState(false);
  const [providerInfo, setProviderInfo] = useState(null);
  const [isConnectingImap, setIsConnectingImap] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showWebhookBox, setShowWebhookBox] = useState(false);
  const [showAppsScriptBox, setShowAppsScriptBox] = useState(false);
  const [connectPath, setConnectPath] = useState('college-blocked'); // 'college-blocked' | 'direct-imap'
  const [showDevOptions, setShowDevOptions] = useState(false);

  // Sync initialTab & email if modal reopens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (user?.email && !imapEmail) {
        setImapEmail(user.email);
      }
      if (oauthBanner) {
        if (oauthBanner.type === 'success') setSyncMessage(oauthBanner.text);
        if (oauthBanner.type === 'error') setSyncError(oauthBanner.text);
      }
      refreshAuthStatus();
    }
  }, [isOpen, initialTab, oauthBanner]);

  const refreshAuthStatus = () => {
    apiFetch('/api/auth/status')
      .then(r => r.ok && r.json())
      .then(data => {
        if (data) setAuthStatus(data);
      })
      .catch(err => console.warn('Could not check auth status:', err));
  };

  // Live provider & prerequisite detection whenever student types any email ID
  useEffect(() => {
    const trimmed = (imapEmail || '').trim();
    if (!isOpen || !trimmed.includes('@') || !trimmed.includes('.', trimmed.indexOf('@'))) {
      setProviderInfo(null);
      return;
    }

    const timer = setTimeout(() => {
      apiFetch(`/api/emails/detect-provider?email=${encodeURIComponent(trimmed)}`)
        .then(r => r.ok && r.json())
        .then(data => {
          if (data && data.valid) {
            setProviderInfo(data);
            setImapHost(data.host || '');
            setImapPort(String(data.port || 993));
            setImapSecure(Boolean(data.secure));
          }
        })
        .catch(() => {});
    }, 280);

    return () => clearTimeout(timer);
  }, [imapEmail, isOpen]);

  if (!isOpen) return null;

  const handleApplyTemplate = (tpl) => {
    setSender(tpl.sender);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setRawPasteText(`From: ${tpl.sender}\nSubject: ${tpl.subject}\n\n${tpl.body}`);
    setPasteError(null);
    setClipboardNotice(null);
  };

  const applyRawPaste = (text) => {
    setRawPasteText(text);
    setPasteError(null);
    const parsed = parseRawEmailText(text);
    setSender(parsed.sender);
    setSubject(parsed.subject);
    setBody(parsed.body);
    if (parsed.receivedDate) {
      setReceivedDate(parsed.receivedDate);
    }
  };

  const handlePasteFromClipboard = async () => {
    setClipboardNotice(null);
    if (!navigator.clipboard?.readText) {
      setClipboardNotice('Clipboard button unsupported in this browser — click the box below and press Cmd+V.');
      return;
    }
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setClipboardNotice('Your clipboard is empty. Open any email, press Cmd+A then Cmd+C, and try again.');
        return;
      }
      applyRawPaste(clipText);
      setClipboardNotice('Pasted from clipboard and auto-extracted headers.');
    } catch {
      setClipboardNotice('Click the box below and press Cmd+V (clipboard access was blocked by the browser).');
    }
  };

  const handlePasteSubmit = (e) => {
    e.preventDefault();
    if (pasteMode === 'smart' && rawPasteText.trim() && (!subject.trim() || !body.trim())) {
      const parsed = parseRawEmailText(rawPasteText);
      if (parsed.subject) setSubject(parsed.subject);
      if (parsed.body) setBody(parsed.body);
      if (parsed.sender) setSender(parsed.sender);
    }

    const effectiveSubject = subject.trim();
    const effectiveBody = body.trim() || rawPasteText.trim();

    if (!effectiveSubject || !effectiveBody) {
      setPasteError(
        pasteMode === 'smart'
          ? 'Paste an email first (or switch to Structured Fields to type Subject & Body).'
          : 'Please provide both a subject and email body.'
      );
      return;
    }
    setPasteError(null);
    onIngestEmail({
      sender: sender.trim() || 'University Administration <admin@university.edu>',
      recipient: user?.email || undefined,
      subject: effectiveSubject,
      body: effectiveBody,
      received_at: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
    });
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.eml') || n.endsWith('.mbox');
    });
    if (files.length > 0) {
      setEmlFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.eml') || n.endsWith('.mbox');
    });
    if (files.length > 0) {
      setEmlFiles(prev => [...prev, ...files]);
    }
  };

  const handleUploadEmlFiles = async () => {
    if (emlFiles.length === 0) return;
    setIsUploadingEml(true);
    setEmlUploadResult(null);

    const formData = new FormData();
    emlFiles.forEach(f => formData.append('emlFiles', f));

    try {
      const res = await apiFetch('/api/emails/upload-eml', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload .eml files');

      setEmlUploadResult({
        success: true,
        count: data.count,
        message: data.message,
      });
      setEmlFiles([]);
      if (onEmlUploaded && data.emails) {
        onEmlUploaded(data.emails);
      }
    } catch (err) {
      setEmlUploadResult({
        success: false,
        error: err.message,
      });
    } finally {
      setIsUploadingEml(false);
    }
  };

  // Universal IMAP Connect & Sync (Works for ANY email ID)
  const handleConnectImap = async (e) => {
    e.preventDefault();
    if (!imapEmail.trim() || !imapPassword) {
      setSyncError('Please enter your Email ID and Password (or App Password).');
      return;
    }

    setIsConnectingImap(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      const res = await apiFetch('/api/emails/connect-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: imapEmail.trim(),
          password: imapPassword,
          host: imapHost.trim() || undefined,
          port: Number(imapPort) || 993,
          secure: imapSecure,
          limit: 15,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSyncError(data.details || data.error || 'Failed to connect email via IMAP.');
      } else {
        setSyncMessage(data.message);
        setImapPassword('');
        refreshAuthStatus();

        // Automatically store connected email in UserContext if not set yet
        if (!user?.email) {
          updateUser({ email: imapEmail.trim() });
        }

        if (onGmailSynced && data.emails) {
          onGmailSynced(data.emails);
        }
      }
    } catch (err) {
      setSyncError(err.message || 'Could not reach IMAP connection endpoint.');
    } finally {
      setIsConnectingImap(false);
    }
  };

  const handleSyncAccount = async (account) => {
    setIsSyncing(true);
    setSyncMessage(null);
    setSyncError(null);

    const endpoint =
      account.provider === 'google'
        ? '/api/emails/sync-gmail'
        : account.provider === 'microsoft'
        ? '/api/emails/sync-microsoft'
        : '/api/emails/sync-imap';
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSyncError(data.details || data.error || 'Sync failed');
      } else {
        setSyncMessage(data.message || `Synced ${data.count} email(s)`);
        refreshAuthStatus();
        if (onGmailSynced && data.emails) {
          onGmailSynced(data.emails);
        }
      }
    } catch (err) {
      setSyncError(err.message || 'Failed to sync inbox');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectAccount = async (account) => {
    try {
      const res = await apiFetch('/api/emails/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, provider: account.provider }),
      });
      if (res.ok) {
        refreshAuthStatus();
      }
    } catch {
      // ignore
    }
  };

  const handleCopyWebhook = () => {
    const endpoint = apiUrl('/api/emails/inbound');
    const urlToCopy = endpoint.startsWith('http') ? endpoint : `${window.location.origin}${endpoint}`;
    navigator.clipboard.writeText(urlToCopy);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const webhookDisplayUrl = (() => {
    const endpoint = apiUrl('/api/emails/inbound');
    return endpoint.startsWith('http') ? endpoint : `${window.location.origin}${endpoint}`;
  })();

  const appsScriptSnippet = `function syncCollegeInboxToCampusCue() {
  var WEBHOOK_URL = "${webhookDisplayUrl.replace('/inbound', '/inbound-batch')}";
  var USER_EMAIL = Session.getActiveUser().getEmail();
  var threads = GmailApp.search('in:inbox newer_than:2d', 0, 15);
  var batch = [];
  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    var m = msgs[msgs.length - 1];
    batch.push({
      external_id: m.getId(),
      from: m.getFrom(),
      to: USER_EMAIL,
      subject: m.getSubject(),
      text: m.getPlainBody().slice(0, 8000),
      date: m.getDate().toISOString()
    });
  }
  if (batch.length > 0) {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ userEmail: USER_EMAIL, emails: batch })
    });
  }
}`;

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptSnippet);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const googleConnectHref = apiUrl(
    `/api/auth/google${imapEmail.includes('@') ? `?login_hint=${encodeURIComponent(imapEmail.trim())}` : ''}`
  );

  const microsoftConnectHref = apiUrl(
    `/api/auth/microsoft${imapEmail.includes('@') ? `?login_hint=${encodeURIComponent(imapEmail.trim())}` : ''}`
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="editorial-card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-[#FAF6EE] border-cream-border shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-border mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-forest text-gold flex items-center justify-center shrink-0">
              <MailPlus className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-2xl text-ink leading-tight">
                Ingest & Connect Any Email
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Paste email text, drop .eml exports, or connect Gmail, Outlook, iCloud & college mail IDs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-border/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-cream rounded-xl border border-cream-border mb-6 text-xs">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'paste' ? 'bg-forest text-[#F1EBDD] shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Paste Email</span>
          </button>

          <button
            onClick={() => setActiveTab('eml')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'eml' ? 'bg-forest text-[#F1EBDD] shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. .eml / .mbox</span>
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'connect' ? 'bg-forest text-[#F1EBDD] shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>3. Connect Inbox</span>
          </button>
        </div>

        {/* TAB 1: PASTE EMAIL (Smart 1-Box Quick Paste + Structured Fields) */}
        {activeTab === 'paste' && (
          <form onSubmit={handlePasteSubmit} className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="inline-flex p-0.5 rounded-lg bg-cream border border-cream-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setPasteMode('smart')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    pasteMode === 'smart'
                      ? 'bg-forest text-[#F1EBDD] shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  ⚡ 1-Box Quick Paste
                </button>
                <button
                  type="button"
                  onClick={() => setPasteMode('structured')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    pasteMode === 'structured'
                      ? 'bg-forest text-[#F1EBDD] shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Edit Fields Separately
                </button>
              </div>

              <span className="text-[11px] text-ink-muted">
                No passwords, no IT approval needed
              </span>
            </div>

            {pasteMode === 'smart' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-forest/5 border border-forest/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="text-xs text-ink">
                    <p className="font-semibold text-forest">
                      Copy an email anywhere (<code className="bg-cream px-1 rounded">Cmd+A</code> then <code className="bg-cream px-1 rounded">Cmd+C</code>) &amp; paste it here
                    </p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      Works with Gmail Web, Outlook Web, Apple Mail, or forwarded text — headers are extracted automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1.5 rounded-lg bg-forest hover:bg-forest-hover text-[#F1EBDD] text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-gold" />
                    <span>Paste from Clipboard</span>
                  </button>
                </div>

                {clipboardNotice && (
                  <p className="text-[11px] text-forest font-medium px-1">{clipboardNotice}</p>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-ink uppercase tracking-wider">
                      Full Copied Email
                    </label>
                    {rawPasteText && (
                      <button
                        type="button"
                        onClick={() => {
                          setRawPasteText('');
                          setSender('');
                          setSubject('');
                          setBody('');
                          setClipboardNotice(null);
                        }}
                        className="text-[11px] text-ink-muted hover:text-red-700 font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={rawPasteText}
                    onChange={(e) => applyRawPaste(e.target.value)}
                    placeholder={`Paste entire copied email here (Gmail/Outlook Cmd+A -> Cmd+C)...\n\nExample:\nFrom: Academic Cell <exams@university.edu>\nSubject: Midterm Exam Room Relocation\nPlease arrive at Faraday 402 by 9:45 AM...`}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest font-mono leading-relaxed"
                  />
                </div>

                {(subject || sender || body) && (
                  <div className="p-3 rounded-xl bg-cream border border-cream-border space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-forest flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Auto-Detected Preview
                      </span>
                      <button
                        type="button"
                        onClick={() => setPasteMode('structured')}
                        className="text-[11px] font-semibold text-forest underline hover:text-forest-hover"
                      >
                        Tweak fields
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-ink">
                      <p className="truncate">
                        <span className="font-semibold text-ink-muted">From: </span>
                        {sender || 'University Administration (default)'}
                      </p>
                      <p className="truncate">
                        <span className="font-semibold text-ink-muted">Date: </span>
                        {receivedDate ? receivedDate.replace('T', ' ') : 'Now'}
                      </p>
                      <p className="sm:col-span-2 truncate">
                        <span className="font-semibold text-ink-muted">Subject: </span>
                        {subject || '(none yet)'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                      Sender
                    </label>
                    <input
                      type="text"
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      placeholder="e.g. Prof. Thorne <a.thorne@university.edu>"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                      Received Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. CS301 Midterm Exam Room Change"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                    Email Body
                  </label>
                  <textarea
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Paste the raw university email contents here..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest font-mono leading-relaxed"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-1 border-t border-cream-border/70">
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
                Or test instantly with sample university notices:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-cream border border-cream-border hover:border-forest text-ink font-medium transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            {pasteError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                <span>{pasteError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-cream-border bg-cream hover:bg-cream-border/40 text-ink text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isIngesting}
                className="px-5 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-60"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold" />
                    <span>Processing with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-gold" />
                    <span>Ingest & Run AI Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: UPLOAD .EML FILES */}
        {activeTab === 'eml' && (
          <div className="space-y-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                isDragging ? 'border-forest bg-forest/5' : 'border-cream-border bg-cream/50 hover:bg-cream'
              }`}
            >
              <Upload className="w-10 h-10 mx-auto text-forest mb-3 opacity-80" />
              <p className="font-serif text-lg font-bold text-ink">
                Drag & drop .eml or .mbox files here
              </p>
              <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                Works with any locked-down college email — drop individual <code>.eml</code> downloads or bulk <code>.mbox</code> exports (Google Takeout / Thunderbird).
              </p>
              <button
                type="button"
                className="mt-4 px-4 py-1.5 text-xs font-semibold bg-forest text-[#F1EBDD] rounded-xl hover:bg-forest-hover transition-colors shadow-xs"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".eml,.mbox"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {emlFiles.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block">
                  Files to Ingest ({emlFiles.length}):
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-cream rounded-xl border border-cream-border">
                  {emlFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-cream-card rounded-lg text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-forest shrink-0" />
                        <span className="font-medium text-ink truncate">{file.name}</span>
                        <span className="text-[10px] text-ink-muted">({Math.round(file.size / 1024)} KB)</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmlFiles(emlFiles.filter((_, idx) => idx !== i));
                        }}
                        className="text-ink-muted hover:text-red-700 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleUploadEmlFiles}
                    disabled={isUploadingEml}
                    className="px-5 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-60"
                  >
                    {isUploadingEml ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold" />
                        <span>Parsing & Ingesting with AI...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-gold" />
                        <span>Process {emlFiles.length} .eml File{emlFiles.length === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {emlUploadResult && (
              <div className={`p-4 rounded-xl text-xs border ${
                emlUploadResult.success 
                  ? 'bg-forest/10 border-forest text-forest font-semibold' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {emlUploadResult.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
                    <span>{emlUploadResult.message || `Successfully processed ${emlUploadResult.count} emails!`}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                    <span>{emlUploadResult.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SIMPLIFIED CONNECT INBOX (WORKAROUNDS FIRST FOR STRICT COLLEGE IT) */}
        {activeTab === 'connect' && (
          <div className="space-y-4">
            {/* Active Connected Accounts */}
            {authStatus.accounts && authStatus.accounts.length > 0 && (
              <div className="p-4 rounded-2xl bg-forest/5 border border-forest/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-forest">
                    Connected Email Accounts ({authStatus.accounts.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {authStatus.accounts.map((acc) => (
                    <div
                      key={`${acc.provider}:${acc.email}`}
                      className="p-3 bg-cream-card rounded-xl border border-cream-border flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-forest shrink-0" />
                          <span className="text-xs font-bold text-ink truncate">{acc.email}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream border border-cream-border text-ink-muted">
                            {acc.providerLabel || acc.provider}
                          </span>
                        </div>
                        {acc.lastSyncedAt && (
                          <p className="text-[10px] text-ink-muted pl-4 mt-0.5">
                            Last synced {new Date(acc.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSyncAccount(acc)}
                          disabled={isSyncing}
                          className="px-3 py-1.5 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-[11px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3 h-3 text-gold ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>Sync Now</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnectAccount(acc)}
                          title="Disconnect account"
                          className="p-1.5 text-ink-muted hover:text-red-700 rounded-lg hover:bg-cream transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simple 2-Path Goal Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConnectPath('college-blocked')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  connectPath === 'college-blocked'
                    ? 'border-forest bg-forest/5 shadow-xs'
                    : 'border-cream-border bg-cream hover:border-forest/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink">Blocked by College IT</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest text-gold">
                    Easiest
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                  No IMAP passwords or third-party app approval needed.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setConnectPath('direct-imap')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  connectPath === 'direct-imap'
                    ? 'border-forest bg-forest/5 shadow-xs'
                    : 'border-cream-border bg-cream hover:border-forest/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink">Personal / Unlocked Account</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream-card border border-cream-border text-ink-muted">
                    IMAP
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                  Connect Gmail, Outlook, iCloud, or forwarding inbox directly.
                </p>
              </button>
            </div>

            {/* PATH 1: BLOCKED BY COLLEGE IT (Zero OAuth / Zero IMAP) */}
            {connectPath === 'college-blocked' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-cream border border-cream-border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-ink">
                        Option 1: 1-Click Browser Extension
                      </h3>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Reads only your currently open college webmail tab when you click it — zero IT approval needed.
                      </p>
                    </div>
                  </div>

                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-ink leading-relaxed">
                    <li>
                      Open <code className="bg-cream-card px-1 rounded border border-cream-border">chrome://extensions</code>, enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong> and pick this repo’s <code className="bg-cream-card px-1 rounded border border-cream-border">extension/</code> folder (one-time).
                    </li>
                    <li>
                      Open your college Gmail / Outlook / webmail tab, click the <strong>clg.inbox</strong> icon, and hit <strong>1-Click Sync Open Webmail Tab</strong>.
                    </li>
                    <li>
                      Switch back to this tab — new emails appear automatically.
                    </li>
                  </ol>
                </div>

                <div className="p-4 rounded-2xl bg-cream border border-cream-border space-y-2">
                  <h3 className="text-xs sm:text-sm font-bold text-ink">
                    Option 2: Auto-Forward to a Personal Gmail
                  </h3>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    If your college email allows forwarding rules, auto-forward incoming mail to a personal <code className="bg-cream-card px-1 rounded border border-cream-border">@gmail.com</code> account, then connect that personal Gmail with a 16-digit App Password.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConnectPath('direct-imap')}
                    className="text-[11px] font-bold text-forest hover:underline inline-flex items-center gap-1"
                  >
                    <span>Connect my forwarding personal email &rarr;</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-forest/5 border border-forest/15 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-ink-muted">
                    Want zero setup right now? Just copy an email or drag from Apple Mail:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('paste')}
                      className="font-bold text-forest hover:underline"
                    >
                      1-Box Quick Paste &rarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('eml')}
                      className="font-bold text-forest hover:underline"
                    >
                      Drop .eml/.mbox &rarr;
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PATH 2: DIRECT IMAP / PERSONAL ACCOUNT */}
            {connectPath === 'direct-imap' && (
              <form onSubmit={handleConnectImap} className="p-5 rounded-2xl bg-cream border border-cream-border space-y-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-forest text-gold flex items-center justify-center shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-ink">
                      Direct Inbox Sync (IMAP + App Password)
                    </h3>
                    <p className="text-[11px] text-ink-muted">
                      Best for personal Gmail, iCloud, Outlook, Yahoo, Zoho, or unlocked college mail IDs.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-1">
                      Email ID
                    </label>
                    <input
                      type="email"
                      value={imapEmail}
                      onChange={(e) => setImapEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-1">
                      App Password / Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={imapPassword}
                        onChange={(e) => setImapPassword(e.target.value)}
                        placeholder={providerInfo?.authTypeHint || 'App Password'}
                        className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {providerInfo && (
                  <div className="p-3.5 rounded-xl bg-cream-card border border-cream-border space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-forest flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-gold shrink-0" />
                        <span>Detected: {providerInfo.providerLabel}</span>
                      </span>
                      <span className="text-[10px] font-mono text-ink-muted">
                        {imapHost || providerInfo.host}:{imapPort} ({imapSecure ? 'SSL/TLS' : 'STARTTLS'})
                      </span>
                    </div>

                    {providerInfo.prerequisites && providerInfo.prerequisites.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-cream-border/60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                          Prerequisites for {providerInfo.domain}:
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-ink-muted leading-relaxed">
                          {providerInfo.prerequisites.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedImap(!showAdvancedImap)}
                    className="text-[11px] font-semibold text-forest hover:underline inline-flex items-center gap-1"
                  >
                    {showAdvancedImap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>Custom IMAP Host / Port</span>
                  </button>

                  {showAdvancedImap && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5 pt-2.5 border-t border-cream-border/70">
                      <div>
                        <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">IMAP Host</label>
                        <input
                          type="text"
                          value={imapHost}
                          onChange={(e) => setImapHost(e.target.value)}
                          placeholder="mail.college.edu"
                          className="w-full px-2.5 py-1.5 text-xs bg-cream-card border border-cream-border rounded-lg text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Port</label>
                        <input
                          type="number"
                          value={imapPort}
                          onChange={(e) => setImapPort(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-cream-card border border-cream-border rounded-lg text-ink"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 text-xs text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={imapSecure}
                            onChange={(e) => setImapSecure(e.target.checked)}
                            className="rounded border-cream-border text-forest focus:ring-forest"
                          />
                          <span>Use SSL/TLS</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[10px] text-ink-muted flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Encrypted locally with AES-256-GCM.
                  </span>

                  <button
                    type="submit"
                    disabled={isConnectingImap}
                    className="px-4 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-gold ${isConnectingImap ? 'animate-spin' : ''}`} />
                    <span>{isConnectingImap ? 'Connecting & Syncing...' : 'Connect & Sync Inbox'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Collapsible Developer / Advanced Options (OAuth, Apps Script, Webhook) */}
            <div className="border-t border-cream-border pt-3">
              <button
                type="button"
                onClick={() => setShowDevOptions(!showDevOptions)}
                className="text-[11px] font-bold text-ink-muted hover:text-ink inline-flex items-center gap-1.5"
              >
                {showDevOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Developer / Advanced Connections (Google &amp; Outlook OAuth, Apps Script, Webhook)</span>
              </button>

              {showDevOptions && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-cream border border-cream-border space-y-2 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-ink">Google / Gmail OAuth 2.0</h4>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {authStatus.googleConfigured
                            ? 'OAuth ready — sign in with Google.'
                            : 'Requires GOOGLE_CLIENT_ID & SECRET in server/.env.'}
                        </p>
                      </div>
                      {authStatus.googleConfigured ? (
                        <a
                          href={googleConnectHref}
                          className="w-full px-3 py-1.5 bg-cream-card hover:bg-cream-border/40 border border-cream-border text-ink text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
                        >
                          <span>Connect Google</span>
                          <ExternalLink className="w-3.5 h-3.5 text-forest" />
                        </a>
                      ) : (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-border/70 text-ink-muted self-start">
                          Not Configured
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-cream border border-cream-border space-y-2 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-ink">Outlook / Microsoft 365 OAuth</h4>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {authStatus.microsoftConfigured
                            ? 'OAuth ready — connect M365 / Outlook.'
                            : 'Requires MICROSOFT_CLIENT_ID & SECRET in server/.env.'}
                        </p>
                      </div>
                      {authStatus.microsoftConfigured ? (
                        <a
                          href={microsoftConnectHref}
                          className="w-full px-3 py-1.5 bg-cream-card hover:bg-cream-border/40 border border-cream-border text-ink text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
                        >
                          <span>Connect Outlook / M365</span>
                          <ExternalLink className="w-3.5 h-3.5 text-forest" />
                        </a>
                      ) : (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-border/70 text-ink-muted self-start">
                          Not Configured
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-cream border border-cream-border space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAppsScriptBox(!showAppsScriptBox)}
                        className="text-[11px] font-bold text-forest hover:underline"
                      >
                        {showAppsScriptBox ? 'Hide Google Apps Script' : 'Show Google Apps Script (Requires HTTPS tunnel)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWebhookBox(!showWebhookBox)}
                        className="text-[11px] font-bold text-forest hover:underline"
                      >
                        {showWebhookBox ? 'Hide Webhook URL' : 'Show Inbound Webhook URL'}
                      </button>
                    </div>

                    {showAppsScriptBox && (
                      <div className="p-2.5 rounded-lg bg-cream-card border border-cream-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-ink">
                            Paste into script.google.com
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyAppsScript}
                            className="text-[11px] font-bold text-forest hover:underline inline-flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedScript ? 'Copied Script!' : 'Copy Script'}</span>
                          </button>
                        </div>
                        <pre className="p-2 bg-cream rounded border border-cream-border text-[10px] font-mono overflow-x-auto text-ink leading-snug">
                          {appsScriptSnippet}
                        </pre>
                      </div>
                    )}

                    {showWebhookBox && (
                      <div className="p-2.5 rounded-lg bg-cream-card border border-cream-border space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-ink truncate flex items-center gap-1.5">
                            <Webhook className="w-3.5 h-3.5 text-forest shrink-0" />
                            <span>POST {webhookDisplayUrl}</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyWebhook}
                            className="text-[11px] font-bold text-forest hover:underline inline-flex items-center gap-1 shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedWebhook ? 'Copied!' : 'Copy URL'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-ink-muted font-mono">
                          Accepts JSON &#123; from, to, subject, text, date &#125; (Extension, Apps Script, Cloudflare Workers, Mailgun).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Live Feedback */}
            {syncMessage && (
              <div className="p-3.5 rounded-xl bg-forest/10 border border-forest text-forest text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            {syncError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{syncError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
