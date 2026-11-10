import React, { useState } from 'react';
import { useUser, computeInitials } from '../context/UserContext';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function FirstRunModal() {
  const { user, updateUser, isFirstRunOpen, setIsFirstRunOpen } = useUser();
  const [inputName, setInputName] = useState(user.name || '');
  const [inputEmail, setInputEmail] = useState(user.email || '');

  if (!isFirstRunOpen) return null;

  const previewInitials = computeInitials(inputName, inputEmail) || 'CC';

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = inputName.trim();
    updateUser({
      name: cleanName,
      email: inputEmail.trim(),
    });
    setIsFirstRunOpen(false);
  };

  const handleSkip = () => {
    setIsFirstRunOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="editorial-card w-full max-w-md p-6 sm:p-8 bg-[#FAF6EE] border border-cream-border shadow-2xl relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative Top Accent */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-border/70 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-forest text-[#F1EBDD] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span className="font-serif font-bold text-lg text-ink">clg.inbox</span>
          </div>

          <span className="text-[11px] font-semibold text-gold tracking-wider uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Welcome
          </span>
        </div>

        {/* Avatar Live Preview */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-forest text-cream font-serif font-bold text-2xl flex items-center justify-center shadow-md border-2 border-forest-light transition-all mb-3">
            {previewInitials}
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            What should we call you?
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted mt-1.5 max-w-xs">
            Set your name to personalize your daily collegiate briefing, greeting, and smart email actions.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              autoFocus
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="e.g. Kaveri Priya"
              className="w-full px-3.5 py-2.5 text-sm bg-cream-card border border-cream-border rounded-xl text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              College Email <span className="text-ink-muted font-normal lowercase">(optional)</span>
            </label>
            <input
              type="email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              placeholder="e.g. student@university.edu"
              className="w-full px-3.5 py-2.5 text-sm bg-cream-card border border-cream-border rounded-xl text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-forest hover:bg-forest-hover text-[#F1EBDD] font-semibold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>Continue to clg.inbox</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full sm:w-auto py-2.5 px-4 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

