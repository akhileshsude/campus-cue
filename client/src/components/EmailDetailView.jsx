import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Archive, 
  Trash2, 
  MoreHorizontal, 
  FileText, 
  Sparkles, 
  Paperclip, 
  ExternalLink, 
  Send,
  CheckCircle2,
  Copy,
  Clock,
  ChevronDown,
  Edit3,
  RefreshCw,
  X,
  AlertCircle,
  Calendar,
  Check,
  Mail,
  MailOpen,
  Download
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { apiFetch } from '../utils/api';

const VALID_CATEGORIES = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];
const VALID_PRIORITIES = ['High', 'Medium', 'Low'];

export default function EmailDetailView({ 
  email, 
  onBack, 
  onToggleRead,
  onArchive,
  onDelete,
  onOverride,
  onReprocess,
  isProcessingSingle = false,
}) {
  const { user } = useUser();
  const [replyIntent, setReplyIntent] = useState('polite_confirm');
  const [isDraftingReply, setIsDraftingReply] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showReplyPanel, setShowReplyPanel] = useState(false);

  // Student corrections edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [overrideSavedToast, setOverrideSavedToast] = useState(false);

  // View original email modal state
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!email) return null;

  const extractSenderAddress = (rawSender = '') => {
    const m = String(rawSender).match(/<([^>]+)>/);
    return m ? m[1] : String(rawSender).trim();
  };

  const effectiveCategory = email.user_category || email.category || 'Announcements';
  const effectivePriority = email.user_priority || email.priority || 'Medium';
  const effectiveDeadline = email.user_deadline || email.deadline;
  const isUrgent = effectivePriority.toLowerCase() === 'high';

  const hasCategoryOverride = Boolean(email.user_category);
  const hasPriorityOverride = Boolean(email.user_priority);
  const hasDeadlineOverride = Boolean(email.user_deadline);
  const hasAnyOverride = Boolean(email.edited_by_user || hasCategoryOverride || hasPriorityOverride || hasDeadlineOverride);

  // Format datetime-local input value from ISO string
  const formatForInput = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const openEditor = () => {
    setEditCategory(email.user_category || email.category || 'Academics');
    setEditPriority(email.user_priority || email.priority || 'Medium');
    setEditDeadline(formatForInput(email.user_deadline || email.deadline));
    setIsEditModalOpen(true);
  };

  const handleSaveOverrides = (e) => {
    e.preventDefault();
    const deadlineVal = editDeadline ? new Date(editDeadline).toISOString() : null;
    
    if (onOverride) {
      onOverride(email.id, {
        category: editCategory,
        priority: editPriority,
        deadline: deadlineVal,
      });
    }

    setIsEditModalOpen(false);
    setOverrideSavedToast(true);
    setTimeout(() => setOverrideSavedToast(false), 2500);
  };

  const handleResetToAI = () => {
    if (onOverride) {
      onOverride(email.id, {
        category: null,
        priority: null,
        deadline: null,
      });
    }
    setIsEditModalOpen(false);
  };

  // Call the backend reply endpoint
  const handleDraftReply = async () => {
    setIsDraftingReply(true);
    try {
      const res = await apiFetch('/api/emails/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: email.id,
          intent: replyIntent,
          studentName: user.name || '',
          email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedDraft(data);
      }
    } catch (err) {
      console.error('Failed to generate reply draft:', err);
    } finally {
      setIsDraftingReply(false);
    }
  };

  const handleCopyDraft = () => {
    if (!generatedDraft) return;
    navigator.clipboard.writeText(`${generatedDraft.draftSubject}\n\n${generatedDraft.draftBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAttachment = async (attName) => {
    try {
      const res = await apiFetch(
        `/api/emails/${email.id}/attachments/${encodeURIComponent(attName)}`
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download attachment:', err);
    }
  };

  const isFailedAnalysis = email.status === 'failed';
  const isBasicAnalysis =
    !isFailedAnalysis &&
    email.source !== 'sample' &&
    email.analysis_source &&
    email.analysis_source !== 'gemini';

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      
      {/* 1. Top Action Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-cream-border">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-ink-muted hover:text-forest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inbox</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Reprocess Single Email with AI Button */}
          <button
            onClick={() => onReprocess && onReprocess(email.id)}
            disabled={isProcessingSingle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cream-border bg-cream-card hover:bg-cream text-xs font-semibold text-forest transition-colors disabled:opacity-50"
            title="Re-run AI pipeline on this specific email"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessingSingle ? 'animate-spin' : ''}`} />
            <span>{isProcessingSingle ? 'Processing with AI...' : 'Reprocess with AI'}</span>
          </button>

          <button
            onClick={openEditor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cream-border bg-cream-card hover:bg-cream text-xs font-semibold text-ink transition-colors"
            title="Correct category, priority, or deadline"
          >
            <Edit3 className="w-3.5 h-3.5 text-forest" />
            <span>Edit Classification</span>
          </button>

          <div className="flex items-center gap-1 text-ink-muted pl-2 border-l border-cream-border">
            <button
              onClick={() => onToggleRead && onToggleRead(email.id, !email.is_read)}
              title={email.is_read ? 'Mark as unread' : 'Mark as read'}
              className="p-2 rounded-xl hover:bg-cream-card transition-colors hover:text-ink"
            >
              {email.is_read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onArchive && onArchive(email.id, !email.is_archived)}
              title={email.is_archived ? 'Restore to Inbox' : 'Archive email'}
              className={`p-2 rounded-xl hover:bg-cream-card transition-colors ${email.is_archived ? 'text-forest bg-cream-card' : 'hover:text-ink'}`}
            >
              <Archive className="w-4 h-4" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                <button
                  onClick={() => onDelete && onDelete(email.id)}
                  className="text-[11px] font-bold text-red-700 hover:underline px-1"
                >
                  Delete?
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[11px] text-ink-muted hover:text-ink px-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete email"
                className="p-2 rounded-xl hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Saved Toast Notification */}
      {overrideSavedToast && (
        <div className="p-3 bg-forest text-[#F1EBDD] text-xs font-semibold rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-gold" />
            <span>Student corrections saved! Your custom tags and deadline override AI values across the app.</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-gold px-2 py-0.5 rounded-full bg-forest-hover">
            Edited by you
          </span>
        </div>
      )}

      {/* 2. Sender Metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-cream-border/70 border border-cream-border text-forest font-bold text-base flex items-center justify-center shrink-0">
            {(email.senderName || email.sender)[0]}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-ink">
                {email.senderName || email.sender.split('<')[0]}
              </h3>
              <span className="text-xs text-ink-muted">to me</span>
            </div>
            <p className="text-xs text-ink-muted truncate">
              {email.sender}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ink-muted">
            {new Date(email.received_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>

          {hasAnyOverride && (
            <span className="bg-sage/20 text-forest text-[10px] font-bold px-2 py-0.5 rounded-full border border-sage/40">
              Edited by you
            </span>
          )}

          {isUrgent ? (
            <span className="badge-urgent text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Urgent
            </span>
          ) : (
            <span className="badge-info text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              {effectiveCategory}
            </span>
          )}
        </div>
      </div>

      {/* 3. Subject as Refined Serif Title */}
      <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-snug">
        {email.subject}
      </h1>

      {/* 4. Original Email Body */}
      <div className="text-sm sm:text-base text-ink leading-relaxed whitespace-pre-line space-y-3 pt-2">
        {email.body}
      </div>

      {/* 5. Key Details (AI Summary Box with Student Overrides) */}
      <div className="editorial-card p-6 bg-cream-card/90 space-y-5 border-cream-border mt-8">
        {isFailedAnalysis && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-red-900">
                AI analysis failed — showing safe fallback details
              </p>
              {email.error && (
                <p className="text-[11px] text-red-800 break-words">
                  {email.error}
                </p>
              )}
            </div>
            {onReprocess && (
              <button
                type="button"
                onClick={() => onReprocess(email.id)}
                disabled={isProcessingSingle}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessingSingle ? 'animate-spin' : ''}`} />
                <span>{isProcessingSingle ? 'Retrying...' : 'Retry AI'}</span>
              </button>
            )}
          </div>
        )}

        {isBasicAnalysis && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-900">
                Basic analysis (AI offline)
              </p>
              <p className="text-[11px] text-amber-800 break-words">
                {email.error || 'Classified with keyword rules because Gemini was unavailable.'}
              </p>
            </div>
            {onReprocess && (
              <button
                type="button"
                onClick={() => onReprocess(email.id)}
                disabled={isProcessingSingle}
                className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-950 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessingSingle ? 'animate-spin' : ''}`} />
                <span>{isProcessingSingle ? 'Processing...' : 'Reprocess with AI'}</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pb-3 border-b border-cream-border/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-ink">
              Key Details (AI Summary)
            </span>
            {isFailedAnalysis ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                AI Failed
              </span>
            ) : isBasicAnalysis ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                Basic analysis (AI offline)
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest text-gold">
                AI-generated
              </span>
            )}
            {hasAnyOverride && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sage/25 text-forest border border-sage/40">
                Customized by you
              </span>
            )}
          </div>

          <button
            onClick={openEditor}
            className="text-xs font-semibold text-forest hover:underline inline-flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit details</span>
          </button>
        </div>

        {/* Structured Details List */}
        <ul className="space-y-3 text-xs sm:text-sm text-ink">
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest mt-2 shrink-0" />
            <div className="flex-1 flex items-baseline justify-between gap-2">
              <span>
                <strong className="font-semibold text-ink">Event / Topic:</strong> {email.deadline_label || email.subject}
              </span>
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest mt-2 shrink-0" />
            <div className="flex-1 flex flex-wrap items-baseline gap-2">
              <span>
                <strong className="font-semibold text-ink">Registration / Due Date:</strong>{' '}
                {effectiveDeadline
                  ? `${new Date(effectiveDeadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at ${new Date(effectiveDeadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : 'No specific deadline stated'}
              </span>
              {hasDeadlineOverride ? (
                <span className="bg-sage/20 text-forest text-[10px] font-bold px-2 py-0.5 rounded-full border border-sage/40">
                  Edited by you
                </span>
              ) : effectiveDeadline ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  email.deadline_confidence === 'uncertain' ? 'badge-unconfirmed' : 'badge-info'
                }`}>
                  {email.deadline_confidence === 'uncertain' ? 'Unconfirmed · Verify' : 'Confirmed'}
                </span>
              ) : null}
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest mt-2 shrink-0" />
            <div className="flex-1 flex items-baseline gap-2">
              <span>
                <strong className="font-semibold text-ink">Category:</strong> {effectiveCategory}
              </span>
              {hasCategoryOverride && (
                <span className="bg-sage/20 text-forest text-[10px] font-bold px-2 py-0.5 rounded-full border border-sage/40">
                  Edited by you
                </span>
              )}
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest mt-2 shrink-0" />
            <div className="flex-1 flex items-baseline gap-2">
              <span>
                <strong className="font-semibold text-ink">Priority:</strong> {effectivePriority}
              </span>
              {hasPriorityOverride && (
                <span className="bg-sage/20 text-forest text-[10px] font-bold px-2 py-0.5 rounded-full border border-sage/40">
                  Edited by you
                </span>
              )}
            </div>
          </li>

          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest mt-2 shrink-0" />
            <div>
              <strong className="font-semibold text-ink">Action Required:</strong>{' '}
              {email.required_action || 'Review and take note'}
            </div>
          </li>
        </ul>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-cream-border/70 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsRawModalOpen(true)}
            className="px-4 py-2 border border-cream-border bg-cream hover:bg-cream-border/40 text-ink text-xs font-semibold rounded-xl transition-colors"
          >
            View original email
          </button>

          <button
            onClick={() => setShowReplyPanel(!showReplyPanel)}
            className="px-5 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            <span>Draft Reply with AI</span>
          </button>
        </div>
      </div>

      {/* 6. AI Reply Drafter Panel (Collapsible / Interactive) */}
      {showReplyPanel && (
        <div className="editorial-card p-5 space-y-4 bg-cream/70 border-gold/40 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-forest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-gold" />
              <span>Smart Student Reply Drafter</span>
            </h3>

            <div className="flex items-center gap-2">
              <select
                value={replyIntent}
                onChange={(e) => setReplyIntent(e.target.value)}
                className="text-xs bg-cream-card border border-cream-border rounded-lg px-2.5 py-1 text-ink focus:outline-none focus:border-forest"
              >
                <option value="polite_confirm">Polite Confirmation / RSVP</option>
                <option value="request_extension">Request Extension</option>
                <option value="ask_question">Ask Clarifying Question</option>
                <option value="polite_decline">Polite Decline</option>
              </select>

              <button
                onClick={handleDraftReply}
                disabled={isDraftingReply}
                className="px-3.5 py-1 bg-forest text-[#F1EBDD] text-xs font-semibold rounded-lg hover:bg-forest-hover disabled:opacity-50 transition-colors"
              >
                {isDraftingReply ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {generatedDraft && (
            <div className="space-y-2 pt-2">
              <div className="p-3.5 bg-cream-card rounded-xl border border-cream-border text-xs text-ink whitespace-pre-line leading-relaxed font-mono">
                {generatedDraft.draftBody}
              </div>

              <div className="flex items-center justify-end gap-4">
                <a
                  href={`mailto:${encodeURIComponent(extractSenderAddress(email.sender))}?subject=${encodeURIComponent(generatedDraft.draftSubject || `Re: ${email.subject}`)}&body=${encodeURIComponent(generatedDraft.draftBody || '')}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-forest transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open in Email App</span>
                </a>
                <button
                  onClick={handleCopyDraft}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-forest" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Draft'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Attachment Card */}
      {email.attachments && email.attachments.length > 0 && (
        <div className="space-y-2">
          {email.attachments.map((attName, aIdx) => (
            <div key={aIdx} className="editorial-card p-4 flex items-center justify-between gap-3 bg-cream-card/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-ink">
                    {attName}
                  </p>
                  <p className="text-[11px] text-ink-muted">
                    {email.has_saved_attachments
                      ? 'Email attachment ready to download'
                      : 'Attachment metadata recorded'}
                  </p>
                </div>
              </div>

              {email.has_saved_attachments ? (
                <button
                  type="button"
                  onClick={() => handleDownloadAttachment(attName)}
                  className="text-xs font-semibold text-forest hover:underline px-3 py-1.5 rounded-lg hover:bg-cream transition-colors inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              ) : (
                <span className="text-[11px] font-medium text-ink-muted px-3 py-1.5">
                  Filename only
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: Student Corrections Editor */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="editorial-card w-full max-w-lg p-6 bg-[#FAF6EE] border border-cream-border shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-cream-border">
              <div>
                <h3 className="font-serif text-xl font-bold text-ink">
                  Correct Classification & Deadline
                </h3>
                <p className="text-xs text-ink-muted">
                  Your adjustments supersede AI intelligence across Campus Cue with the "Edited by you" tag.
                </p>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-border/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOverrides} className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                >
                  {VALID_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                >
                  {VALID_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Deadline Date & Time Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                    Due / Registration Deadline
                  </label>
                  {editDeadline && (
                    <button
                      type="button"
                      onClick={() => setEditDeadline('')}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Clear deadline
                    </button>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
                />
                <p className="text-[11px] text-ink-muted mt-1">
                  Setting a deadline ensures it appears in your Calendar view and export.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-cream-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetToAI}
                  className="text-xs font-semibold text-ink-muted hover:text-red-700 transition-colors"
                >
                  Reset to AI Prediction
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 border border-cream-border bg-cream hover:bg-cream-border/40 text-ink text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-4 h-4 text-gold" />
                    <span>Save Override</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Original Email Viewer */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="editorial-card w-full max-w-2xl max-h-[85vh] flex flex-col p-6 bg-[#FAF6EE] border border-cream-border shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-cream-border shrink-0">
              <div>
                <h3 className="font-serif text-xl font-bold text-ink">
                  Original Source Email
                </h3>
                <p className="text-xs text-ink-muted font-mono">
                  ID: {email.id} {email.content_hash ? `· SHA-256: ${email.content_hash.slice(0, 12)}...` : ''}
                </p>
              </div>
              <button 
                onClick={() => setIsRawModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-border/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs font-mono">
              <div className="p-3 bg-cream-card rounded-xl border border-cream-border space-y-1">
                <p><strong>From:</strong> {email.sender}</p>
                <p><strong>To:</strong> {email.recipient || user.email || 'me'}</p>
                <p><strong>Date:</strong> {new Date(email.received_at).toUTCString()}</p>
                <p><strong>Subject:</strong> {email.subject}</p>
              </div>

              <div className="p-4 bg-cream-card rounded-xl border border-cream-border whitespace-pre-wrap leading-relaxed text-ink">
                {email.body}
              </div>
            </div>

            <div className="pt-3 border-t border-cream-border flex justify-end shrink-0">
              <button
                onClick={() => setIsRawModalOpen(false)}
                className="px-4 py-2 bg-forest text-[#F1EBDD] text-xs font-semibold rounded-xl hover:bg-forest-hover"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
