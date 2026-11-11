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
  Calendar,
  Layers,
  Inbox
} from 'lucide-react';

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

export default function IngestModal({ 
  isOpen, 
  onClose, 
  onIngestEmail, 
  isIngesting,
  onEmlUploaded,
  onGmailSynced 
}) {
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'eml' | 'gmail'

  // Tab 1: Paste Email state
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

  // Tab 3: Gmail OAuth state
  const [authStatus, setAuthStatus] = useState({ configured: false, connected: false });
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [gmailMessage, setGmailMessage] = useState(null);
  const [gmailError, setGmailError] = useState(null);

  // Load Gmail auth status
  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/status')
        .then(r => r.ok && r.json())
        .then(data => {
          if (data) setAuthStatus(data);
        })
        .catch(err => console.warn('Could not check auth status:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle template selection
  const handleApplyTemplate = (tpl) => {
    setSender(tpl.sender);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setPasteError(null);
  };

  // Handle Tab 1: Manual Paste Submission
  const handlePasteSubmit = (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setPasteError('Please provide both a subject and email body.');
      return;
    }
    setPasteError(null);
    onIngestEmail({
      sender: sender.trim() || 'University Administration <admin@university.edu>',
      subject: subject.trim(),
      body: body.trim(),
      received_at: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
    });
  };

  // Handle Tab 2: .eml files drop / select
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.eml'));
    if (files.length > 0) {
      setEmlFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.eml'));
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
      const res = await fetch('/api/emails/upload-eml', {
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

  // Handle Tab 3: Gmail Sync
  const handleSyncGmail = async () => {
    setIsSyncingGmail(true);
    setGmailMessage(null);
    setGmailError(null);

    try {
      const res = await fetch('/api/emails/sync-gmail', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setGmailError(data.details || data.error || 'Gmail sync failed');
      } else {
        setGmailMessage(data.message || `Successfully synced ${data.count} new emails`);
        if (onGmailSynced && data.emails) {
          onGmailSynced(data.emails);
        }
      }
    } catch (err) {
      setGmailError(err.message || 'Could not connect to Gmail sync service');
    } finally {
      setIsSyncingGmail(false);
    }
  };

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
                Ingest & Process Emails
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Add correspondence via manual paste, .eml file upload, or live Gmail sync
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
            <span>2. Upload .eml</span>
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gmail' ? 'bg-forest text-[#F1EBDD] shadow-xs' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>3. Gmail Sync</span>
          </button>
        </div>

        {/* TAB 1: PASTE EMAIL */}
        {activeTab === 'paste' && (
          <form onSubmit={handlePasteSubmit} className="space-y-4">
            {/* Quick Templates */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
                Quick University Test Templates:
              </label>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-cream border border-cream-border hover:border-forest text-ink font-medium transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

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
                Drag & drop your .eml files here
              </p>
              <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                Supports multiple .eml email exports from Outlook, Apple Mail, Thunderbird, or Gmail.
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
                accept=".eml"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected Files List */}
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

            {/* Upload Feedback */}
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

        {/* TAB 3: GMAIL OAUTH SYNC */}
        {activeTab === 'gmail' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-cream border border-cream-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                    G
                  </div>
                  <h3 className="font-bold text-sm text-ink">
                    Google Workspace & Gmail OAuth
                  </h3>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  authStatus.connected ? 'badge-info' : 'bg-cream-border/70 text-ink-muted'
                }`}>
                  {authStatus.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                Connect your university Gmail account using read-only access (<code>gmail.readonly</code>). Tokens are encrypted and saved securely to Supabase.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                {authStatus.connected ? (
                  <button
                    onClick={handleSyncGmail}
                    disabled={isSyncingGmail}
                    className="px-4 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-gold ${isSyncingGmail ? 'animate-spin' : ''}`} />
                    <span>{isSyncingGmail ? 'Syncing Inbox...' : 'Sync Inbox (Latest 25)'}</span>
                  </button>
                ) : (
                  <a
                    href="/api/auth/google"
                    className="px-4 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2"
                  >
                    <span>Connect Gmail Account</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gold" />
                  </a>
                )}
              </div>
            </div>

            {/* Graceful Institutional Workspace Notice */}
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Notice Regarding Institutional College Accounts</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                University Google Workspace administrators frequently block third-party OAuth apps with policy restrictions (Error 403: <code>access_denied</code>).
              </p>
              <p className="text-amber-800 leading-relaxed font-medium">
                If your university restricts OAuth, nothing breaks: you can continue using Campus Cue at full capacity by exporting your emails as <strong>.eml files</strong> or pasting raw emails in Tab 1!
              </p>
            </div>

            {/* Live Feedback */}
            {gmailMessage && (
              <div className="p-3.5 rounded-xl bg-forest/10 border border-forest text-forest text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{gmailMessage}</span>
              </div>
            )}

            {gmailError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                <span>{gmailError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
