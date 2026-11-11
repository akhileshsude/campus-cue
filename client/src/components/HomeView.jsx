import React from 'react';
import { 
  Mail, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  Briefcase, 
  BookOpen, 
  RefreshCw,
  PlugZap,
  Trash2
} from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function HomeView({ 
  emails = [], 
  digest, 
  stats, 
  dataMode = 'live',
  connectedAccountsCount = 0,
  onSelectEmail, 
  onNavigate,
  onRegenerateDigest,
  isRegeneratingDigest = false,
  onSelectEmailById,
  onOpenConnectInbox,
  onClearDemo,
}) {
  const { greeting } = useUser();

  const topPriorityEmail =
    emails.find(e => ((e.user_priority || e.priority) || '').toLowerCase() === 'high') || emails[0];

  const upcomingDeadlines = emails
    .filter(e => Boolean(e.user_deadline || e.deadline) && !e.deadline_completed)
    .sort((a, b) => new Date(a.user_deadline || a.deadline) - new Date(b.user_deadline || b.deadline))
    .slice(0, 4);

  const getBadgeStyle = (item) => {
    const effectiveDeadline = item.user_deadline || item.deadline;
    if (item.deadline_confidence === 'uncertain' && !item.user_deadline) {
      return { text: 'Unconfirmed · Verify', class: 'badge-unconfirmed' };
    }
    const days = Math.ceil((new Date(effectiveDeadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Overdue', class: 'badge-urgent' };
    if (days <= 1) return { text: 'Urgent', class: 'badge-urgent' };
    if (days <= 3) return { text: 'Soon', class: 'badge-soon' };
    return { text: 'Info', class: 'badge-info' };
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return { day: '--', month: '' };
    const d = new Date(dateStr);
    return {
      day: d.getDate().toString().padStart(2, '0'),
      month: d.toLocaleString('en-US', { month: 'short' }),
    };
  };

  const unreadDisplay = String(stats?.unread ?? 0).padStart(2, '0');
  const deadlinesDisplay = String(stats?.deadlines ?? 0).padStart(2, '0');
  const highPriorityDisplay = String(stats?.highPriority ?? 0).padStart(2, '0');

  const topPriorityEffective = topPriorityEmail
    ? (topPriorityEmail.user_priority || topPriorityEmail.priority || 'Medium').toLowerCase()
    : 'medium';

  const topDeadlineDisplay = topPriorityEmail
    ? (topPriorityEmail.user_deadline || topPriorityEmail.deadline)
    : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {/* Demo Showcase -> Real Inbox Transition Banner */}
      {dataMode === 'demo' && (
        <div className="p-4 rounded-2xl border border-gold/40 bg-[#FAF6EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-forest text-gold flex items-center justify-center shrink-0">
              <PlugZap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">
                Showcase Sample Data Active
              </p>
              <p className="text-[11px] text-ink-muted">
                Connect your Gmail, Outlook, iCloud, Yahoo, or college email ID to replace sample emails with your real inbox.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onClearDemo && (
              <button
                onClick={onClearDemo}
                className="px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink border border-cream-border bg-cream-card rounded-xl inline-flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Start Empty</span>
              </button>
            )}
            {onOpenConnectInbox && (
              <button
                onClick={onOpenConnectInbox}
                className="px-3.5 py-1.5 text-xs font-semibold bg-forest hover:bg-forest-hover text-[#F1EBDD] rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <span>Connect Real Email</span>
                <ArrowRight className="w-3.5 h-3.5 text-gold" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. Page Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink">
            {greeting}
          </h1>
          <p className="text-sm sm:text-base text-ink-muted mt-1.5 font-medium">
            {dataMode === 'live'
              ? connectedAccountsCount > 0
                ? `Connected to ${connectedAccountsCount} live inbox account${connectedAccountsCount === 1 ? '' : 's'}.`
                : 'Here’s what matters in your inbox today.'
              : 'Here’s what matters today.'}
          </p>
        </div>
      </div>

      {/* 2. Three Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        
        {/* Stat 1: Needs Attention */}
        <div 
          onClick={() => onNavigate && onNavigate('inbox')}
          className="editorial-card p-5 cursor-pointer flex flex-col justify-between group hover:shadow-editorial"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
              <Mail className="w-4 h-4 text-gold" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted/50 group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
          </div>

          <div className="mt-4">
            <span className="font-serif text-3xl sm:text-4xl font-bold text-ink">
              {unreadDisplay}
            </span>
            <p className="text-xs font-semibold text-ink-muted mt-1 uppercase tracking-wide">
              Unread · Needs attention
            </p>
          </div>
        </div>

        {/* Stat 2: Upcoming Deadlines */}
        <div 
          onClick={() => onNavigate && onNavigate('deadlines')}
          className="editorial-card p-5 cursor-pointer flex flex-col justify-between group hover:shadow-editorial"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
              <Calendar className="w-4 h-4 text-gold" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted/50 group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
          </div>

          <div className="mt-4">
            <span className="font-serif text-3xl sm:text-4xl font-bold text-ink">
              {deadlinesDisplay}
            </span>
            <p className="text-xs font-semibold text-ink-muted mt-1 uppercase tracking-wide">
              Confirmed deadlines
            </p>
          </div>
        </div>

        {/* Stat 3: High Priority */}
        <div 
          onClick={() => onNavigate && onNavigate('inbox')}
          className="editorial-card p-5 cursor-pointer flex flex-col justify-between group hover:shadow-editorial"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted/50 group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
          </div>

          <div className="mt-4">
            <span className="font-serif text-3xl sm:text-4xl font-bold text-ink">
              {highPriorityDisplay}
            </span>
            <p className="text-xs font-semibold text-ink-muted mt-1 uppercase tracking-wide">
              High priority emails
            </p>
          </div>
        </div>

      </div>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Top Priority & AI Summary */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Top Priority Card */}
          <div className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base text-ink">
                Top Priority
              </h2>
              <button 
                onClick={() => onNavigate && onNavigate('inbox')}
                className="text-xs font-semibold text-ink-muted hover:text-forest flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topPriorityEmail ? (
              <div 
                onClick={() => onSelectEmail && onSelectEmail(topPriorityEmail)}
                className="space-y-3 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-gold" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-ink group-hover:text-forest transition-colors leading-tight truncate">
                        {topPriorityEmail.deadline_label || topPriorityEmail.subject}
                      </h3>
                      {topDeadlineDisplay && (
                        <p className="text-xs text-ink-muted font-medium mt-0.5">
                          Due {new Date(topDeadlineDisplay).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {Boolean(topPriorityEmail.user_priority || topPriorityEmail.user_category || topPriorityEmail.user_deadline || topPriorityEmail.edited_by_user) && (
                      <span className="bg-sage/20 text-forest text-[10px] font-bold px-2 py-0.5 rounded-full border border-sage/40">
                        Edited by you
                      </span>
                    )}
                    <span className={`${topPriorityEffective === 'high' ? 'badge-urgent' : 'badge-info'} text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0`}>
                      {topPriorityEffective === 'high' ? 'Urgent' : (topPriorityEmail.user_category || topPriorityEmail.category)}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed line-clamp-2">
                  {topPriorityEmail.summary || (topPriorityEmail.body || '').replace(/\n+/g, ' ')}
                </p>

                <div className="pt-2 text-[11px] text-ink-muted border-t border-cream-border/70 flex items-center justify-between">
                  <span>
                    Source: <span className="font-semibold text-ink">{topPriorityEmail.senderName || topPriorityEmail.sender.split('<')[0]}</span>
                    {topDeadlineDisplay
                      ? topPriorityEmail.deadline_confidence === 'uncertain' && !topPriorityEmail.user_deadline
                        ? ' · Unconfirmed deadline'
                        : ' · Confirmed deadline'
                      : ''}
                  </span>
                  <span className="text-forest font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Details →
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-xs text-ink-muted space-y-2">
                <p>No emails in your active inbox yet.</p>
                {onOpenConnectInbox && (
                  <button
                    onClick={onOpenConnectInbox}
                    className="px-3 py-1.5 bg-forest text-[#F1EBDD] text-xs font-semibold rounded-xl hover:bg-forest-hover inline-flex items-center gap-1.5"
                  >
                    <PlugZap className="w-3.5 h-3.5 text-gold" />
                    <span>Connect Email Inbox</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* AI Summary Card (Academic Digest) */}
          <div className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-ink">
                  AI Summary
                </h2>
                <span className="badge-info text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-gold" />
                  <span>AI-generated</span>
                </span>
              </div>

              {onRegenerateDigest && (
                <button
                  onClick={onRegenerateDigest}
                  disabled={isRegeneratingDigest}
                  title="Regenerate today's academic digest with AI"
                  className="p-1.5 rounded-lg border border-cream-border bg-cream hover:bg-cream-border/50 text-ink-muted hover:text-forest transition-colors text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingDigest ? 'animate-spin text-forest' : ''}`} />
                  <span className="hidden sm:inline text-[11px] font-semibold">
                    {isRegeneratingDigest ? 'Refreshing...' : 'Refresh'}
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink">
                    Your academic digest
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed mt-1">
                    {digest?.overview || digest?.summary || 'Connect your inbox or paste emails to synthesize your daily digest.'}
                  </p>
                </div>
              </div>

              {digest?.important_new_emails && digest.important_new_emails.length > 0 && (
                <div className="pt-2 space-y-2 border-t border-cream-border/60">
                  {digest.important_new_emails.slice(0, 2).map((item, i) => (
                    <div 
                      key={i} 
                      onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                      className="p-2 rounded-lg bg-cream/70 hover:bg-cream border border-cream-border/60 flex items-start justify-between gap-2 cursor-pointer group transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink group-hover:text-forest transition-colors truncate">
                          {item.headline}
                        </p>
                        <p className="text-[11px] text-ink-muted line-clamp-1">
                          {item.takeaway}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-forest group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 text-[11px] text-ink-muted border-t border-cream-border/70 flex items-center justify-between">
                <span>Click any item to view original email</span>
                <button 
                  onClick={() => onNavigate && onNavigate('digest')}
                  className="text-forest font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Full Digest Page</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Upcoming Deadlines & Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base text-ink">
                Upcoming Deadlines
              </h2>
              <button 
                onClick={() => onNavigate && onNavigate('deadlines')}
                className="text-xs font-semibold text-ink-muted hover:text-forest flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-ink-muted py-4">
                No upcoming deadlines extracted yet.
              </p>
            ) : (
              <div className="space-y-3.5">
                {upcomingDeadlines.map((item, idx) => {
                  const effectiveDeadline = item.user_deadline || item.deadline;
                  const dateParts = formatShortDate(effectiveDeadline);
                  const badge = getBadgeStyle(item);

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectEmail && onSelectEmail(item)}
                      className="flex items-start gap-3.5 p-2 rounded-xl hover:bg-cream/60 transition-colors cursor-pointer group"
                    >
                      <div className="text-center shrink-0 w-8 pt-0.5">
                        <span className="font-serif font-bold text-lg text-ink block leading-none">
                          {dateParts.day}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-ink-muted block mt-0.5">
                          {dateParts.month}
                        </span>
                      </div>

                      <div className="flex flex-col items-center shrink-0 self-stretch pt-1.5">
                        <span className="w-2 h-2 rounded-full border-2 border-forest bg-cream shrink-0" />
                        {idx < upcomingDeadlines.length - 1 && (
                          <span className="w-px flex-1 bg-cream-border mt-1" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-ink truncate group-hover:text-forest transition-colors">
                              {item.deadline_label || item.subject}
                            </p>
                            {Boolean(item.user_deadline) && (
                              <span className="bg-sage/20 text-forest text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-sage/40 shrink-0">
                                Edited
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full shrink-0 ${badge.class}`}>
                            {badge.text}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted truncate mt-0.5">
                          {item.senderName || item.sender.split('<')[0]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="editorial-card p-6 space-y-3">
            <h2 className="font-bold text-sm sm:text-base text-ink mb-2">
              Quick Actions
            </h2>

            {onOpenConnectInbox && (
              <button
                onClick={onOpenConnectInbox}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-forest/30 bg-forest/5 hover:bg-forest/10 transition-colors text-xs font-semibold text-forest group"
              >
                <div className="flex items-center gap-2.5">
                  <PlugZap className="w-4 h-4 text-forest" />
                  <span>Connect or Sync Email Account</span>
                </div>
                <ArrowRight className="w-4 h-4 text-forest group-hover:translate-x-0.5 transition-all" />
              </button>
            )}

            <button
              onClick={() => onNavigate && onNavigate('inbox')}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-cream-border bg-cream-card hover:bg-cream transition-colors text-xs font-semibold text-ink group"
            >
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-gold" />
                <span>Go to Inbox</span>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => onNavigate && onNavigate('deadlines')}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-cream-border bg-cream-card hover:bg-cream transition-colors text-xs font-semibold text-ink group"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-gold" />
                <span>View Deadlines</span>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
