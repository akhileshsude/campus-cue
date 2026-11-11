import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { useUser } from './context/UserContext';
import { apiFetch } from './utils/api';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const { user, updateUser } = useUser();
  const [emails, setEmails] = useState([]);
  const [digest, setDigest] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [dataMode, setDataMode] = useState('demo');
  const [showArchived, setShowArchived] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isProcessingSingle, setIsProcessingSingle] = useState(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [ingestInitialTab, setIngestInitialTab] = useState('paste');
  const [oauthBanner, setOauthBanner] = useState(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isRegeneratingDigest, setIsRegeneratingDigest] = useState(false);
  const lastAutoRefreshRef = useRef(0);

  // App Navigation: 'home' | 'digest' | 'inbox' | 'deadlines' | 'actions' | 'detail' | 'landing'
  const [currentView, setCurrentView] = useState('home');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async (archivedOverride = showArchived) => {
    try {
      setError(null);
      const studentNameParam = encodeURIComponent(user?.name || '');
      const emailUrl = archivedOverride ? '/api/emails?onlyArchived=true' : '/api/emails';

      const [emailsRes, digestRes, remindersRes, healthRes] = await Promise.all([
        apiFetch(emailUrl),
        apiFetch(`/api/digest?studentName=${studentNameParam}`),
        apiFetch('/api/reminders'),
        apiFetch('/api/health'),
      ]);

      if (!emailsRes.ok) throw new Error(`Emails API error: ${emailsRes.status}`);

      const emailsData = await emailsRes.json();
      setEmails(emailsData.emails || []);
      if (emailsData.dataMode) setDataMode(emailsData.dataMode);

      if (digestRes.ok) {
        const digestData = await digestRes.json();
        setDigest(digestData.digest || null);
      }

      if (remindersRes.ok) {
        const remindersData = await remindersRes.json();
        setReminders(remindersData.reminders || []);
      }

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthStatus(hData);
        if (hData.dataMode) setDataMode(hData.dataMode);
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

    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const gmailStatus = params.get('gmail');
      const msStatus = params.get('microsoft');
      const connectedEmail = params.get('email');
      const gmailError = params.get('gmail_error');
      const msError = params.get('microsoft_error');

      if (gmailStatus === 'connected' || msStatus === 'connected') {
        const providerName = msStatus === 'connected' ? 'Microsoft / Outlook' : 'Google / Gmail';
        if (connectedEmail && !user?.email) {
          updateUser({ email: connectedEmail });
        }
        setOauthBanner({
          type: 'success',
          text: `Connected ${connectedEmail || providerName} via ${providerName} OAuth and synced your latest real emails!`,
        });
        setIngestInitialTab('connect');
        setIsIngestModalOpen(true);
        window.history.replaceState({}, '', window.location.pathname);
      } else if (gmailError || msError) {
        setOauthBanner({
          type: 'error',
          text: gmailError
            ? `Google OAuth failed (${gmailError}). If your university restricts OAuth apps or test users, use Universal IMAP with a 16-char App Password or .eml drop right here!`
            : `Microsoft OAuth failed (${msError}). Try Universal IMAP or Auto-Forwarding Webhook below.`,
        });
        setIngestInitialTab('connect');
        setIsIngestModalOpen(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Refresh data cleanly if user updates their email identity or toggles archive view
  useEffect(() => {
    if (!loading) {
      fetchData(showArchived);
    }
  }, [user?.email, showArchived]);

  // Auto-refresh when switching back to this tab (e.g. after 1-click extension sync)
  useEffect(() => {
    const maybeRefresh = () => {
      if (loading || document.hidden) return;
      const now = Date.now();
      if (now - lastAutoRefreshRef.current < 8000) return;
      lastAutoRefreshRef.current = now;
      fetchData(showArchived);
    };

    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [user?.email, showArchived, loading]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (healthStatus?.connectedAccountsCount > 0) {
        await apiFetch('/api/emails/sync-all', { method: 'POST' });
      }
    } catch {
      // Proceed to refresh current store even if sync-all encounters transient failure
    }
    await fetchData(showArchived);
  };

  const handleOpenConnectInbox = () => {
    setIngestInitialTab('connect');
    setOauthBanner(null);
    setIsIngestModalOpen(true);
  };

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setCurrentView('detail');
    if (!email.is_read) {
      handleToggleRead(email.id, true);
    }
  };

  const handleSelectEmailById = (emailId) => {
    const found = emails.find(e => e.id === emailId);
    if (found) {
      handleSelectEmail(found);
    } else {
      apiFetch('/api/emails')
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

  const handleRegenerateDigest = async () => {
    setIsRegeneratingDigest(true);
    try {
      const res = await apiFetch('/api/digest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: user?.name || '' }),
      });
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
      await apiFetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to update reminder status:', err);
    }
  };

  const handleIngestEmail = async (rawEmail) => {
    setIsIngesting(true);
    try {
      const res = await apiFetch('/api/emails/process', {
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
          await fetchData(false);
          setSelectedEmail(data.email);
          setCurrentView('detail');
          setIsIngestModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Failed to ingest email:', err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleEmlUploaded = async () => {
    setShowArchived(false);
    await fetchData(false);
    setCurrentView('inbox');
    setIsIngestModalOpen(false);
  };

  const handleInboxSynced = async () => {
    setShowArchived(false);
    await fetchData(false);
    setIsIngestModalOpen(false);
    setCurrentView('inbox');
  };

  const handleOverrideEmail = async (emailId, overrides) => {
    setEmails(prev =>
      prev.map(e => {
        if (e.id !== emailId) return e;
        return {
          ...e,
          ...(overrides.category !== undefined ? { user_category: overrides.category } : {}),
          ...(overrides.priority !== undefined ? { user_priority: overrides.priority } : {}),
          ...(overrides.deadline !== undefined ? { user_deadline: overrides.deadline } : {}),
          ...(overrides.deadline_completed !== undefined ? { deadline_completed: overrides.deadline_completed } : {}),
          edited_by_user: Boolean(
            overrides.category ?? e.user_category ?? overrides.priority ?? e.user_priority ?? overrides.deadline ?? e.user_deadline
          ),
        };
      })
    );

    if (selectedEmail && selectedEmail.id === emailId) {
      setSelectedEmail(prev => ({
        ...prev,
        ...(overrides.category !== undefined ? { user_category: overrides.category } : {}),
        ...(overrides.priority !== undefined ? { user_priority: overrides.priority } : {}),
        ...(overrides.deadline !== undefined ? { user_deadline: overrides.deadline } : {}),
        ...(overrides.deadline_completed !== undefined ? { deadline_completed: overrides.deadline_completed } : {}),
      }));
    }

    try {
      const res = await apiFetch(`/api/emails/${emailId}/override`, {
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

  const handleToggleDeadlineDone = async (emailId, isCompleted) => {
    await handleOverrideEmail(emailId, { deadline_completed: isCompleted });
  };

  const handleReprocessEmail = async (emailId) => {
    setIsProcessingSingle(true);
    try {
      const res = await apiFetch(`/api/emails/${emailId}/reprocess`, { method: 'POST' });
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

  const handleArchiveEmail = async (emailId, isArchived) => {
    try {
      const res = await apiFetch(`/api/emails/${emailId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
      });
      if (res.ok) {
        if (currentView === 'detail' && selectedEmail?.id === emailId) {
          setSelectedEmail(null);
          setCurrentView('inbox');
        }
        await fetchData(showArchived);
      }
    } catch (err) {
      console.error('Failed to archive email:', err);
    }
  };

  const handleDeleteEmail = async (emailId) => {
    try {
      const res = await apiFetch(`/api/emails/${emailId}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentView === 'detail' && selectedEmail?.id === emailId) {
          setSelectedEmail(null);
          setCurrentView('inbox');
        }
        await fetchData(showArchived);
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    }
  };

  const handleClearDemo = async () => {
    try {
      const res = await apiFetch('/api/emails/clear-demo', { method: 'POST' });
      if (res.ok) {
        setShowArchived(false);
        await fetchData(false);
      }
    } catch (err) {
      console.error('Failed to clear demo data:', err);
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await apiFetch('/api/reset-demo', { method: 'POST' });
      if (res.ok) {
        setShowArchived(false);
        await fetchData(false);
      }
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    try {
      const res = await apiFetch('/api/emails/process-all', { method: 'POST' });
      if (res.ok) {
        await fetchData(showArchived);
      }
    } catch (err) {
      console.error('Batch processing error:', err);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const handleToggleRead = async (id, isRead) => {
    setEmails(prev => prev.map(e => (e.id === id ? { ...e, is_read: isRead } : e)));
    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(prev => ({ ...prev, is_read: isRead }));
    }

    try {
      await apiFetch(`/api/emails/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: isRead }),
      });
    } catch (err) {
      console.error('Failed to update email read state:', err);
    }
  };

  const stats = useMemo(() => {
    const activeEmails = showArchived ? [] : emails;
    const confirmedDeadlines = activeEmails.filter(e => {
      const d = e.user_deadline || e.deadline;
      return Boolean(d) && !e.deadline_completed && e.deadline_confidence !== 'uncertain';
    });
    const uncertainDeadlines = activeEmails.filter(e => {
      const d = e.user_deadline || e.deadline;
      return Boolean(d) && !e.deadline_completed && e.deadline_confidence === 'uncertain' && !e.user_deadline;
    });

    const now = new Date();
    const activeReminders = reminders.filter(r => {
      if (r.status === 'done' || r.is_completed) return false;
      if (r.status === 'snoozed' && r.snoozed_until && new Date(r.snoozed_until) > now) return false;
      return true;
    });

    return {
      total: activeEmails.length,
      unread: activeEmails.filter(e => !e.is_read).length,
      highPriority: activeEmails.filter(e => ((e.user_priority || e.priority) || '').toLowerCase() === 'high').length,
      deadlines: confirmedDeadlines.length,
      uncertainDeadlines: uncertainDeadlines.length,
      reminders: activeReminders.length,
    };
  }, [emails, reminders, showArchived]);

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
          setSearchQuery={(val) => {
            setSearchQuery(val);
            if (val.trim() && currentView !== 'inbox') {
              setCurrentView('inbox');
            }
          }}
          onSearchSubmit={() => setCurrentView('inbox')}
          onNotificationsClick={() => setCurrentView('actions')}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onProcessAll={handleProcessAll}
          isProcessingAll={isProcessingAll}
          onOpenIngest={() => {
            setIngestInitialTab('paste');
            setOauthBanner(null);
            setIsIngestModalOpen(true);
          }}
          unreadCount={stats.unread}
        />

        {/* Content View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
          
          {loading && (
            <div className="space-y-8 animate-pulse" aria-label="Loading Campus Cue">
              <div className="space-y-2">
                <div className="h-9 w-64 bg-cream-border/60 rounded-xl" />
                <div className="h-4 w-44 bg-cream-border/40 rounded-lg" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="editorial-card p-5 h-32 flex flex-col justify-between">
                    <div className="h-8 w-8 rounded-lg bg-cream-border/60" />
                    <div className="space-y-2">
                      <div className="h-7 w-12 bg-cream-border/60 rounded-md" />
                      <div className="h-3 w-28 bg-cream-border/40 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 editorial-card p-6 h-64 space-y-4">
                  <div className="h-5 w-32 bg-cream-border/60 rounded" />
                  <div className="h-6 w-3/4 bg-cream-border/50 rounded" />
                  <div className="h-4 w-full bg-cream-border/40 rounded" />
                  <div className="h-4 w-5/6 bg-cream-border/40 rounded" />
                </div>
                <div className="lg:col-span-5 editorial-card p-6 h-64 space-y-4">
                  <div className="h-5 w-40 bg-cream-border/60 rounded" />
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="h-10 bg-cream-border/40 rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          )}

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

          {!loading && !error && (
            <>
              {currentView === 'home' && (
                <HomeView
                  emails={emails}
                  digest={digest}
                  stats={stats}
                  dataMode={dataMode}
                  connectedAccountsCount={healthStatus?.connectedAccountsCount || 0}
                  onSelectEmail={handleSelectEmail}
                  onNavigate={(view) => setCurrentView(view)}
                  onRegenerateDigest={handleRegenerateDigest}
                  isRegeneratingDigest={isRegeneratingDigest}
                  onSelectEmailById={handleSelectEmailById}
                  onOpenConnectInbox={handleOpenConnectInbox}
                  onClearDemo={handleClearDemo}
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
                  onArchive={handleArchiveEmail}
                  onDelete={handleDeleteEmail}
                  showArchived={showArchived}
                  onToggleShowArchived={() => setShowArchived(prev => !prev)}
                  onOpenIngest={handleOpenConnectInbox}
                  isProcessing={isProcessingAll}
                  globalSearchQuery={searchQuery}
                  setGlobalSearchQuery={setSearchQuery}
                />
              )}

              {currentView === 'deadlines' && (
                <DeadlinesView
                  emails={emails}
                  reminders={reminders}
                  onSelectEmail={handleSelectEmail}
                  onToggleDeadlineDone={handleToggleDeadlineDone}
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
                  onArchive={handleArchiveEmail}
                  onDelete={handleDeleteEmail}
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
      <SettingsModal
        onResetDemo={handleResetDemo}
        onClearDemo={handleClearDemo}
        healthStatus={healthStatus}
        onHealthUpdated={() => fetchData(showArchived)}
      />
      <IngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onIngestEmail={handleIngestEmail}
        isIngesting={isIngesting}
        onEmlUploaded={handleEmlUploaded}
        onGmailSynced={handleInboxSynced}
        initialTab={ingestInitialTab}
        oauthBanner={oauthBanner}
      />

    </div>
  );
}
