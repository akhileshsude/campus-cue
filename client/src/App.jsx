import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LandingPage from './components/LandingPage';
import HomeView from './components/HomeView';
import InboxView from './components/InboxView';
import DeadlinesView from './components/DeadlinesView';
import ActionsView from './components/ActionsView';
import EmailDetailView from './components/EmailDetailView';
import MobileBottomNav from './components/MobileBottomNav';
import FirstRunModal from './components/FirstRunModal';
import SettingsModal from './components/SettingsModal';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const [emails, setEmails] = useState([]);
  const [digest, setDigest] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  // App Navigation: 'home' | 'inbox' | 'deadlines' | 'actions' | 'detail' | 'landing'
  const [currentView, setCurrentView] = useState('home');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch initial data from backend API
  const fetchData = async () => {
    try {
      setError(null);
      
      const [emailsRes, digestRes, remindersRes] = await Promise.all([
        fetch('/api/emails'),
        fetch('/api/digest'),
        fetch('/api/reminders')
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

  // Update Category Override
  const handleUpdateCategory = async (emailId, newCategory) => {
    setEmails(prev =>
      prev.map(e => (e.id === emailId ? { ...e, user_category: newCategory } : e))
    );

    if (selectedEmail && selectedEmail.id === emailId) {
      setSelectedEmail(prev => ({ ...prev, user_category: newCategory }));
    }

    try {
      await fetch(`/api/emails/${emailId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
    } catch (err) {
      console.error('Category update failed:', err);
    }
  };

  // Process all emails with Gemini AI batch pipeline
  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    try {
      const res = await fetch('/api/emails/process-all', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.emails) {
          setEmails(data.emails);
        }
      }
      const remRes = await fetch('/api/reminders');
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
      await fetch(`/api/reminders/${id}`, {
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
      await fetch(`/api/emails/${id}/read`, {
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
      e => Boolean(e.deadline) && e.deadline_confidence !== 'uncertain'
    );
    const uncertainDeadlines = emails.filter(
      e => Boolean(e.deadline) && e.deadline_confidence === 'uncertain'
    );

    return {
      total: emails.length,
      unread: emails.filter(e => !e.is_read).length,
      highPriority: emails.filter(e => (e.priority || '').toLowerCase() === 'high').length,
      deadlines: confirmedDeadlines.length,
      uncertainDeadlines: uncertainDeadlines.length,
      reminders: reminders.filter(r => !r.is_completed).length,
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
                />
              )}

              {currentView === 'inbox' && (
                <InboxView
                  emails={emails}
                  onSelectEmail={handleSelectEmail}
                  onToggleRead={handleToggleRead}
                  onUpdateCategory={handleUpdateCategory}
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
                  onToggleReminder={handleToggleReminder}
                  onSelectEmail={handleSelectEmail}
                />
              )}

              {currentView === 'detail' && selectedEmail && (
                <EmailDetailView
                  email={selectedEmail}
                  onBack={() => setCurrentView('inbox')}
                  onToggleRead={handleToggleRead}
                  onUpdateCategory={handleUpdateCategory}
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
      <SettingsModal />

    </div>
  );
}
