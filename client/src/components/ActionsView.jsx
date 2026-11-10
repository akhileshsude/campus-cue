import React from 'react';
import { CheckSquare, CheckCircle2, Circle, Clock, MessageSquareReply } from 'lucide-react';

export default function ActionsView({ reminders = [], onToggleReminder, onSelectEmail, emails = [] }) {
  const pendingReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  const handleItemClick = (reminder) => {
    const matched = emails.find(e => e.id === reminder.emailId);
    if (matched && onSelectEmail) {
      onSelectEmail(matched);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl">
      <div className="pb-2 border-b border-cream-border flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Action Items
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Student replies, submissions, and follow-ups requiring completion.
          </p>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded-full bg-forest text-gold">
          {pendingReminders.length} Pending
        </span>
      </div>

      <div className="editorial-card divide-y divide-cream-border overflow-hidden">
        {reminders.length === 0 ? (
          <div className="p-12 text-center text-ink-muted space-y-2">
            <CheckSquare className="w-8 h-8 mx-auto text-ink-muted/50" />
            <p className="text-sm font-semibold text-ink">No actions pending</p>
            <p className="text-xs">You've responded to all follow-ups. Great work!</p>
          </div>
        ) : (
          reminders.map((reminder) => {
            const isDone = reminder.is_completed;

            return (
              <div
                key={reminder.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  isDone ? 'bg-cream/40 opacity-60' : 'bg-cream-card hover:bg-cream/60'
                }`}
              >
                <div 
                  onClick={() => handleItemClick(reminder)}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <p className={`text-sm sm:text-base font-bold ${isDone ? 'line-through text-ink-muted' : 'text-ink'}`}>
                    {reminder.action || reminder.subject}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-ink-muted">
                    <span>From: <strong className="text-ink font-medium">{reminder.sender}</strong></span>
                    {reminder.deadline && (
                      <>
                        <span>•</span>
                        <span className="text-red-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {new Date(reminder.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  <button
                    onClick={() => onToggleReminder(reminder.id, !isDone)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isDone
                        ? 'bg-cream border border-cream-border text-ink-muted hover:text-ink'
                        : 'bg-forest hover:bg-forest-hover text-[#F1EBDD] shadow-xs'
                    }`}
                  >
                    {isDone ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5" />
                        <span>Mark done</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

