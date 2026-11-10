import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import OverviewCards from './components/OverviewCards';
import CategoryFilter from './components/CategoryFilter';
import EmailCard from './components/EmailCard';
import PriorityEmails from './components/PriorityEmails';
import DeadlineList from './components/DeadlineList';
import DigestCard from './components/DigestCard';
import ReminderList from './components/ReminderList';
import EmailModal from './components/EmailModal';
import { 
  Inbox, 
  AlertCircle, 
  RefreshCw, 
  Filter, 
  CheckCircle2,
  Sparkles,
  Bot
} from 'lucide-react';

export default function App() {
  const [emails, setEmails] = useState([]);
  const [digest, setDigest] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processingEmailId, setProcessingEmailId] = useState(null);
  const [aiBannerMessage, setAiBannerMessage] = useState(null);

  // Filters & UI state
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeCardFilter, setActiveCardFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);

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

  // Step 4: Correct Category (Dropdown on card / modal)
  const handleUpdateCategory = async (emailId, newCategory) => {
    // Optimistic UI update
    setEmails(prev =>
      prev.map(e => (e.id === emailId ? { ...e, user_category: newCategory } : e))
    );

    if (selectedEmail && selectedEmail.id === emailId) {
      setSelectedEmail(prev => ({ ...prev, user_category: newCategory }));
    }

    try {
      const res = await fetch(`/api/emails/${emailId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      if (!res.ok) throw new Error('Failed to update category');
    } catch (err) {
      console.error('Category update failed:', err);
    }
  };

  // Step 3 & 4: Process a single email with AI
  const handleProcessEmail = async (emailId) => {
    setProcessingEmailId(emailId);
    try {
      const res = await fetch('/api/emails/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emailId }),
      });

      if (!res.ok) throw new Error('AI processing failed');
      const data = await res.json();

      if (data.email) {
        setEmails(prev => prev.map(e => (e.id === emailId ? data.email : e)));
        if (selectedEmail && selectedEmail.id === emailId) {
          setSelectedEmail(data.email);
        }
      }

      // Refresh reminders in case follow-up changed
      const remRes = await fetch('/api/reminders');
      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData.reminders || []);
      }
    } catch (err) {
      console.error('AI processing error:', err);
    } finally {
      setProcessingEmailId(null);
    }
  };

  // Process all emails with Gemini AI batch pipeline
  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    setAiBannerMessage('Running Gemini AI classification and deadline extraction...');
    try {
      const res = await fetch('/api/emails/process-all', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Batch processing failed');
      const data = await res.json();
      if (data.emails) {
        setEmails(data.emails);
      }
      setAiBannerMessage(`AI Analysis complete! Successfully processed ${data.emails?.length || 0} emails.`);
      setTimeout(() => setAiBannerMessage(null), 5000);
      
      const remRes = await fetch('/api/reminders');
      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData.reminders || []);
      }
    } catch (err) {
      console.error('Batch processing error:', err);
      setAiBannerMessage(`AI Batch processing error: ${err.message}`);
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

  // Helper for effective category (user category overrides AI)
  const getCategory = (e) => e.user_category || e.category;

  // Derived category counts
  const categoryCounts = useMemo(() => {
    const counts = { All: emails.length };
    emails.forEach(e => {
      const cat = getCategory(e);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [emails]);

  // Derived overview statistics
  // CRITICAL RULE: Uncertain deadlines are excluded from the confirmed count
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
    };
  }, [emails]);

  // Handle overview card click (quick toggle filter)
  const handleCardClick = (cardId) => {
    if (activeCardFilter === cardId) {
      setActiveCardFilter(null);
    } else {
      setActiveCardFilter(cardId);
      if (cardId === 'all') {
        setActiveCategory('All');
        setActiveCardFilter(null);
      }
    }
  };

  // Filtered emails based on search, category, and quick card filter
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const effectiveCat = getCategory(email);

      // Category filter
      if (activeCategory !== 'All' && effectiveCat !== activeCategory) {
        return false;
      }

      // Quick overview card filter
      if (activeCardFilter === 'unread' && email.is_read) {
        return false;
      }
      if (activeCardFilter === 'priority' && (email.priority || '').toLowerCase() !== 'high') {
        return false;
      }
      if (activeCardFilter === 'deadlines' && (!email.deadline || email.deadline_confidence === 'uncertain')) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inSubject = email.subject.toLowerCase().includes(q);
        const inSender = email.sender.toLowerCase().includes(q);
        const inBody = email.body.toLowerCase().includes(q);
        const inCategory = effectiveCat.toLowerCase().includes(q);
        const inSummary = (email.summary || '').toLowerCase().includes(q);
        if (!inSubject && !inSender && !inBody && !inCategory && !inSummary) {
          return false;
        }
      }

      return true;
    });
  }, [emails, activeCategory, activeCardFilter, searchQuery]);

  return (
    <div className="min-h-screen relative overflow-x-hidden text-[#1F2937] flex flex-col">
      {/* 3 Large Blurred Fixed Background Blobs */}
      <div 
        aria-hidden="true" 
        className="fixed top-[-5%] left-[-5%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full bg-[#A5B4FC] blur-3xl opacity-40 pointer-events-none -z-10" 
      />
      <div 
        aria-hidden="true" 
        className="fixed top-[30%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-[#BBD6C8] blur-3xl opacity-40 pointer-events-none -z-10" 
      />
      <div 
        aria-hidden="true" 
        className="fixed bottom-[-5%] left-[25%] w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] rounded-full bg-[#E9C9D3] blur-3xl opacity-40 pointer-events-none -z-10" 
      />

      {/* Top Navigation */}
      <Navbar
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onProcessAll={handleProcessAll}
        isProcessingAll={isProcessingAll}
      />

      {/* AI Status Banner */}
      {aiBannerMessage && (
        <div className="glass mx-4 sm:mx-8 mt-4 bg-white/70 text-[#1F2937] text-xs font-semibold py-2.5 px-4 text-center flex items-center justify-center gap-2 animate-in fade-in shadow-sm border border-white/60">
          <Sparkles className="h-4 w-4 text-[#4F46E5]" />
          <span>{aiBannerMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Loading State */}
        {loading && (
          <div className="glass flex flex-col items-center justify-center py-20 text-[#4B5563]">
            <RefreshCw className="h-8 w-8 animate-spin text-[#4F46E5] mb-3" />
            <p className="text-sm font-semibold text-[#1F2937]">Connecting to Campus Cue API...</p>
            <p className="text-xs text-[#4B5563] mt-1">Loading student emails & AI intelligence</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="glass rounded-2xl border border-red-200/70 bg-red-50/60 p-4 text-red-800 flex items-start justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to connect to backend</p>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-[#4F46E5] text-white text-xs font-semibold rounded-xl hover:bg-[#4338CA] transition-colors shadow-xs"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Overview Summary Cards */}
            <section>
              <OverviewCards
                stats={stats}
                onCardClick={handleCardClick}
                activeFilter={activeCardFilter}
              />
            </section>

            {/* Daily Academic Digest */}
            {digest && (
              <section>
                <DigestCard
                  digest={digest}
                  onFilterAcademics={() => {
                    setActiveCategory('Academics');
                    setActiveCardFilter(null);
                  }}
                />
              </section>
            )}

            {/* Priority Emails Highlight Section */}
            <section>
              <PriorityEmails
                emails={emails}
                onSelectEmail={(email) => setSelectedEmail(email)}
              />
            </section>

            {/* Main Content Grid: Left (Emails Feed) & Right (Deadline Radar + Reminders) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Category Filter + Email List */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                
                {/* Category Tabs Container */}
                <div className="glass p-3 rounded-2xl">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/50">
                    <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                      Categories
                    </span>
                    {activeCardFilter && (
                      <button
                        onClick={() => setActiveCardFilter(null)}
                        className="text-[11px] font-semibold text-[#4F46E5] hover:underline"
                      >
                        Clear '{activeCardFilter}' filter
                      </button>
                    )}
                  </div>
                  <CategoryFilter
                    activeCategory={activeCategory}
                    onSelectCategory={(cat) => {
                      setActiveCategory(cat);
                      setActiveCardFilter(null);
                    }}
                    counts={categoryCounts}
                  />
                </div>

                {/* Email List Feed */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-[#1F2937]">
                      {activeCategory === 'All' ? 'All Received Emails' : `${activeCategory} Inbox`}
                      <span className="ml-2 text-xs font-semibold text-[#4B5563]">
                        ({filteredEmails.length})
                      </span>
                    </h3>

                    {searchQuery && (
                      <span className="text-xs text-[#4B5563]">
                        Filtering by: <span className="font-semibold text-[#1F2937]">"{searchQuery}"</span>
                      </span>
                    )}
                  </div>

                  {filteredEmails.length === 0 ? (
                    <div className="glass border-dashed border-white/70 p-8 text-center">
                      <Inbox className="h-10 w-10 text-[#4B5563]/50 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-[#1F2937]">No emails matched</p>
                      <p className="text-xs text-[#4B5563] mt-1">
                        Try selecting another category or clearing your search query.
                      </p>
                      {(activeCategory !== 'All' || searchQuery) && (
                        <button
                          onClick={() => {
                            setActiveCategory('All');
                            setSearchQuery('');
                            setActiveCardFilter(null);
                          }}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/70 hover:bg-white text-[#1F2937] border border-white/60 transition-colors shadow-xs"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredEmails.map(email => (
                      <EmailCard
                        key={email.id}
                        email={email}
                        onClick={(e) => setSelectedEmail(e)}
                        onToggleRead={handleToggleRead}
                        onUpdateCategory={handleUpdateCategory}
                      />
                    ))
                  )}
                </div>

              </div>

              {/* Right Column: Deadline Radar & Follow-up Reminders */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                
                {/* Upcoming Deadlines Radar Widget */}
                <DeadlineList
                  emails={emails}
                  onSelectEmail={(email) => setSelectedEmail(email)}
                />

                {/* Follow-up Reminders Widget */}
                <ReminderList
                  reminders={reminders}
                  onToggleReminder={handleToggleReminder}
                  onSelectEmail={(email) => setSelectedEmail(email)}
                />

              </div>

            </div>
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/50 glass py-4 text-center text-xs text-[#4B5563]">
        <p>
          <strong className="text-[#1F2937]">Campus Cue</strong> • Glassmorphism Edition • Powered by Gemini API
        </p>
      </footer>

      {/* Two-Column Email Detail Modal */}
      {selectedEmail && (
        <EmailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
          onToggleRead={handleToggleRead}
          onUpdateCategory={handleUpdateCategory}
          onProcessEmail={handleProcessEmail}
          isProcessing={processingEmailId === selectedEmail.id}
        />
      )}
    </div>
  );
}
