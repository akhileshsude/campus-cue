import React from 'react';
import { 
  Home, 
  Inbox, 
  Calendar, 
  CheckSquare, 
  Settings, 
  Sparkles,
  ExternalLink,
  Layers
} from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function Sidebar({ 
  currentView, 
  setCurrentView, 
  unreadCount = 0, 
  deadlinesCount = 0,
  remindersCount = 0 
}) {
  const { openSettings } = useUser();
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: unreadCount },
    { id: 'deadlines', label: 'Deadlines', icon: Calendar, count: deadlinesCount },
    { id: 'actions', label: 'Actions', icon: CheckSquare, count: remindersCount },
  ];

  return (
    <aside className="w-60 bg-forest text-[#F1EBDD] flex-col justify-between shrink-0 hidden md:flex border-r border-forest-light min-h-screen p-5 select-none">
      <div>
        {/* Brand / Logo */}
        <div 
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-2.5 cursor-pointer pb-8 pt-1 group"
        >
          {/* Origami Envelope Icon Mark */}
          <div className="w-7 h-7 flex items-center justify-center text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span className="font-serif font-bold text-2xl tracking-tight text-white group-hover:text-gold transition-colors">
            clg.inbox
          </span>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-forest-light text-white shadow-xs'
                    : 'text-[#F1EBDD]/70 hover:text-white hover:bg-forest-light/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-gold' : 'text-[#F1EBDD]/70'}`} />
                  <span>{item.label}</span>
                </div>

                {item.count > 0 && (
                  <span className={`text-[11px] px-2 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-forest text-gold' : 'bg-forest-light text-[#F1EBDD]/80'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation: Settings & Public Landing Toggle */}
      <div className="pt-6 border-t border-forest-light/60 space-y-1">
        <button
          onClick={() => setCurrentView('landing')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-[#F1EBDD]/60 hover:text-white hover:bg-forest-light/30 transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gold/80" />
          <span>Public Landing Page</span>
        </button>

        <button
          onClick={openSettings}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm text-[#F1EBDD]/70 hover:text-white hover:bg-forest-light/30 transition-colors"
        >
          <Settings className="w-4 h-4 text-[#F1EBDD]/60" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

