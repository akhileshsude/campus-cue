import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LandingPage from './components/LandingPage';
import HomeView from './components/HomeView';
import InboxView from './components/InboxView';
import DeadlinesView from './components/DeadlinesView';
import ActionsView from './components/ActionsView';
import DigestView from './components/DigestView';
import EmailDetailView from './components/EmailDetailView';
import MobileBottomNav from './components/MobileBottomNav';
import FirstRunModal from './components/FirstRunModal';
import SettingsModal from './components/SettingsModal';
import IngestModal from './components/IngestModal';
import { RefreshCw, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [emails, setEmails] = useState([]);
  const [digest, setDigest] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isProcessingSingle, setIsProcessingSingle] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isRegeneratingDigest, setIsRegeneratingDigest] = useState(false);

  // App Navigation: 'home' | 'digest' | 'inbox' | 'deadlines' | 'actions' | 'detail' | 'landing'
  const [currentView, setCurrentView] = useState('home');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch initial data from backend API
  const fetchData = async () => {
    try {
      setError(null);
      
      const [emailsRes, digestRes, remindersRes] = await Promise.all([
        fetch(`${API_BASE}/api/emails`),
        fetch(`${API_BASE}/api/digest`),
        fetch(`${API_BASE}/api/reminders`)
      ]);

      if (!emailsRes.ok) throw new Error(`Emails API error: ${emailsRes.status}`);
      
      const emailsData = await emailsRes.json();
      setEmails(emailsData.emails || []);

      if (digestRes.ok) {
        const digestData = await digestRes.json();
        setDigest(digestData.digest || null);
      }

      if (remindersRes.ok) {
        const remindersData = await remindersRes.json();
        setReminders(remindersData.reminders || []);
      }
    } catch (err) {
      console.error('Failed to fetch data from backend:', err);
      setError(err.message || 'Could not connect to Campus Cue API.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Select an email and view detail
  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setCurrentView('detail');
    // Mark as read
    if (!email.is_read) {
      handleToggleRead(email.id, true);
    }
  };

  // Select an email by its ID (used by Digest links & Action links)
  const handleSelectEmailById = (emailId) => {
    const found = emails.find(e => e.id === emailId);
    if (found) {
      handleSelectEmail(found);
    } else {
      fetch(`${API_BASE}/api/emails`)
        .then(r => r.ok && r.json())
        .then(data => {
          if (data.emails) {
            setEmails(data.emails);
            const m = data.emails.find(e => e.id === emailId);
            if (m) handleSelectEmail(m);
          }
        });
    }
  };

  // Step 8: Dynamic Academic Digest Regeneration
  const handleRegenerateDigest = async () => {
    setIsRegeneratingDigest(true);
    try {
      const res = await fetch(`${API_BASE}/api/digest/generate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.digest) {
          setDigest(data.digest);
        }
      }
    } catch (err) {
      console.error('Failed to regenerate digest:', err);
    } finally {
      setIsRegeneratingDigest(false);
    }
  };

  // Step 9: Follow-up Reminders Status & Snooze
  const handleUpdateReminderStatus = async (id, updates) => {
    setReminders(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        if (updates.status === 'snoozed') {
          const days = parseInt(updates.snooze_days, 10) || 1;
          const snoozeDate = new Date();
          snoozeDate.setDate(snoozeDate.getDate() + days);
          updated.snoozed_until = snoozeDate.toISOString();
        } else if (updates.status === 'pending' || updates.status === 'done') {
          updated.snoozed_until = null;
        }
        return updated;
      })
    );

    try {
      await fetch(`${API_BASE}/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to update reminder status:', err);
    }
  };

  // Step 10: Ingestion Handlers (Manual Paste, .eml upload, Gmail sync)
  const handleIngestEmail = async (rawEmail) => {
    setIsIngesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/emails/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rawEmail,
          save_as_new: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setEmails(prev => [data.email, ...prev]);
          setSelectedEmail(data.email);
          setCurrentView('detail');
          setIsIngestModalOpen(false);
          fetch(`${API_BASE}/api/reminders`).then(r => r.ok && r.json()).then(d => d?.reminders && setReminders(d.reminders));
          fetch(`${API_BASE}/api/digest`).then(r => r.ok && r.json()).then(d => d?.digest && setDigest(d.digest));
        }
      }
    } catch (err) {
      console.error('Failed to ingest email:', err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleEmlUploaded = (newEmails = []) => {
    if (newEmails.length > 0) {
      setEmails(prev => [...newEmails, ...prev]);
      setCurrentView('inbox');
      setIsIngestModalOpen(false);
      fetch(`${API_BASE}/api/reminders`).then(r => r.ok && r.json()).then(d => d?.reminders && setReminders(d.reminders));
      fetch(`${API_BASE}/api/digest`).then(r => r.ok && r.json()).then(d => d?.digest && setDigest(d.digest));
    }
  };

  const handleGmailSynced = (newEmails = []) => {
    if (newEmails.length > 0) {
      setEmails(prev => [...newEmails, ...prev]);
      setIsIngestModalOpen(false);
      fetch(`${API_BASE}/api/reminders`).then(r => r.ok && r.json()).then(d => d?.reminders && setReminders(d.reminders));
      fetch(`${API_BASE}/api/digest`).then(r => r.ok && r.json()).then(d => d?.digest && setDigest(d.digest));
    }
  };

  // Step 13: Student Correction Override Handler (Category, Priority, Deadline)
  const handleOverrideEmail = async (emailId, overrides) => {
    setEmails(prev =>
      prev.map(e => {
        if (e.id !== emailId) return e;
        return {
          ...e,
          ...(overrides.category !== undefined ? { user_category: overrides.category } : {}),
          ...(overrides.priority !== undefined ? { user_priority: overrides.priority } : {}),
          ...(overrides.deadline !== undefined ? { user_deadline: overrides.deadline } : {}),
          edited_by_user: true,
        };
      })
    );

    if (selectedEmail && selectedEmail.id === emailId) {
      setSelectedEmail(prev => ({
        ...prev,
        ...(overrides.category !== undefined ? { user_category: overrides.category } : {}),
        ...(overrides.priority !== undefined ? { user_priority: overrides.priority } : {}),
        ...(overrides.deadline !== undefined ? { user_deadline: overrides.deadline } : {}),
        edited_by_user: true,
      }));
    }

    try {
      const res = await fetch(`${API_BASE}/api/emails/${emailId}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setEmails(prev => prev.map(e => (e.id === emailId ? { ...e, ...data.email } : e)));
          if (selectedEmail && selectedEmail.id === emailId) {
            setSelectedEmail(prev => ({ ...prev, ...data.email }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to override email:', err);
    }
  };

  // Step 11: Single Email Reprocess on manual click
  const handleReprocessEmail = async (emailId) => {
    setIsProcessingSingle(true);
    try {
      const res = await fetch(`${API_BASE}/api/emails/${emailId}/reprocess`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setEmails(prev => prev.map(e => (e.id === emailId ? data.email : e)));
          if (selectedEmail && selectedEmail.id === emailId) {
            setSelectedEmail(data.email);
          }
        }
      }
    } catch (err) {
      console.error('Failed to reprocess email:', err);
    } finally {
      setIsProcessingSingle(false);
    }
  };

  // Step 14: Reset Demo Data
  const handleResetDemo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reset-demo`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  // Update Category Override (backward-compatible)
  const handleUpdateCategory = async (emailId, newCategory) => {
    await handleOverrideEmail(emailId, { category: newCategory });
  };

  // Process all emails with Gemini AI batch pipeline
  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    try {
      const res = await fetch(`${API_BASE}/api/emails/process-all`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.emails) {
          setEmails(data.emails);
        }
      }
      const remRes = await fetch(`${API_BASE}/api/reminders`);
      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData.reminders || []);
      }
    } catch (err) {
      console.error('Batch processing error:', err);
    } finally {
      setIsProcessingAll(false);
    }
  };

  // Toggle Reminder completion
  const handleToggleReminder = async (id, isCompleted) => {
    setReminders(prev =>
      prev.map(r => (r.id === id ? { ...r, is_completed: isCompleted } : r))
    );

    try {
      await fetch(`${API_BASE}/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
    } catch (err) {
      console.error('Failed to update reminder:', err);
    }
  };

  // Toggle Email read status
  const handleToggleRead = async (id, isRead) => {
    setEmails(prev =>
      prev.map(e => (e.id === id ? { ...e, is_read: isRead } : e))
    );

    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(prev => ({ ...prev, is_read: isRead }));
    }

    try {
      await fetch(`${API_BASE}/api/emails/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: isRead }),
      });
    } catch (err) {
      console.error('Failed to update email read state:', err);
    }
  };

  // Derived statistics (Critical rule: uncertain deadlines are excluded from upcoming count)
  const stats = useMemo(() => {
    const confirmedDeadlines = emails.filter(
      e => {
        const d = e.user_deadline || e.deadline;
        return Boolean(d) && e.deadline_confidence !== 'uncertain';
      }
    );
    const uncertainDeadlines = emails.filter(
      e => {
        const d = e.user_deadline || e.deadline;
        return Boolean(d) && e.deadline_confidence === 'uncertain' && !e.user_deadline;
      }
    );

    const now = new Date();
    const activeReminders = reminders.filter(r => {
      if (r.status === 'done' || r.is_completed) return false;
      if (r.status === 'snoozed' && r.snoozed_until && new Date(r.snoozed_until) > now) return false;
      return true;
    });

    return {
      total: emails.length,
      unread: emails.filter(e => !e.is_read).length,
      highPriority: emails.filter(e => ((e.user_priority || e.priority) || '').toLowerCase() === 'high').length,
      deadlines: confirmedDeadlines.length,
      uncertainDeadlines: uncertainDeadlines.length,
      reminders: activeReminders.length,
    };
  }, [emails, reminders]);

  // If viewing Public Landing Page
  if (currentView === 'landing') {
    return <LandingPage onEnterApp={() => setCurrentView('home')} />;
  }

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col md:flex-row font-sans">
      
      {/* 1. Left Dark Green Sidebar (Desktop) */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view !== 'detail') setSelectedEmail(null);
        }}
        unreadCount={stats.unread}
        deadlinesCount={stats.deadlines}
        remindersCount={stats.reminders}
      />

      {/* 2. Main Work Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Search & Actions Bar */}
        <TopBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onProcessAll={handleProcessAll}
          isProcessingAll={isProcessingAll}
          onOpenIngest={() => setIsIngestModalOpen(true)}
          unreadCount={stats.unread}
        />

        {/* Content View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          
          {/* Loading State */}
          {loading && (
            <div className="py-24 text-center text-ink-muted flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-forest" />
              <p className="font-serif text-lg text-ink">Preparing your collegiate briefing...</p>
              <p className="text-xs text-ink-muted">Synchronizing emails, deadlines & AI intelligence</p>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="editorial-card p-5 border-red-200 bg-[#FDF2F2] text-red-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Failed to connect to backend</p>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="px-3.5 py-1.5 bg-forest text-[#F1EBDD] text-xs font-semibold rounded-xl hover:bg-forest-hover transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Active Screen View */}
          {!loading && !error && (
            <>
              {currentView === 'home' && (
                <HomeView
                  emails={emails}
                  digest={digest}
                  stats={stats}
                  onSelectEmail={handleSelectEmail}
                  onNavigate={(view) => setCurrentView(view)}
                  onRegenerateDigest={handleRegenerateDigest}
                  isRegeneratingDigest={isRegeneratingDigest}
                  onSelectEmailById={handleSelectEmailById}
                />
              )}

              {currentView === 'digest' && (
                <DigestView
                  digest={digest}
                  onRefreshDigest={handleRegenerateDigest}
                  isRefreshing={isRegeneratingDigest}
                  onSelectEmailById={handleSelectEmailById}
                />
              )}

              {currentView === 'inbox' && (
                <InboxView
                  emails={emails}
                  onSelectEmail={handleSelectEmail}
                  onToggleRead={handleToggleRead}
                  onUpdateCategory={handleUpdateCategory}
                  onOpenIngest={() => setIsIngestModalOpen(true)}
                  isProcessing={isProcessingAll}
                />
              )}

              {currentView === 'deadlines' && (
                <DeadlinesView
                  emails={emails}
                  onSelectEmail={handleSelectEmail}
                />
              )}

              {currentView === 'actions' && (
                <ActionsView
                  reminders={reminders}
                  emails={emails}
                  onUpdateReminderStatus={handleUpdateReminderStatus}
                  onSelectEmail={handleSelectEmail}
                />
              )}

              {currentView === 'detail' && selectedEmail && (
                <EmailDetailView
                  email={selectedEmail}
                  onBack={() => setCurrentView('inbox')}
                  onToggleRead={handleToggleRead}
                  onUpdateCategory={handleUpdateCategory}
                  onOverride={handleOverrideEmail}
                  onReprocess={handleReprocessEmail}
                  isProcessingSingle={isProcessingSingle}
                />
              )}
            </>
          )}

        </main>

      </div>

      {/* 3. Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view !== 'detail') setSelectedEmail(null);
        }}
        unreadCount={stats.unread}
      />

      {/* Global Modals */}
      <FirstRunModal />
      <SettingsModal onResetDemo={handleResetDemo} />
      <IngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onIngestEmail={handleIngestEmail}
        isIngesting={isIngesting}
        onEmlUploaded={handleEmlUploaded}
        onGmailSynced={handleGmailSynced}
      />

    </div>
  );
}
