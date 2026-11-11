import React, { useState, useMemo } from 'react';
import { Clock, Calendar, AlertTriangle, ArrowRight, CheckCircle2, Download } from 'lucide-react';

export default function DeadlinesView({ emails = [], onSelectEmail }) {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'overdue' | 'completed'

  const deadlines = useMemo(() => {
    const now = new Date();

    return emails
      .filter((e) => Boolean(e.user_deadline || e.deadline))
      .map((item) => {
        const effectiveDeadline = item.user_deadline || item.deadline;
        const deadlineDate = new Date(effectiveDeadline);
        const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;

        let statusText = 'Info';
        let statusClass = 'badge-info';

        if (item.deadline_confidence === 'uncertain' && !item.user_deadline) {
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
          effectiveDeadline,
          diffDays,
          isOverdue,
          statusText,
          statusClass,
          isUserCorrected: Boolean(item.user_deadline),
          shortDate: {
            day: deadlineDate.getDate().toString().padStart(2, '0'),
            month: deadlineDate.toLocaleString('en-US', { month: 'short' }),
          },
        };
      })
      .sort((a, b) => new Date(a.effectiveDeadline) - new Date(b.effectiveDeadline));
  }, [emails]);

  // Filter deadlines by tab
  const filteredDeadlines = deadlines.filter((d) => {
    if (activeTab === 'overdue') return d.isOverdue;
    if (activeTab === 'completed') return false;
    return !d.isOverdue;
  });

  // RFC 5545 iCalendar Export (.ics file generation)
  const handleExportICS = () => {
    const pad = (n) => (n < 10 ? '0' + n : n);
    const formatICSDate = (date) => {
      const d = new Date(date);
      return (
        d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
      );
    };

    const escapeICS = (str) =>
      (str || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');

    const confirmedItems = deadlines.filter(
      (d) => d.effectiveDeadline && (d.deadline_confidence !== 'uncertain' || d.isUserCorrected)
    );

    if (confirmedItems.length === 0) {
      alert('No confirmed deadlines to export.');
      return;
    }

    const events = confirmedItems.map((d) => {
      const start = new Date(d.effectiveDeadline);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hr block
      const now = new Date();
      const uid = `cue-${d.id || Math.random().toString(36).slice(2)}@campus-cue`;

      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART:${formatICSDate(start)}`,
        `DTEND:${formatICSDate(end)}`,
        `SUMMARY:${escapeICS(d.deadline_label || d.subject)}`,
        `DESCRIPTION:${escapeICS((d.summary || '') + '\n\nAction: ' + (d.required_action || 'Review deliverable'))}`,
        `CATEGORIES:${escapeICS(d.user_category || d.category || 'Collegiate')}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT24H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: ${escapeICS(d.deadline_label || d.subject)} due soon`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    });

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Campus Cue//Student AI Assistant//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Campus Cue Academic Deadlines',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'campus_deadlines.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cream-border">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Deadlines
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            Confirmed academic milestones & student deliverables
          </p>
        </div>

        {/* Action Controls & Status Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Calendar Export Button */}
          <button
            onClick={handleExportICS}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cream-card hover:bg-cream border border-cream-border text-forest flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Download .ics file for Google Calendar, Apple Calendar or Outlook"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Calendar (.ics)</span>
          </button>

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
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-ink group-hover:text-forest transition-colors truncate">
                        {item.deadline_label || item.subject}
                      </h3>
                      {item.isUserCorrected && (
                        <span className="bg-sage/20 text-forest text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-sage/40 shrink-0">
                          Edited by you
                        </span>
                      )}
                    </div>
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
