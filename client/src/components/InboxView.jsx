import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  User, 
  Mail, 
  CheckCircle2, 
  ChevronDown,
  Sparkles,
  Inbox as InboxIcon,
  PlusCircle,
  RefreshCw
} from 'lucide-react';

const CATEGORIES = ['All', 'Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];

export default function InboxView({ 
  emails = [], 
  onSelectEmail, 
  onToggleRead, 
  onUpdateCategory,
  onOpenIngest,
  isProcessing = false,
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter emails based on category and search
  const filteredEmails = emails.filter((email) => {
    const effectiveCategory = email.user_category || email.category || 'Announcements';
    if (activeCategory !== 'All' && effectiveCategory.toLowerCase() !== activeCategory.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        email.subject.toLowerCase().includes(q) ||
        email.sender.toLowerCase().includes(q) ||
        email.body.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const formatRowTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    const diffDays = Math.round(diffHours / 24);
    if (diffDays <= 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getRowBadge = (email) => {
    const effectivePriority = (email.user_priority || email.priority || 'medium').toLowerCase();
    const effectiveCat = email.user_category || email.category || 'Announcements';

    if (effectivePriority === 'high') {
      return { label: 'Urgent', class: 'badge-urgent' };
    }
    if (effectiveCat === 'Academics') {
      return { label: 'Academic', class: 'badge-info' };
    }
    if (effectiveCat === 'Placements') {
      return { label: 'Placement', class: 'badge-soon' };
    }
    if (effectiveCat === 'Events') {
      return { label: 'Event', class: 'badge-info' };
    }
    if (effectiveCat === 'Clubs') {
      return { label: 'Club', class: 'bg-[#F2EFE8] border border-sage-light text-[#4A574F]' };
    }
    return { label: effectiveCat, class: 'badge-info' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header with Title & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Inbox
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Classified correspondence, actions & academic updates
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search in Inbox..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm bg-cream-card border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
            />
          </div>

          {onOpenIngest && (
            <button
              onClick={onOpenIngest}
              className="px-3.5 py-1.5 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
              title="Add or ingest new emails"
            >
              <PlusCircle className="w-3.5 h-3.5 text-gold" />
              <span>Add Email</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Processing Banner */}
      {isProcessing && (
        <div className="p-3 bg-forest/10 border border-forest/20 rounded-xl flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-4 h-4 text-forest animate-spin shrink-0" />
          <div className="text-xs text-forest">
            <span className="font-bold">Processing with AI...</span> Analyzing collegiate emails in batches, extracting deadlines & generating structured summaries.
          </div>
        </div>
      )}

      {/* Category Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-cream-border">
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
                isSelected
                  ? 'border-forest text-forest font-bold'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Email List Feed Table */}
      <div className="editorial-card divide-y divide-cream-border overflow-hidden">
        {filteredEmails.length === 0 ? (
          <div className="p-12 text-center text-ink-muted space-y-3">
            <InboxIcon className="w-10 h-10 mx-auto text-ink-muted/40" />
            <div>
              <p className="text-sm font-bold text-ink">No emails found</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {activeCategory !== 'All' 
                  ? `No correspondence found in ${activeCategory}. Try another category or clear your search.`
                  : 'Your inbox is completely clear. Ingest an .eml file, connect Gmail, or paste correspondence to get started.'}
              </p>
            </div>
            {onOpenIngest && (
              <div className="pt-2">
                <button
                  onClick={onOpenIngest}
                  className="px-4 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-gold" />
                  <span>Add your first email</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredEmails.map((email) => {
            const badge = getRowBadge(email);
            const timeText = formatRowTime(email.received_at);
            const hasUserOverride = Boolean(email.user_category || email.user_priority || email.user_deadline || email.edited_by_user);

            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail && onSelectEmail(email)}
                className={`p-4 sm:p-4.5 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer hover:bg-cream/60 transition-colors ${
                  !email.is_read ? 'bg-cream-card font-semibold' : 'bg-cream-card/60'
                }`}
              >
                {/* Left: Unread Dot + Sender Avatar + Text */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Unread dot */}
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      !email.is_read ? 'bg-forest' : 'bg-transparent'
                    }`}
                  />

                  {/* Sender Avatar */}
                  <div className="w-8 h-8 rounded-full bg-cream-border/70 border border-cream-border text-ink flex items-center justify-center font-bold text-xs shrink-0">
                    {(email.senderName || email.sender)[0]}
                  </div>

                  {/* Sender & Preview Line */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xs sm:text-sm truncate ${!email.is_read ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
                        {email.senderName || email.sender.split('<')[0]}
                      </span>
                      {hasUserOverride && (
                        <span className="bg-sage/20 text-forest text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-sage/40 shrink-0">
                          Edited by you
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs sm:text-sm text-ink-muted truncate font-normal">
                        <strong className="text-ink font-semibold">{email.subject}</strong> — {email.summary || email.body.replace(/\n+/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Badge & Timestamp */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badge.class}`}>
                    {badge.label}
                  </span>

                  <span className="text-[11px] font-medium text-ink-muted w-16 sm:w-20 text-right">
                    {timeText}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
