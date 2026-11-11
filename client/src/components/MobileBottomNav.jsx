import React from 'react';
import { Home, Inbox, Calendar, CheckSquare, BookOpen } from 'lucide-react';

export default function MobileBottomNav({ currentView, setCurrentView, unreadCount = 0 }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'digest', label: 'Digest', icon: BookOpen },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount },
    { id: 'deadlines', label: 'Deadlines', icon: Calendar },
    { id: 'actions', label: 'Actions', icon: CheckSquare },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-forest text-[#F1EBDD] border-t border-forest-light px-4 py-2 flex items-center justify-around md:hidden shadow-lg select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setCurrentView(tab.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-xs font-medium transition-colors relative ${
              isActive ? 'text-gold' : 'text-[#F1EBDD]/60 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{tab.label}</span>

            {tab.count > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-gold" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

