import React from 'react';
import { Mail, Search, Sparkles, RefreshCw, Bell, Wand2 } from 'lucide-react';

export default function Navbar({ 
  onRefresh, 
  isRefreshing, 
  searchQuery, 
  setSearchQuery,
  onProcessAll,
  isProcessingAll
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/50 backdrop-blur-md sm:backdrop-blur-xl border-b border-white/60 shadow-[0_8px_32px_rgba(31,41,55,0.06)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-[#4F46E5]/20">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-[#1F2937]">
                  Campus <span className="text-[#4F46E5]">Cue</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50/80 text-indigo-700 border border-indigo-200/50">
                  <Sparkles className="h-3 w-3 mr-1 text-[#4F46E5]" /> AI Core
                </span>
              </div>
              <p className="hidden md:block text-[11px] font-medium text-[#4B5563]">
                Student Inbox & Academic Deadlines
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4B5563]" />
              <input
                type="text"
                placeholder="Search subject, sender, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white/40 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:bg-white/80 transition-all placeholder:text-[#4B5563]/70 text-[#1F2937]"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Process All with Gemini AI */}
            {onProcessAll && (
              <button
                onClick={onProcessAll}
                disabled={isProcessingAll}
                title="Run Gemini AI classification, deadline extraction & summary on all emails"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-60"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isProcessingAll ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {isProcessingAll ? 'Analyzing...' : 'Run AI Pipeline'}
                </span>
              </button>
            )}

            {/* Sync */}
            <button
              onClick={onRefresh}
              title="Sync with backend"
              className="glass-nested inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] hover:bg-white/80 transition-all shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#4B5563] ${isRefreshing ? 'animate-spin text-[#4F46E5]' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <div className="h-6 w-px bg-white/60 mx-1 hidden sm:block" />

            {/* Student Avatar / Profile */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#A5B4FC] to-[#818CF8] text-white font-bold text-xs flex items-center justify-center shadow-xs border border-white/60">
                SK
              </div>
              <div className="hidden lg:block text-left text-xs">
                <p className="font-bold text-[#1F2937] leading-tight">Student Portal</p>
                <p className="text-[11px] text-[#4B5563]">CS & AI Major • Year 3</p>
              </div>
            </div>
          </div>

        </div>

        {/* Mobile Search Bar */}
        <div className="pb-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4B5563]" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/50 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:bg-white/80 transition-all text-[#1F2937]"
            />
          </div>
        </div>

      </div>
    </header>
  );
}
