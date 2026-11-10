import React from 'react';
import { CheckCircle2, Circle, Clock, MessageSquareReply, AlertCircle } from 'lucide-react';

export default function ReminderList({ reminders = [], onToggleReminder, onSelectEmail }) {
  const pendingReminders = reminders.filter((r) => !r.is_completed);
  const completedReminders = reminders.filter((r) => r.is_completed);

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between pb-3.5 border-b border-white/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shadow-xs">
            <MessageSquareReply className="h-4 w-4 text-[#4F46E5]" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#1F2937] leading-tight">
              Follow-up Reminders
            </h3>
            <span className="text-[11px] text-[#4B5563]">
              Emails requiring your response or submission
            </span>
          </div>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
          {pendingReminders.length} pending
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {reminders.length === 0 ? (
          <div className="text-center py-6 text-[#4B5563] text-xs">
            No follow-ups pending. Great job staying on top of your inbox!
          </div>
        ) : (
          reminders.map((reminder) => {
            const isDone = reminder.is_completed;

            return (
              <div
                key={reminder.id}
                className={`group flex items-start justify-between gap-3 p-3 transition-all duration-200 ${
                  isDone
                    ? 'glass-nested opacity-50 bg-white/20'
                    : 'glass-nested'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-xs font-bold ${isDone ? 'line-through text-[#4B5563]' : 'text-[#1F2937]'}`}>
                      {reminder.action || reminder.subject}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#4B5563]">
                    <span className="font-medium text-[#4B5563]">From: {reminder.sender}</span>
                    {reminder.deadline && (
                      <>
                        <span>•</span>
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due {new Date(reminder.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 pt-0.5">
                  <button
                    onClick={() => onToggleReminder(reminder.id, !isDone)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-200 shadow-xs active:scale-95 ${
                      isDone
                        ? 'bg-white/60 text-[#4B5563] hover:bg-white/90 border border-white/60'
                        : 'bg-[#4F46E5] text-white hover:bg-[#4338CA] border border-transparent'
                    }`}
                  >
                    {isDone ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Completed</span>
                      </>
                    ) : (
                      <>
                        <Circle className="h-3.5 w-3.5" />
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
