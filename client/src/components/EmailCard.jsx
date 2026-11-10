import React, { useState } from 'react';
import { 
  CalendarClock, 
  AlertCircle, 
  Mail, 
  CheckCircle2, 
  Reply,
  Sparkles,
  ChevronDown,
  UserCheck,
  AlertTriangle,
  Clock
} from 'lucide-react';

const CATEGORIES = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];

const categoryStyles = {
  Academics: 'bg-blue-50/80 text-blue-700 border-blue-200/60',
  Placements: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
  Clubs: 'bg-purple-50/80 text-purple-700 border-purple-200/60',
  Events: 'bg-rose-50/80 text-rose-700 border-rose-200/60',
  Announcements: 'bg-amber-50/80 text-amber-700 border-amber-200/60',
};

const priorityStyles = {
  high: { label: 'High', badge: 'bg-red-50/80 text-red-700 border-red-200/60' },
  medium: { label: 'Medium', badge: 'bg-amber-50/80 text-amber-700 border-amber-200/60' },
  low: { label: 'Low', badge: 'bg-slate-100/80 text-slate-600 border-slate-200/60' },
};

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffInHours = Math.round((new Date() - date) / (1000 * 60 * 60));
  if (diffInHours < 1) return 'Just now';
  if (diffInHours === 1) return '1h ago';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.round(diffInHours / 24);
  return diffInDays === 1 ? '1d ago' : `${diffInDays}d ago`;
}

export default function EmailCard({ email, onClick, onToggleRead, onUpdateCategory }) {
  const [isChangingCategory, setIsChangingCategory] = useState(false);

  const effectiveCategory = email.user_category || email.category;
  const isUserCorrected = Boolean(email.user_category);
  const catClass = categoryStyles[effectiveCategory] || 'bg-slate-50/80 text-slate-700 border-slate-200/60';
  
  const normPriority = (email.priority || 'medium').toLowerCase();
  const priorityInfo = priorityStyles[normPriority] || priorityStyles.medium;

  const isDeadlineUncertain = email.deadline_confidence === 'uncertain';

  return (
    <div
      onClick={() => onClick && onClick(email)}
      className={`group relative rounded-2xl glass p-4 sm:p-5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:bg-white/70 ${
        !email.is_read
          ? 'bg-white/60 border-white/80 ring-1 ring-[#4F46E5]/20 shadow-[0_8px_32px_rgba(31,41,55,0.09)]'
          : 'bg-white/45 border-white/60'
      }`}
    >
      {/* Top Header: Sender & Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {!email.is_read ? (
            <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5] shrink-0 shadow-xs" title="Unread" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 shrink-0" title="Read" />
          )}

          <div className="min-w-0">
            <span className={`text-xs sm:text-sm truncate block ${!email.is_read ? 'font-bold text-[#1F2937]' : 'font-medium text-[#4B5563]'}`}>
              {email.senderName || email.sender.split('<')[0].trim()}
            </span>
            <span className="text-[11px] text-[#4B5563] block truncate">
              {email.sender}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {email.ai_processed && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50/80 text-indigo-700 border border-indigo-200/50" title="Analyzed with Gemini AI">
              <Sparkles className="h-3 w-3 text-[#4F46E5]" /> AI Ready
            </span>
          )}
          <span className="text-[11px] font-medium text-[#4B5563]">
            {formatRelativeTime(email.received_at)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleRead && onToggleRead(email.id, !email.is_read);
            }}
            title={email.is_read ? "Mark as unread" : "Mark as read"}
            className="p-1 rounded-lg text-[#4B5563] hover:text-[#4F46E5] hover:bg-white/70 transition-colors"
          >
            {email.is_read ? <Mail className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-[#4F46E5]" />}
          </button>
        </div>
      </div>

      {/* Subject Line */}
      <h4 className={`mt-2.5 text-sm sm:text-base tracking-tight leading-snug line-clamp-1 group-hover:text-[#4F46E5] transition-colors ${
        !email.is_read ? 'font-bold text-[#1F2937]' : 'font-semibold text-[#1F2937]'
      }`}>
        {email.subject}
      </h4>

      {/* AI Summary / Body Snippet */}
      <p className="mt-1 text-xs sm:text-sm text-[#4B5563] line-clamp-2 leading-relaxed">
        {email.summary || email.body.replace(/\n+/g, ' ')}
      </p>

      {/* Priority Reason Banner if available */}
      {email.priority_reason && (
        <div className="mt-2 text-[11px] text-[#4B5563] font-medium flex items-center gap-1.5 bg-white/40 px-2.5 py-1 rounded-lg border border-white/50">
          <span className={`h-1.5 w-1.5 rounded-full ${normPriority === 'high' ? 'bg-red-500' : normPriority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
          <span className="truncate">{email.priority_reason}</span>
        </div>
      )}

      {/* Tags, Category Dropdown, and Deadlines */}
      <div className="mt-3.5 pt-3 border-t border-white/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          
          {/* Category Pill with interactive Correction Dropdown */}
          <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsChangingCategory(!isChangingCategory)}
              title="Click to correct category"
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${catClass} hover:bg-white/80 transition-all`}
            >
              <span>{effectiveCategory}</span>
              {isUserCorrected && (
                <span className="text-[9px] bg-white/70 px-1 rounded font-bold text-[#4B5563]" title="User adjusted">
                  User
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {isChangingCategory && (
              <div className="absolute left-0 mt-1 z-30 w-40 glass-opaque rounded-xl py-1 text-xs shadow-lg border border-white/70 animate-in fade-in">
                <div className="px-2.5 py-1 text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">
                  Correct Category:
                </div>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      onUpdateCategory && onUpdateCategory(email.id, cat);
                      setIsChangingCategory(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/80 flex items-center justify-between transition-colors ${
                      cat === effectiveCategory ? 'font-bold text-[#4F46E5] bg-white/60' : 'text-[#1F2937]'
                    }`}
                  >
                    <span>{cat}</span>
                    {cat === effectiveCategory && <CheckCircle2 className="h-3 w-3 text-[#4F46E5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority Badge (Pastel) */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${priorityInfo.badge}`}>
            {priorityInfo.label} Priority
          </span>

          {/* Follow-up Required Pill */}
          {email.needs_followup && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
              <Reply className="h-3 w-3" /> Needs Reply
            </span>
          )}
        </div>

        {/* Deadline Status Badge */}
        {email.deadline && (
          <div className="flex items-center gap-1.5">
            {isDeadlineUncertain ? (
              <div 
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-md border border-dashed border-amber-300/80"
                title="Uncertain date: not counted in upcoming deadline alerts"
              >
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span>⚠️ Unconfirmed</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50/80 px-2 py-0.5 rounded-md border border-rose-200/60">
                <CalendarClock className="h-3 w-3" />
                <span>{email.deadline_label || 'Confirmed Deadline'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
