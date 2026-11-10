import React from 'react';
import { Mail, Inbox, AlertTriangle, CalendarClock } from 'lucide-react';

export default function OverviewCards({ stats, onCardClick, activeFilter }) {
  const cards = [
    {
      id: 'all',
      title: 'Total Emails',
      count: stats.total,
      subtitle: 'Indexed across categories',
      icon: Inbox,
      badgeClass: 'bg-indigo-50/80 text-indigo-700 border-indigo-200/60',
      iconBg: 'bg-indigo-50/80 text-indigo-700 border border-indigo-200/50',
    },
    {
      id: 'unread',
      title: 'Unread',
      count: stats.unread,
      subtitle: 'Require review or action',
      icon: Mail,
      badgeClass: 'bg-blue-50/80 text-blue-700 border-blue-200/60',
      iconBg: 'bg-blue-50/80 text-blue-700 border border-blue-200/50',
    },
    {
      id: 'priority',
      title: 'High Priority',
      count: stats.highPriority,
      subtitle: 'Urgent attention flagged',
      icon: AlertTriangle,
      badgeClass: 'bg-red-50/80 text-red-700 border-red-200/60',
      iconBg: 'bg-red-50/80 text-red-700 border border-red-200/50',
    },
    {
      id: 'deadlines',
      title: 'Upcoming Deadlines',
      count: stats.deadlines,
      subtitle: stats.uncertainDeadlines > 0 ? `Confirmed (${stats.uncertainDeadlines} tentative excluded)` : 'Confirmed dates scheduled',
      icon: CalendarClock,
      badgeClass: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
      iconBg: 'bg-emerald-50/80 text-emerald-700 border border-emerald-200/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isActive = activeFilter === card.id;

        return (
          <div
            key={card.id}
            onClick={() => onCardClick && onCardClick(card.id)}
            className={`cursor-pointer group relative overflow-hidden rounded-2xl glass p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70 ${
              isActive 
                ? 'ring-2 ring-[#4F46E5] border-white/80 bg-white/75 shadow-md' 
                : 'hover:shadow-[0_12px_36px_rgba(31,41,55,0.1)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`h-8 w-8 rounded-xl ${card.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
                <IconComponent className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1F2937]">
                {card.count}
              </span>
            </div>

            <p className="mt-1 text-[11px] sm:text-xs text-[#4B5563] font-medium truncate">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
