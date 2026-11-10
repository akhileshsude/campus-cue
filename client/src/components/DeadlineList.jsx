import React, { useState, useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, AlertCircle, ChevronRight, CheckCircle2, Filter } from 'lucide-react';

function getDeadlineCategory(deadlineStr) {
  if (!deadlineStr) return null;
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffHours = (deadline - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'Overdue';
  if (diffHours <= 24) return 'Today';
  if (diffHours <= 24 * 7) return 'This week';
  return 'Later';
}

function getDaysRemainingText(deadlineStr) {
  if (!deadlineStr) return '';
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffTime = deadline - now;
  const diffHours = diffTime / (1000 * 60 * 60);

  if (diffHours < 0) {
    const daysAgo = Math.abs(Math.floor(diffHours / 24));
    return daysAgo <= 0 ? 'Passed today' : `${daysAgo}d overdue`;
  }
  if (diffHours <= 24) {
    const hours = Math.round(diffHours);
    return hours <= 1 ? 'Due in <1h' : `Due in ${hours}h`;
  }
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1 ? 'Due tomorrow' : `${diffDays} days left`;
}

export default function DeadlineList({ emails = [], onSelectEmail }) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'confirmed_only'

  // Extract all emails with deadlines and group chronologically
  const groupedDeadlines = useMemo(() => {
    const list = emails
      .filter((e) => Boolean(e.deadline))
      .filter((e) => {
        if (filterMode === 'confirmed_only') {
          return e.deadline_confidence !== 'uncertain';
        }
        return true;
      })
      .map((e) => ({
        ...e,
        group: getDeadlineCategory(e.deadline),
        timeRemainingText: getDaysRemainingText(e.deadline),
      }))
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const groups = {
      Overdue: [],
      Today: [],
      'This week': [],
      Later: [],
    };

    list.forEach((item) => {
      if (groups[item.group]) {
        groups[item.group].push(item);
      } else {
        groups.Later.push(item);
      }
    });

    return groups;
  }, [emails, filterMode]);

  const totalDeadlines = Object.values(groupedDeadlines).reduce((acc, g) => acc + g.length, 0);
  const uncertainCount = emails.filter(e => e.deadline && e.deadline_confidence === 'uncertain').length;

  return (
    <div className="rounded-2xl glass p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center justify-center shadow-xs">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#1F2937] leading-tight">
              Deadline Radar
            </h3>
            <span className="text-[11px] text-[#4B5563]">
              Chronological submission & event timeline
            </span>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode(filterMode === 'all' ? 'confirmed_only' : 'all')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-200 ${
              filterMode === 'confirmed_only'
                ? 'bg-[#4F46E5] text-white shadow-xs'
                : 'glass-nested text-[#4B5563] hover:text-[#1F2937]'
            }`}
          >
            {filterMode === 'confirmed_only' ? 'Confirmed Only' : 'All Deadlines'}
          </button>
        </div>
      </div>

      {/* Uncertainty Notice if uncertain deadlines exist */}
      {uncertainCount > 0 && filterMode === 'all' && (
        <div className="mt-3 px-3 py-2 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>{uncertainCount} tentative deadline{uncertainCount > 1 ? 's' : ''} detected.</strong> Marked with caution badges; excluded from confirmed alerts.
          </span>
        </div>
      )}

      {/* Timeline Groups */}
      <div className="mt-4 space-y-4">
        {totalDeadlines === 0 ? (
          <div className="text-center py-6 text-[#4B5563] text-xs">
            No upcoming deadlines on your radar. All caught up!
          </div>
        ) : (
          Object.entries(groupedDeadlines).map(([groupName, items]) => {
            if (items.length === 0) return null;

            const isOverdue = groupName === 'Overdue';
            const isToday = groupName === 'Today';

            return (
              <div key={groupName} className="space-y-2">
                {/* Group Heading */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isOverdue
                        ? 'bg-red-50/80 text-red-700 border border-red-200/50'
                        : isToday
                        ? 'bg-rose-50/80 text-rose-700 border border-rose-200/50'
                        : 'bg-white/60 text-[#4B5563] border border-white/60'
                    }`}
                  >
                    {groupName} ({items.length})
                  </span>
                  <div className="flex-1 h-px bg-white/50" />
                </div>

                {/* Items in this group */}
                <div className="space-y-2">
                  {items.map((item) => {
                    const isUncertain = item.deadline_confidence === 'uncertain';
                    const formattedDate = new Date(item.deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectEmail && onSelectEmail(item)}
                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                          isOverdue
                            ? 'bg-red-50/60 border border-red-200/70 hover:bg-red-50/90'
                            : isUncertain
                            ? 'bg-amber-50/50 border border-dashed border-amber-300/80 hover:bg-amber-50/80'
                            : 'glass-nested'
                        }`}
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`text-xs font-bold truncate group-hover:text-[#4F46E5] transition-colors ${
                              isOverdue ? 'text-red-900' : 'text-[#1F2937]'
                            }`}>
                              {item.deadline_label || item.subject}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#4B5563]">
                            <span className="truncate">{item.senderName || item.sender.split('<')[0]}</span>
                            <span>•</span>
                            <span className="shrink-0">{formattedDate}</span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isUncertain ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              <span>Unconfirmed</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                              {item.timeRemainingText}
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isToday
                                ? 'bg-rose-50/90 text-rose-700 border-rose-200'
                                : 'bg-white/70 text-[#4B5563] border-white/80'
                            }`}>
                              {item.timeRemainingText}
                            </span>
                          )}

                          <ChevronRight className="h-4 w-4 text-[#4B5563]/40 group-hover:text-[#1F2937] transition-colors hidden sm:block" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
