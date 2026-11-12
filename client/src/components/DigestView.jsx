import React from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Calendar, 
  AlertTriangle, 
  Briefcase, 
  CheckSquare, 
  Mail, 
  ArrowRight,
  ShieldCheck,
  Clock,
  ExternalLink
} from 'lucide-react';

export default function DigestView({ 
  digest, 
  onRefreshDigest, 
  isRefreshing, 
  onSelectEmailById 
}) {
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const isGeminiDigest = digest?._source === 'gemini';
  const isEmptyDigest = !digest || digest?._source === 'empty';

  return (
    <div className="space-y-8 animate-in fade-in duration-200 max-w-5xl">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-cream-border">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {isGeminiDigest ? (
              <span className="badge-info text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-gold" />
                <span>AI-generated · {digest.model || 'gemini-3.5-flash-lite'}</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                <span>Basic analysis (AI offline)</span>
              </span>
            )}
            <span className="text-xs text-ink-muted">· Daily Academic Briefing</span>
          </div>
          {digest?.ai_error && !isGeminiDigest && (
            <p className="text-[11px] text-amber-800 mb-1">
              Fallback reason: {digest.ai_error}
            </p>
          )}
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Academic Command Center
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1">
            Synthesized briefing for {todayFormatted}
          </p>
        </div>

        {/* Refresh Digest Button (retries Gemini) */}
        <button
          onClick={onRefreshDigest}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-forest hover:bg-forest-hover rounded-xl transition-all shadow-xs disabled:opacity-60 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gold ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Regenerating...' : !isGeminiDigest && !isEmptyDigest ? 'Reprocess with AI' : 'Refresh Digest'}</span>
        </button>
      </div>

      {/* 2. Overview Banner (2 to 3 friendly sentences) */}
      <div className="editorial-card p-6 bg-[#FAF6EE] border-gold/40 space-y-2">
        <div className="flex items-center gap-2 text-gold font-bold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Executive Daily Overview</span>
        </div>
        <p className="font-serif text-lg sm:text-xl font-medium text-ink leading-relaxed">
          {digest?.overview || 'Good day! All your current collegiate correspondence and academic deadlines have been summarized below.'}
        </p>
      </div>

      {/* 3. Main Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Section A: Upcoming Confirmed Deadlines */}
        <div className="editorial-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cream-border/70">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-forest" />
              <h2 className="font-bold text-sm text-ink">Upcoming Deadlines (Confirmed)</h2>
            </div>
            <span className="text-xs font-bold text-forest bg-cream-card px-2 py-0.5 rounded-full border border-cream-border">
              {digest?.upcoming_deadlines?.length || 0} confirmed
            </span>
          </div>

          <div className="space-y-3">
            {digest?.upcoming_deadlines && digest.upcoming_deadlines.length > 0 ? (
              digest.upcoming_deadlines.map((item, i) => (
                <div 
                  key={i}
                  onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                  className="editorial-row p-3 rounded-xl border border-cream-border flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-forest transition-colors truncate">
                      {item.event_name}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      Due: {item.deadline ? new Date(item.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Soon'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.urgency === 'Urgent' ? 'badge-urgent' : 'badge-soon'
                    }`}>
                      {item.days_left !== undefined ? `${item.days_left}d left` : item.urgency}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-muted py-3">No confirmed deadlines due soon.</p>
            )}
          </div>
        </div>

        {/* Section B: Uncertain Deadlines ("To Verify" List) */}
        <div className="editorial-card p-6 space-y-4 border-amber-300/80 bg-amber-50/20">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <h2 className="font-bold text-sm text-ink">Dates to Verify (Tentative)</h2>
            </div>
            <span className="badge-unconfirmed text-[10px] font-bold px-2 py-0.5 rounded-full">
              Requires confirmation
            </span>
          </div>

          <div className="space-y-3">
            {digest?.uncertain_deadlines && digest.uncertain_deadlines.length > 0 ? (
              digest.uncertain_deadlines.map((item, i) => (
                <div 
                  key={i}
                  onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                  className="editorial-row p-3 rounded-xl border border-dashed border-amber-300 bg-cream-card/70 flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-forest transition-colors truncate">
                      {item.deadline_label}
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                      {item.notes}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-muted py-3">No uncertain or tentative dates flagged.</p>
            )}
          </div>
        </div>

        {/* Section C: Urgent Announcements */}
        <div className="editorial-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cream-border/70">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-forest" />
              <h2 className="font-bold text-sm text-ink">Urgent Campus Announcements</h2>
            </div>
            <span className="badge-urgent text-[10px] font-bold px-2 py-0.5 rounded-full">
              High Priority
            </span>
          </div>

          <div className="space-y-3">
            {digest?.urgent_announcements && digest.urgent_announcements.length > 0 ? (
              digest.urgent_announcements.map((item, i) => (
                <div 
                  key={i}
                  onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                  className="editorial-row p-3 rounded-xl border border-cream-border flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-forest transition-colors">
                      {item.subject}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-1 line-clamp-2">
                      {item.takeaway}
                    </p>
                    {item.action && (
                      <p className="text-[11px] font-semibold text-forest mt-1.5">
                        Action: {item.action}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-1 group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-muted py-3">No urgent announcements today.</p>
            )}
          </div>
        </div>

        {/* Section D: Placement & Career Opportunities */}
        <div className="editorial-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cream-border/70">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gold" />
              <h2 className="font-bold text-sm text-ink">Placements & Opportunities</h2>
            </div>
            <span className="text-[11px] font-semibold text-gold uppercase tracking-wider">
              Careers
            </span>
          </div>

          <div className="space-y-3">
            {digest?.placement_opportunities && digest.placement_opportunities.length > 0 ? (
              digest.placement_opportunities.map((item, i) => (
                <div 
                  key={i}
                  onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                  className="editorial-row p-3 rounded-xl border border-cream-border flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-ink group-hover:text-forest transition-colors">
                      {item.company_role}
                    </p>
                    {item.deadline && (
                      <p className="text-[11px] text-gold-dark font-medium mt-0.5">
                        Deadline: {new Date(item.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                    <p className="text-[11px] text-ink-muted mt-1">
                      {item.action}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-1 group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-muted py-3">No active placement deadlines today.</p>
            )}
          </div>
        </div>

      </div>

      {/* 4. Section E: Pending Student Actions Checklist */}
      <div className="editorial-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cream-border/70">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-forest" />
            <h2 className="font-bold text-sm text-ink">Pending Student Actions & Replies</h2>
          </div>
          <span className="text-xs font-bold text-ink-muted">
            {digest?.pending_actions?.length || 0} pending items
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {digest?.pending_actions && digest.pending_actions.length > 0 ? (
            digest.pending_actions.map((item, i) => (
              <div 
                key={i}
                onClick={() => onSelectEmailById && onSelectEmailById(item.email_id)}
                className="editorial-row p-3 rounded-xl border border-cream-border flex items-start justify-between gap-3 cursor-pointer group"
              >
                <div className="min-w-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1 ${
                    item.type === 'reply' ? 'badge-info' : 'badge-soon'
                  }`}>
                    {item.type === 'reply' ? 'Reply Needed' : 'Action Due'}
                  </span>
                  <p className="text-xs font-semibold text-ink group-hover:text-forest transition-colors">
                    {item.action}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {item.due_hint}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0 mt-2 group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
              </div>
            ))
          ) : (
            <p className="text-xs text-ink-muted py-3 col-span-2">No pending actions required.</p>
          )}
        </div>
      </div>

    </div>
  );
}

