import React, { useState, useEffect } from 'react';
import { useUser, computeInitials, formatGreeting } from '../context/UserContext';
import { X, Check, User, Mail, Image, RotateCcw } from 'lucide-react';

export default function SettingsModal({ onResetDemo }) {
  const { user, updateUser, isSettingsOpen, closeSettings, setIsFirstRunOpen } = useUser();
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [demoResetNotice, setDemoResetNotice] = useState(false);

  // Sync internal form when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setName(user.name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatarUrl || '');
      setSavedSuccess(false);
    }
  }, [isSettingsOpen, user]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  const previewInitials = computeInitials(name, email) || 'CC';
  const previewGreeting = formatGreeting(name);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateUser({
      name: name.trim(),
      email: email.trim(),
      avatarUrl: avatarUrl.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      closeSettings();
    }, 600);
  };

  const handleReset = () => {
    updateUser({ name: '', email: '', avatarUrl: '' });
    setName('');
    setEmail('');
    setAvatarUrl('');
    closeSettings();
    setIsFirstRunOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="editorial-card w-full max-w-lg p-6 sm:p-8 bg-[#FAF6EE] border border-cream-border shadow-2xl relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-border/70 mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-ink">
              Settings & Profile
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Manage your identity and personalization preferences
            </p>
          </div>

          <button
            onClick={closeSettings}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-cream-border/40 transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Identity Preview Card */}
        <div className="mb-6 p-4 rounded-xl bg-cream border border-cream-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-forest text-cream font-serif font-bold text-lg flex items-center justify-center shrink-0 border border-forest-light overflow-hidden shadow-xs">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={name || 'Avatar'} 
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <span>{previewInitials}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gold uppercase tracking-wider">
              Dashboard Greeting Preview
            </p>
            <p className="font-serif text-lg font-bold text-ink truncate">
              {previewGreeting}
            </p>
            <p className="text-xs text-ink-muted truncate">
              {email || 'No email attached'}
            </p>
          </div>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Edit Name Field */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-forest" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              id="edit-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kaveri Priya"
              className="w-full px-3.5 py-2.5 text-sm bg-cream-card border border-cream-border rounded-xl text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Used for your morning greeting (first name only) and avatar initials.
            </p>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-forest" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. kaveri@university.edu"
              className="w-full px-3.5 py-2.5 text-sm bg-cream-card border border-cream-border rounded-xl text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
            />
          </div>

          {/* Avatar URL Field */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-forest" />
              <span>Avatar Image URL <span className="text-ink-muted font-normal lowercase">(optional)</span></span>
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 text-sm bg-cream-card border border-cream-border rounded-xl text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-all"
            />
          </div>

          {/* Step 14: Demo Showcase & Reset Controls */}
          <div className="p-3.5 rounded-xl bg-cream border border-cream-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  Showcase & Demo Data
                </p>
                <p className="text-[11px] text-ink-muted">
                  Restore default collegiate sample emails, deadlines & reminders.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (onResetDemo) {
                    setIsResettingDemo(true);
                    await onResetDemo();
                    setIsResettingDemo(false);
                    setDemoResetNotice(true);
                    setTimeout(() => setDemoResetNotice(false), 2500);
                  }
                }}
                disabled={isResettingDemo}
                className="px-3 py-1.5 bg-cream-card hover:bg-cream border border-cream-border text-ink text-xs font-semibold rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-forest ${isResettingDemo ? 'animate-spin' : ''}`} />
                <span>{isResettingDemo ? 'Resetting...' : 'Reset Demo Data'}</span>
              </button>
            </div>

            {demoResetNotice && (
              <p className="text-[11px] font-bold text-forest animate-in fade-in">
                ✓ Showcase demo data successfully reloaded.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-cream-border/70 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-red-700 transition-colors"
              title="Reset profile and trigger setup onboarding"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Profile</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeSettings}
                className="px-4 py-2 border border-cream-border bg-cream hover:bg-cream-border/40 text-ink text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-gold" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

