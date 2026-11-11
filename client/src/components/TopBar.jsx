import React from 'react';
import { Search, Bell, Sparkles, RefreshCw, Menu, User as UserIcon, MailPlus } from 'lucide-react';
import { useUser } from '../context/UserContext';

export default function TopBar({ 
  searchQuery, 
  setSearchQuery, 
  onRefresh, 
  isRefreshing,
  onProcessAll,
  isProcessingAll,
  onOpenIngest,
  unreadCount = 0
}) {
  const { user, initials, openSettings } = useUser();
  return (
    <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur-xs border-b border-cream-border px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Search Input */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Search emails, events, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-cream-card border border-cream-border rounded-xl text-ink placeholder:text-ink-muted/70 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Simulate / Ingest Email Button */}
        {onOpenIngest && (
          <button
            onClick={onOpenIngest}
            title="Ingest raw email & run AI pipeline"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-forest bg-cream-card hover:bg-cream border border-cream-border rounded-xl transition-all shadow-xs"
          >
            <MailPlus className="w-3.5 h-3.5 text-forest" />
            <span>+ Ingest</span>
          </button>
        )}

        {/* Run AI Pipeline Button */}
        {onProcessAll && (
          <button
            onClick={onProcessAll}
            disabled={isProcessingAll}
            title="Analyze emails with Gemini AI"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-forest hover:bg-forest-hover rounded-xl transition-all shadow-xs disabled:opacity-60"
          >
            <Sparkles className={`w-3.5 h-3.5 text-gold ${isProcessingAll ? 'animate-spin' : ''}`} />
            <span>{isProcessingAll ? 'Analyzing...' : 'Run AI Pipeline'}</span>
          </button>
        )}

        {/* Sync Button */}
        <button
          onClick={onRefresh}
          title="Refresh emails"
          className="p-2 rounded-xl border border-cream-border bg-cream-card hover:bg-cream transition-colors text-ink-muted hover:text-ink"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-forest' : ''}`} />
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button 
            title="Notifications"
            className="p-2 rounded-xl border border-cream-border bg-cream-card hover:bg-cream transition-colors text-ink-muted hover:text-ink"
          >
            <Bell className="w-4 h-4" />
          </button>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600" />
          )}
        </div>

        {/* Student Avatar */}
        <div 
          onClick={openSettings}
          title={`${user.name || 'Student'} • Settings & Profile`}
          className="w-9 h-9 rounded-full bg-forest text-cream font-serif font-bold text-sm flex items-center justify-center cursor-pointer shadow-xs border border-forest-light overflow-hidden hover:opacity-90 transition-opacity"
        >
          {user.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user.name || 'Avatar'} 
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : initials ? (
            <span>{initials}</span>
          ) : (
            <UserIcon className="w-4 h-4 text-cream" />
          )}
        </div>
      </div>
    </header>
  );
}

