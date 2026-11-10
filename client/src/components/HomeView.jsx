import React from 'react';
import { 
  Mail, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  Briefcase, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function HomeView({ 
  emails = [], 
  digest, 
  stats, 
  onSelectEmail, 
  onNavigate 
}) {
  const { greeting } = useUser();
  // Sort high priority emails by urgency
  const topPriorityEmail = emails.find(e => (e.priority || '').toLowerCase() === 'high') || emails[0];

  // Confirmed upcoming deadlines
  const upcomingDeadlines = emails
    .filter(e => Boolean(e.deadline))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);

  // Helper for status badge style
  const getBadgeStyle = (item) => {
    if (item.deadline_confidence === 'uncertain') {
      return { text: 'Unconfirmed · Verify', class: 'badge-unconfirmed' };
    }
    const days = Math.ceil((new Date(item.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    if (days <= 1) {
      return { text: 'Urgent', class: 'badge-urgent' };
    }
    if (days <= 3) {
      return { text: 'Soon', class: 'badge-soon' };
    }
    return { text: 'Info', class: 'badge-info' };
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return { day: '10', month: 'Nov' };
    const d = new Date(dateStr);
    return {
      day: d.getDate().toString().padStart(2, '0'),
      month: d.toLocaleString('en-US', { month: 'short' }),
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* 1. Page Header Greeting */}
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink">
          {greeting}
        </h1>
        <p className="text-sm sm:text-base text-ink-muted mt-1.5 font-medium">
          Here’s what matters today.
        </p>
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
              {String(stats.unread || 3).padStart(2, '0')}
            </span>
            <p className="text-xs font-semibold text-ink-muted mt-1 uppercase tracking-wide">
              Needs attention
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
              {String(stats.deadlines || 2).padStart(2, '0')}
            </span>
            <p className="text-xs font-semibold text-ink-muted mt-1 uppercase tracking-wide">
              Upcoming deadlines
            </p>
          </div>
        </div>

        {/* Stat 3: New Opportunities */}
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
              {String(stats.highPriority || 4).padStart(2, '0')}
            </span>
            <p className="text-xs font-semibold text-ink-muted mt-1 uppercase tracking-wide">
              New opportunities
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
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-ink group-hover:text-forest transition-colors leading-tight">
                        {topPriorityEmail.deadline_label || topPriorityEmail.subject}
                      </h3>
                      {topPriorityEmail.deadline && (
                        <p className="text-xs text-ink-muted font-medium mt-0.5">
                          Due {new Date(topPriorityEmail.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="badge-urgent text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                    Urgent
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed line-clamp-2">
                  {topPriorityEmail.summary || topPriorityEmail.body.replace(/\n+/g, ' ')}
                </p>

                <div className="pt-2 text-[11px] text-ink-muted border-t border-cream-border/70 flex items-center justify-between">
                  <span>
                    Source: <span className="font-semibold text-ink">{topPriorityEmail.senderName || topPriorityEmail.sender.split('<')[0]}</span> · Verify deadline
                  </span>
                  <span className="text-forest font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Details →
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">No urgent priorities pending.</p>
            )}
          </div>

          {/* AI Summary Card (Academic Digest) */}
          <div className="editorial-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base text-ink">
                AI Summary
              </h2>
              <button 
                onClick={() => onNavigate && onNavigate('inbox')}
                className="text-xs font-semibold text-ink-muted hover:text-forest flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
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
                    {digest?.summary || '3 academic updates, 1 club announcement, and 2 opportunities summarized for you.'}
                  </p>
                </div>
              </div>

              {digest?.actionItems && digest.actionItems.length > 0 && (
                <div className="pt-2 space-y-1.5 border-t border-cream-border/60">
                  {digest.actionItems.slice(0, 2).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-ink">
                      <span className="w-1.5 h-1.5 rounded-full bg-forest mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 text-[11px] text-ink-muted border-t border-cream-border/70 flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-gold" />
                  <span>AI-generated · View original emails</span>
                </span>
                <button 
                  onClick={() => onNavigate && onNavigate('inbox')}
                  className="text-forest font-semibold hover:underline"
                >
                  Review all →
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Upcoming Deadlines & Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Upcoming Deadlines Timeline Card */}
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

            <div className="space-y-3.5">
              {upcomingDeadlines.map((item, idx) => {
                const dateParts = formatShortDate(item.deadline);
                const badge = getBadgeStyle(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectEmail && onSelectEmail(item)}
                    className="flex items-start gap-3.5 p-2 rounded-xl hover:bg-cream/60 transition-colors cursor-pointer group"
                  >
                    {/* Date Block */}
                    <div className="text-center shrink-0 w-8 pt-0.5">
                      <span className="font-serif font-bold text-lg text-ink block leading-none">
                        {dateParts.day}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-ink-muted block mt-0.5">
                        {dateParts.month}
                      </span>
                    </div>

                    {/* Timeline Dot & Line */}
                    <div className="flex flex-col items-center shrink-0 self-stretch pt-1.5">
                      <span className="w-2 h-2 rounded-full border-2 border-forest bg-cream shrink-0" />
                      {idx < upcomingDeadlines.length - 1 && (
                        <span className="w-px flex-1 bg-cream-border mt-1" />
                      )}
                    </div>

                    {/* Deadline Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs sm:text-sm font-bold text-ink truncate group-hover:text-forest transition-colors">
                          {item.deadline_label || item.subject}
                        </p>
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
          </div>

          {/* Quick Actions Card */}
          <div className="editorial-card p-6 space-y-3">
            <h2 className="font-bold text-sm sm:text-base text-ink mb-2">
              Quick Actions
            </h2>

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

