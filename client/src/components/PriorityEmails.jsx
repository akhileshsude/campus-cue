import React from 'react';
import { Flame, ArrowUpRight, Clock, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

export default function PriorityEmails({ emails = [], onSelectEmail }) {
  // Pull High priority emails, sorted by nearest deadline (urgency)
  const priorityEmails = emails
    .filter((e) => (e.priority || '').toLowerCase() === 'high')
    .sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return new Date(b.received_at) - new Date(a.received_at);
    });

  if (priorityEmails.length === 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl glass p-4 sm:p-6 border-red-200/50 bg-white/45">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-red-50 text-red-700 border border-red-200/60 flex items-center justify-center shadow-xs">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-[#1F2937]">
                Priority Emails
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50/80 text-red-700 border border-red-200/60">
                {priorityEmails.length} High Priority
              </span>
            </div>
            <p className="text-xs text-[#4B5563]">
              Ranked by urgency: imminent academic submissions, exams, and time-sensitive career slots
            </p>
          </div>
        </div>
      </div>

      {/* Priority Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {priorityEmails.map((email) => {
          const effectiveCategory = email.user_category || email.category;
          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail && onSelectEmail(email)}
              className="glass-nested group relative flex flex-col justify-between p-4 cursor-pointer hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <span className="font-semibold text-[#4B5563] truncate">
                    {email.senderName || email.sender.split('<')[0]}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide font-extrabold px-1.5 py-0.5 rounded bg-white/60 text-[#4B5563] border border-white/70">
                    {effectiveCategory}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-[#1F2937] group-hover:text-[#4F46E5] transition-colors line-clamp-2 mb-1.5">
                  {email.subject}
                </h4>

                {/* Priority Reason */}
                {email.priority_reason ? (
                  <p className="text-xs font-medium text-red-800/90 bg-red-50/70 p-2 rounded-lg border border-red-100/70 line-clamp-2 mb-2">
                    {email.priority_reason}
                  </p>
                ) : (
                  <p className="text-xs text-[#4B5563] line-clamp-2 mb-2">
                    {email.summary || email.body.replace(/\n+/g, ' ')}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-white/50 flex items-center justify-between text-xs">
                {email.deadline ? (
                  <div className="flex items-center gap-1 font-semibold text-rose-700">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-[11px] truncate max-w-[140px]">{email.deadline_label || 'Action due'}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#4B5563]">Immediate reply recommended</span>
                )}

                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] group-hover:translate-x-0.5 transition-transform shrink-0">
                  Inspect <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
