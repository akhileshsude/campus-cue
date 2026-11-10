import React, { useState } from 'react';
import { 
  X, 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Circle,
  Mail, 
  User, 
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Tag,
  ShieldAlert
} from 'lucide-react';

const CATEGORIES = ['Academics', 'Placements', 'Clubs', 'Events', 'Announcements'];

const categoryStyles = {
  Academics: 'bg-blue-50/80 text-blue-700 border-blue-200/60',
  Placements: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
  Clubs: 'bg-purple-50/80 text-purple-700 border-purple-200/60',
  Events: 'bg-rose-50/80 text-rose-700 border-rose-200/60',
  Announcements: 'bg-amber-50/80 text-amber-700 border-amber-200/60',
};

const priorityBadges = {
  high: { label: 'High Priority', class: 'bg-red-50/80 text-red-700 border-red-200/60' },
  medium: { label: 'Medium Priority', class: 'bg-amber-50/80 text-amber-700 border-amber-200/60' },
  low: { label: 'Low Priority', class: 'bg-slate-100/80 text-slate-600 border-slate-200/60' },
};

export default function EmailModal({ 
  email, 
  onClose, 
  onToggleRead, 
  onUpdateCategory, 
  onProcessEmail, 
  isProcessing 
}) {
  const [actionDone, setActionDone] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  if (!email) return null;

  const effectiveCategory = email.user_category || email.category;
  const isUserCorrected = Boolean(email.user_category);
  const normPriority = (email.priority || 'medium').toLowerCase();
  const priorityInfo = priorityBadges[normPriority] || priorityBadges.medium;
  const isDeadlineUncertain = email.deadline_confidence === 'uncertain';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl glass-opaque rounded-2xl overflow-hidden flex flex-col max-h-[92vh] border border-white/70 shadow-[0_16px_40px_rgba(31,41,55,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-white/50 flex items-center justify-between bg-white/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#4F46E5] text-white shadow-xs">
              Campus Cue Reader
            </span>
            <span className="text-xs text-[#4B5563] hidden sm:inline">•</span>
            <span className="text-xs text-[#4B5563] hidden sm:inline">
              Student Inbox Intelligence
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#4B5563] hover:text-[#1F2937] hover:bg-white/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Main Content: Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* ========================================================= */}
          {/* LEFT COLUMN: Original Email (High Readability) */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-white/50 flex flex-col justify-between bg-white/30">
            <div>
              {/* Email Subject */}
              <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] leading-snug">
                {email.subject}
              </h2>

              {/* Sender Details & Timestamp */}
              <div className="mt-3.5 pb-4 border-b border-white/50 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/60 text-[#1F2937] flex items-center justify-center font-bold text-sm border border-white/70 shadow-xs shrink-0">
                    {(email.senderName || email.sender)[0]}
                  </div>
                  <div>
                    <p className="font-bold text-[#1F2937] text-sm">{email.senderName || email.sender.split('<')[0]}</p>
                    <p className="text-[#4B5563] text-xs">{email.sender}</p>
                  </div>
                </div>

                <div className="text-right text-[#4B5563]">
                  <div className="flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(email.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              {/* Original Raw Email Body */}
              <div className="mt-5 text-sm text-[#1F2937] leading-relaxed whitespace-pre-line space-y-2 font-normal">
                {email.body}
              </div>
            </div>

            {/* Left Footer Action */}
            <div className="mt-8 pt-4 border-t border-white/50 flex items-center justify-between">
              <button
                onClick={() => onToggleRead && onToggleRead(email.id, !email.is_read)}
                className="glass-nested inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] hover:bg-white/90 transition-colors shadow-xs"
              >
                {email.is_read ? <Mail className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-[#4F46E5]" />}
                <span>{email.is_read ? 'Mark as Unread' : 'Mark as Read'}</span>
              </button>

              <span className="text-[11px] text-[#4B5563] font-medium">
                Original Message
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: AI Summary & Structured Intelligence */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 p-6 bg-white/40 overflow-y-auto flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              
              {/* AI Badge & Reprocess button */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
                  <Sparkles className="h-3.5 w-3.5 text-[#4F46E5]" /> AI-generated
                </span>

                {onProcessEmail && (
                  <button
                    onClick={() => onProcessEmail(email.id)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4B5563] hover:text-[#4F46E5] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isProcessing ? 'animate-spin text-[#4F46E5]' : ''}`} />
                    <span>{isProcessing ? 'Analyzing...' : 'Re-analyze with AI'}</span>
                  </button>
                )}
              </div>

              {/* 2-3 Sentence AI Summary */}
              <div className="p-4 glass-nested bg-white/60">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563] block mb-1.5">
                  Executive Summary
                </span>
                <p className="text-xs sm:text-sm text-[#1F2937] leading-relaxed">
                  {email.summary || 'Summary is being generated by Campus Cue AI processor...'}
                </p>
              </div>

              {/* Key Details Grid */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563] block">
                  Key Details
                </span>

                {/* Category with Correction Dropdown */}
                <div className="p-3 glass-nested flex items-center justify-between bg-white/50">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-[#4B5563]" />
                    <div>
                      <span className="text-xs text-[#4B5563] block font-medium">Category</span>
                      <span className="text-xs font-bold text-[#1F2937]">
                        {effectiveCategory} {isUserCorrected && '(User override)'}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-white/70 bg-white/60 hover:bg-white text-[#4B5563] flex items-center gap-1 transition-colors"
                    >
                      <span>Correct</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>

                    {categoryDropdownOpen && (
                      <div className="absolute right-0 mt-1 z-30 w-36 glass-opaque rounded-xl py-1 text-xs shadow-lg border border-white/70 animate-in fade-in">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              onUpdateCategory && onUpdateCategory(email.id, cat);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/80 transition-colors ${
                              cat === effectiveCategory ? 'font-bold text-[#4F46E5] bg-white/50' : 'text-[#1F2937]'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Priority & Reason */}
                <div className="p-3 glass-nested bg-white/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#4B5563] font-medium">Priority</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${priorityInfo.class}`}>
                      {priorityInfo.label}
                    </span>
                  </div>
                  {email.priority_reason && (
                    <p className="text-xs text-[#4B5563] font-medium mt-1">
                      {email.priority_reason}
                    </p>
                  )}
                </div>

                {/* Deadline & Confidence Indicator */}
                {email.deadline && (
                  <div className={`p-3 rounded-xl border ${isDeadlineUncertain ? 'bg-amber-50/70 border-dashed border-amber-300/80' : 'glass-nested bg-white/50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#4B5563]">Deadline</span>
                      {isDeadlineUncertain ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Unconfirmed
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Confirmed
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-xs font-bold ${isDeadlineUncertain ? 'text-amber-900' : 'text-[#1F2937]'}`}>
                      {email.deadline_label || 'Submission Deadline'}: {new Date(email.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>

                    {isDeadlineUncertain && (
                      <p className="text-[11px] text-amber-800 mt-1">
                        ⚠️ Date is tentative or vague in the email. Not counted toward upcoming deadline alerts.
                      </p>
                    )}
                  </div>
                )}

              </div>

              {/* Required Action Checklist */}
              {email.required_action && (
                <div className="p-4 rounded-xl border border-indigo-200/60 bg-indigo-50/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block mb-2">
                    Required Action Checklist
                  </span>

                  <label 
                    onClick={() => setActionDone(!actionDone)}
                    className="flex items-start gap-2.5 cursor-pointer text-xs text-[#1F2937] font-medium hover:text-[#4F46E5] transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={actionDone}
                      onChange={() => setActionDone(!actionDone)}
                      className="mt-0.5 h-4 w-4 rounded border-white/80 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <span className={actionDone ? 'line-through text-[#4B5563]' : ''}>
                      {email.required_action}
                    </span>
                  </label>
                </div>
              )}

            </div>

            {/* Right Footer */}
            <div className="pt-3 border-t border-white/50 flex items-center justify-between text-xs text-[#4B5563]">
              <span>Powered by Gemini 2.5</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors shadow-xs"
              >
                Close
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
