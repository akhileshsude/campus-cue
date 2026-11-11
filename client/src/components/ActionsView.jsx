import React, { useState } from 'react';
import { 
  CheckSquare, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MessageSquareReply, 
  AlertCircle, 
  ExternalLink,
  Calendar,
  Sparkles,
  ArrowRight,
  MoreVertical
} from 'lucide-react';

export default function ActionsView({ 
  reminders = [], 
  onUpdateReminderStatus, 
  onSelectEmail, 
  emails = [] 
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'snoozed' | 'done'

  const now = new Date();

  // Helper to determine active status
  const getEffectiveStatus = (r) => {
    if (r.status === 'done' || r.is_completed) return 'done';
    if (r.status === 'snoozed' && r.snoozed_until && new Date(r.snoozed_until) > now) {
      return 'snoozed';
    }
    return 'pending';
  };

  const handleSelectSourceEmail = (emailId) => {
    const matched = emails.find(e => e.id === emailId);
    if (matched && onSelectEmail) {
      onSelectEmail(matched);
    }
  };

  // Filter reminders
  const filteredReminders = reminders.filter(r => {
    const status = getEffectiveStatus(r);
    if (filter === 'pending') return status === 'pending';
    if (filter === 'snoozed') return status === 'snoozed';
    if (filter === 'done') return status === 'done';
    return true;
  });

  // Group 1: Needs a reply
  const replyGroup = filteredReminders.filter(r => r.reminder_type === 'reply');

  // Group 2: Needs action
  const actionGroup = filteredReminders.filter(r => r.reminder_type !== 'reply');

  const pendingCount = reminders.filter(r => getEffectiveStatus(r) === 'pending').length;

  const renderReminderItem = (reminder) => {
    const status = getEffectiveStatus(reminder);
    const isDone = status === 'done';
    const isSnoozed = status === 'snoozed';

    return (
      <div
        key={reminder.id}
        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${
          isDone ? 'bg-cream/40 opacity-60' : isSnoozed ? 'bg-amber-50/30' : 'bg-cream-card hover:bg-cream/60'
        }`}
      >
        <div className="min-w-0 flex-1 space-y-2">
          {/* Top Line: Sender & Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink">
              {reminder.senderName || reminder.sender}
            </span>

            {isDone && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest/15 text-forest">
                Completed
              </span>
            )}

            {isSnoozed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                Snoozed until {new Date(reminder.snoozed_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}

            {status === 'pending' && (
              <span className="badge-info text-[10px] font-bold px-2 py-0.5 rounded-full">
                Pending
              </span>
            )}

            {reminder.due_date && (
              <span className="text-[11px] text-red-700 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Due {new Date(reminder.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          {/* Email Subject linked to source */}
          <div 
            onClick={() => handleSelectSourceEmail(reminder.email_id || reminder.emailId)}
            className="cursor-pointer group inline-flex items-center gap-1.5"
            title="Open original email"
          >
            <h3 className={`text-sm sm:text-base font-bold group-hover:text-forest transition-colors ${
              isDone ? 'line-through text-ink-muted' : 'text-ink'
            }`}>
              {reminder.subject}
            </h3>
            <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-forest group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* What to do or reply to */}
          <div className="p-3 bg-cream/70 rounded-xl border border-cream-border text-xs text-ink leading-relaxed">
            <span className="font-bold text-forest uppercase tracking-wider text-[10px] block mb-0.5">
              {reminder.reminder_type === 'reply' ? 'Reply Note' : 'Required Action'}:
            </span>
            <p>{reminder.reminder_note || reminder.action || reminder.reminder_text}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 pt-1">
          {/* Mark Done / Pending Toggle */}
          <button
            onClick={() => onUpdateReminderStatus && onUpdateReminderStatus(reminder.id, {
              status: isDone ? 'pending' : 'done',
              is_completed: !isDone,
            })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isDone
                ? 'bg-cream border border-cream-border text-ink-muted hover:text-ink'
                : 'bg-forest hover:bg-forest-hover text-[#F1EBDD] shadow-xs'
            }`}
          >
            {isDone ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                <span>Mark Undone</span>
              </>
            ) : (
              <>
                <Circle className="w-3.5 h-3.5" />
                <span>Mark Done</span>
              </>
            )}
          </button>

          {/* Snooze Buttons */}
          {!isDone && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateReminderStatus && onUpdateReminderStatus(reminder.id, {
                  status: 'snoozed',
                  snooze_days: 1,
                })}
                title="Snooze for 1 day"
                className="px-2 py-1 rounded-lg border border-cream-border text-[11px] font-semibold text-ink-muted hover:text-ink hover:bg-cream transition-colors"
              >
                Snooze 1d
              </button>
              <button
                onClick={() => onUpdateReminderStatus && onUpdateReminderStatus(reminder.id, {
                  status: 'snoozed',
                  snooze_days: 3,
                })}
                title="Snooze for 3 days"
                className="px-2 py-1 rounded-lg border border-cream-border text-[11px] font-semibold text-ink-muted hover:text-ink hover:bg-cream transition-colors"
              >
                Snooze 3d
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 max-w-4xl">
      {/* 1. Page Header */}
      <div className="pb-4 border-b border-cream-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Follow-up Reminders & Actions
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-1">
            Track student replies, mandatory submissions, and actionable requests.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-cream-card rounded-xl border border-cream-border text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: `Pending (${pendingCount})` },
            { id: 'snoozed', label: 'Snoozed' },
            { id: 'done', label: 'Done' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-forest text-[#F1EBDD] shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Group 1: Needs a reply */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gold/15 text-gold flex items-center justify-center">
              <MessageSquareReply className="w-4 h-4 text-gold" />
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Needs a reply
            </h2>
          </div>
          <span className="text-xs font-bold text-ink-muted">
            {replyGroup.length} item{replyGroup.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="editorial-card divide-y divide-cream-border overflow-hidden">
          {replyGroup.length === 0 ? (
            <div className="p-8 text-center text-ink-muted text-xs">
              No emails currently waiting on your reply.
            </div>
          ) : (
            replyGroup.map(renderReminderItem)
          )}
        </div>
      </div>

      {/* 3. Group 2: Needs action */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-forest/15 text-forest flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-forest" />
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-ink">
              Needs action
            </h2>
          </div>
          <span className="text-xs font-bold text-ink-muted">
            {actionGroup.length} item{actionGroup.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="editorial-card divide-y divide-cream-border overflow-hidden">
          {actionGroup.length === 0 ? (
            <div className="p-8 text-center text-ink-muted text-xs">
              No pending action tasks right now.
            </div>
          ) : (
            actionGroup.map(renderReminderItem)
          )}
        </div>
      </div>

    </div>
  );
}
