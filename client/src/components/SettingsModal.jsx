import React, { useState, useEffect } from 'react';
import { useUser, computeInitials, formatGreeting } from '../context/UserContext';
import { apiFetch } from '../utils/api';
import { X, Check, User, Mail, Image, RotateCcw, Trash2, Activity, KeyRound, Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-react';

export default function SettingsModal({ onResetDemo, onClearDemo, onReprocessBasic, healthStatus = null, onHealthUpdated }) {
  const { user, updateUser, isSettingsOpen, closeSettings, setIsFirstRunOpen } = useUser();
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [isReprocessingBasic, setIsReprocessingBasic] = useState(false);
  const [demoNoticeText, setDemoNoticeText] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isSavingAiKey, setIsSavingAiKey] = useState(false);
  const [aiKeyNotice, setAiKeyNotice] = useState(null);

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

  const handleSaveGeminiKey = async () => {
    setIsSavingAiKey(true);
    setAiKeyNotice(null);
    try {
      const res = await apiFetch('/api/settings/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiKeyNotice({ type: 'error', text: data.error || 'Could not save Gemini API key.' });
      } else {
        setGeminiKeyInput('');
        setAiKeyNotice({ type: 'success', text: data.message });
        if (onHealthUpdated) {
          await onHealthUpdated();
        }
      }
    } catch (err) {
      setAiKeyNotice({ type: 'error', text: err.message || 'Could not reach backend server.' });
    } finally {
      setIsSavingAiKey(false);
    }
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
            <label className="text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
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
            <label className="text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
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
            <label className="text-xs font-bold text-ink uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
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

          {/* Live System Diagnostics & Inbox Mode Controls */}
          <div className="p-3.5 rounded-xl bg-cream border border-cream-border space-y-3">
            {healthStatus && (
              <div className="space-y-1.5 pb-2.5 border-b border-cream-border/70">
                <p className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-forest" />
                  <span>Runtime Status</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-ink-muted">
                  <span>
                    AI Mode:{' '}
                    <strong className={healthStatus.aiMode === 'live' ? 'text-forest' : 'text-amber-700'}>
                      {healthStatus.aiMode === 'live' ? 'Live (AI Active)' : 'Offline (Basic Analysis)'}
                    </strong>
                  </span>
                  <span>
                    Model: <strong className="text-ink font-mono">{healthStatus.model || healthStatus.aiModel || 'gemini-3.5-flash-lite'}</strong>
                  </span>
                  <span>
                    Storage: <strong className="text-ink">{healthStatus.supabaseConnected ? 'Supabase DB' : 'Local Persistent Disk'}</strong>
                  </span>
                  <span>
                    Mode: <strong className="text-ink">{healthStatus.dataMode === 'live' ? 'Live Real Inbox' : 'Showcase Demo'}</strong>
                  </span>
                </div>
                {healthStatus.aiMode !== 'live' && healthStatus.aiError && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
                    Last AI Error: {healthStatus.aiError}
                  </p>
                )}
              </div>
            )}

            {/* Inline Gemini API Key Configuration */}
            <div className="pb-2.5 border-b border-cream-border/70 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-forest" />
                  <span>Gemini AI Key</span>
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  healthStatus?.aiMode === 'live'
                    ? 'bg-forest/15 text-forest'
                    : 'bg-amber-100 border border-amber-300 text-amber-800'
                }`}>
                  {healthStatus?.aiMode === 'live'
                    ? `Live · ${healthStatus.model || 'gemini-3.5-flash-lite'}`
                    : 'Offline · Basic analysis'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder={
                      healthStatus?.aiMode === 'live'
                        ? 'Key live — paste new key to replace'
                        : 'Paste free Google AI Studio key'
                    }
                    className="w-full pl-3 pr-9 py-2 text-xs bg-cream-card border border-cream-border rounded-lg text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-forest font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    title={showGeminiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGeminiKey}
                  disabled={isSavingAiKey || (!geminiKeyInput.trim() && !healthStatus?.geminiConfigured)}
                  className="px-3 py-2 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {isSavingAiKey ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-gold" />
                  )}
                  <span>
                    {isSavingAiKey
                      ? 'Testing...'
                      : geminiKeyInput.trim()
                      ? 'Activate Gemini'
                      : 'Switch to Offline'}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-ink-muted">
                  Saved locally to <code className="bg-cream-card px-1 rounded border border-cream-border">server/.env</code> and verified live.
                </p>

                {onReprocessBasic && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsReprocessingBasic(true);
                      setAiKeyNotice(null);
                      try {
                        const resultMsg = await onReprocessBasic();
                        setAiKeyNotice({ type: 'success', text: resultMsg || 'Reprocessed basic-analysis emails.' });
                      } catch (err) {
                        setAiKeyNotice({ type: 'error', text: err.message || 'Failed to reprocess basic emails.' });
                      } finally {
                        setIsReprocessingBasic(false);
                      }
                    }}
                    disabled={isReprocessingBasic}
                    className="text-[11px] font-bold text-forest hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isReprocessingBasic ? 'animate-spin' : ''}`} />
                    <span>{isReprocessingBasic ? 'Reprocessing...' : 'Reprocess all basic-analysis emails'}</span>
                  </button>
                )}
              </div>

              {aiKeyNotice && (
                <p className={`text-[11px] font-semibold ${
                  aiKeyNotice.type === 'error' ? 'text-red-700' : 'text-forest'
                }`}>
                  {aiKeyNotice.text}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  Inbox Data Controls
                </p>
                <p className="text-[11px] text-ink-muted">
                  Clear sample showcase items for a real inbox, or reload demo data.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {onClearDemo && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsResettingDemo(true);
                      await onClearDemo();
                      setIsResettingDemo(false);
                      setDemoNoticeText('Sample data cleared. Live Inbox Mode active.');
                      setTimeout(() => setDemoNoticeText(''), 2500);
                    }}
                    disabled={isResettingDemo}
                    className="px-2.5 py-1.5 bg-cream-card hover:bg-cream border border-cream-border text-ink text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-ink-muted" />
                    <span>Clear Samples</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    if (onResetDemo) {
                      setIsResettingDemo(true);
                      await onResetDemo();
                      setIsResettingDemo(false);
                      setDemoNoticeText('Showcase demo data reloaded.');
                      setTimeout(() => setDemoNoticeText(''), 2500);
                    }
                  }}
                  disabled={isResettingDemo}
                  className="px-2.5 py-1.5 bg-cream-card hover:bg-cream border border-cream-border text-ink text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-forest ${isResettingDemo ? 'animate-spin' : ''}`} />
                  <span>{isResettingDemo ? 'Working...' : 'Reset Demo'}</span>
                </button>
              </div>
            </div>

            {demoNoticeText && (
              <p className="text-[11px] font-bold text-forest animate-in fade-in">
                ✓ {demoNoticeText}
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

