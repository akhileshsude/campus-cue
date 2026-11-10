import React, { useState, useMemo } from 'react';
import { Clock, Calendar, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function DeadlinesView({ emails = [], onSelectEmail }) {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'overdue' | 'completed'

  const deadlines = useMemo(() => {
    const now = new Date();

    return emails
      .filter((e) => Boolean(e.deadline))
      .map((item) => {
        const deadlineDate = new Date(item.deadline);
        const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;

        let statusText = 'Info';
        let statusClass = 'badge-info';

        if (item.deadline_confidence === 'uncertain') {
          statusText = 'Unconfirmed · Verify';
          statusClass = 'badge-unconfirmed';
        } else if (isOverdue) {
          statusText = 'Overdue';
          statusClass = 'badge-urgent';
        } else if (diffDays <= 1) {
          statusText = 'Urgent';
          statusClass = 'badge-urgent';
        } else if (diffDays <= 3) {
          statusText = 'Soon';
          statusClass = 'badge-soon';
        }

        return {
          ...item,
          diffDays,
          isOverdue,
          statusText,
          statusClass,
          shortDate: {
            day: deadlineDate.getDate().toString().padStart(2, '0'),
            month: deadlineDate.toLocaleString('en-US', { month: 'short' }),
          },
        };
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, [emails]);

  // Filter deadlines by tab
  const filteredDeadlines = deadlines.filter((d) => {
    if (activeTab === 'overdue') return d.isOverdue;
    if (activeTab === 'completed') return false; // sample
    return !d.isOverdue;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cream-border">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          Deadlines
        </h1>

        {/* Status Tabs */}
        <div className="flex items-center gap-2">
          {['upcoming', 'overdue', 'completed'].map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all ${
                  isSelected
                    ? 'bg-forest text-[#F1EBDD] shadow-xs'
                    : 'bg-cream-card text-ink-muted hover:text-ink border border-cream-border'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vertical Timeline Card */}
      <div className="editorial-card p-6 sm:p-8 space-y-6">
        {filteredDeadlines.length === 0 ? (
          <div className="py-12 text-center text-ink-muted text-xs sm:text-sm">
            No {activeTab} deadlines found. You are completely caught up!
          </div>
        ) : (
          <div className="space-y-6">
            {filteredDeadlines.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => onSelectEmail && onSelectEmail(item)}
                className="flex items-start gap-4 sm:gap-6 group cursor-pointer"
              >
                {/* Left Date Column */}
                <div className="text-center w-10 shrink-0 pt-0.5">
                  <span className="font-serif font-bold text-xl sm:text-2xl text-ink block leading-none">
                    {item.shortDate.day}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block mt-1">
                    {item.shortDate.month}
                  </span>
                </div>

                {/* Timeline Connector Line & Dot */}
                <div className="flex flex-col items-center shrink-0 self-stretch pt-2">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-forest bg-cream-card shrink-0" />
                  {idx < filteredDeadlines.length - 1 && (
                    <span className="w-px flex-1 bg-cream-border mt-1.5" />
                  )}
                </div>

                {/* Deadline Content & Pill */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-cream-border/60">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-ink group-hover:text-forest transition-colors truncate">
                      {item.deadline_label || item.subject}
                    </h3>
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {item.senderName || item.sender.split('<')[0]}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full ${item.statusClass}`}>
                      {item.statusText}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

