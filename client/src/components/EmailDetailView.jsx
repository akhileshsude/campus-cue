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
  ChevronDown
} from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function EmailDetailView({ 
  email, 
  onBack, 
  onToggleRead,
  onUpdateCategory 
}) {
  const { user } = useUser();
  const [replyIntent, setReplyIntent] = useState('polite_confirm');
  const [isDraftingReply, setIsDraftingReply] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showReplyPanel, setShowReplyPanel] = useState(false);

  if (!email) return null;

  const isUrgent = (email.priority || '').toLowerCase() === 'high';
  const effectiveCategory = email.user_category || email.category;

  // Derive key details for the AI Summary box
  const keyDetails = [
    { label: 'Event / Topic', value: email.deadline_label || email.subject },
    { 
      label: 'Registration Deadline', 
      value: email.deadline 
        ? `${new Date(email.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} (${email.deadline_confidence === 'uncertain' ? 'Unconfirmed · Verify' : 'Confirmed'})` 
        : 'No specific deadline stated' 
    },
    { label: 'Category', value: effectiveCategory },
    { label: 'Action Required', value: email.required_action || 'Review and take note' },
  ];

  // Call the backend reply endpoint
  const handleDraftReply = async () => {
    setIsDraftingReply(true);
    try {
      const res = await fetch('/api/emails/reply', {
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

        <div className="flex items-center gap-1.5 text-ink-muted">
          <button 
            title="Archive"
            className="p-2 rounded-xl hover:bg-cream-card transition-colors hover:text-ink"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button 
            title="Delete"
            className="p-2 rounded-xl hover:bg-cream-card transition-colors hover:text-ink"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            title="More actions"
            className="p-2 rounded-xl hover:bg-cream-card transition-colors hover:text-ink"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

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

      {/* 5. Key Details (AI Summary Box) */}
      <div className="editorial-card p-6 bg-cream-card/90 space-y-5 border-cream-border mt-8">
        <div className="flex items-center justify-between pb-3 border-b border-cream-border/70">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-ink">
              Key Details (AI Summary)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-forest text-gold">
              AI-generated
            </span>
          </div>

          <span className="text-xs text-ink-muted">
            Campus Cue Synthesis
          </span>
        </div>

        {/* Bullet List */}
        <ul className="space-y-2.5 text-xs sm:text-sm text-ink">
          {keyDetails.map((detail, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-forest mt-2 shrink-0" />
              <span>
                <strong className="font-semibold text-ink">{detail.label}:</strong> {detail.value}
              </span>
            </li>
          ))}
        </ul>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-cream-border/70 flex flex-wrap items-center gap-3">
          <button
            onClick={() => alert(`Original Source: ${email.sender}\nReceived: ${email.received_at}`)}
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

              <div className="flex justify-end">
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
      <div className="editorial-card p-4 flex items-center justify-between gap-3 bg-cream-card/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-ink">
              PlacementDrive_Brochure.pdf
            </p>
            <p className="text-[11px] text-ink-muted">
              2.4 MB · Document attachment
            </p>
          </div>
        </div>

        <button 
          onClick={() => alert('Downloading: PlacementDrive_Brochure.pdf')}
          className="text-xs font-semibold text-forest hover:underline px-3 py-1.5 rounded-lg hover:bg-cream transition-colors"
        >
          Download
        </button>
      </div>

    </div>
  );
}

