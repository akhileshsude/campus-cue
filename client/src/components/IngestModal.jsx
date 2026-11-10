import React, { useState } from 'react';
import { X, Sparkles, Wand2, MailPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

const SAMPLE_TEMPLATES = [
  {
    name: '⚡ Emergency Exam Shift',
    sender: 'Academic Evaluations Cell <exams@university.edu>',
    subject: 'URGENT: CS301 Operating Systems Exam Relocation to Room 402',
    body: `Dear CS301 Students,\n\nPlease be advised that due to electrical maintenance in Turing Hall, your Operating Systems midterm exam scheduled for tomorrow at 10:00 AM has been moved to Faraday Building, Room 402.\n\nYou must arrive by 9:45 AM with your student identity card. Programmable calculators and mobile phones are strictly barred.\n\nController of Examinations`,
  },
  {
    name: '💼 Placement Interview Slot',
    sender: 'Placement & Career Advisory <placements@university.edu>',
    subject: 'Amazon SDE Summer 2027: Technical Interview Slot Confirmation Required',
    body: `Dear Candidate,\n\nYou have been shortlisted for the final technical interview loop for Amazon's Software Development Engineer Internship.\n\nYou must log in to the placement handshake portal and confirm your preferred 45-minute interview time slot before tomorrow at 6:00 PM. Failure to confirm will result in forfeiting your spot to the waitlist.\n\nBest regards,\nCorporate Relations Team`,
  },
  {
    name: '📚 CS Milestone Submission',
    sender: 'Prof. Aris Thorne <a.thorne@university.edu>',
    subject: 'CS301: Distributed Storage Architecture PDF Due This Friday',
    body: `Hello Everyone,\n\nA reminder that your Phase 1 database schema diagram and distributed consensus architecture PDF are due this Friday by 11:59 PM. Please ensure your private GitHub repo has invited @ta-core as a collaborator.\n\nLate submissions will receive a 10% penalty per day.\n\nProf. Thorne`,
  },
  {
    name: '📸 Club Weekly Roundup',
    sender: 'Pixel Photography Club <pixel@university.edu>',
    subject: 'Pixel Newsletter #43: Golden Hour Composition & Sensor Cleaning',
    body: `Hey photographers!\n\nCheck out this week's featured shot by Arjun on the South Quad clocktower! Read our new tutorial on how to clean your mirrorless camera sensor safely during monsoon season.\n\nHappy clicking,\nPixel Club Committee`,
  },
];

export default function IngestModal({ isOpen, onClose, onIngestEmail, isIngesting }) {
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleApplyTemplate = (tpl) => {
    setSender(tpl.sender);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('Please provide at least a subject and body.');
      return;
    }
    setError(null);
    onIngestEmail({
      sender: sender.trim() || 'University Administration <admin@university.edu>',
      subject: subject.trim(),
      body: body.trim(),
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="editorial-card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5 bg-[#FBF8F1] border-cream-border shadow-editorial"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cream-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-forest text-gold flex items-center justify-center">
              <MailPlus className="w-4 h-4 text-gold" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-ink leading-tight">
                Simulate & Ingest Email
              </h2>
              <p className="text-xs text-ink-muted">
                Test Gemini's real-time classification, deadline detection & summaries
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Templates */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted block">
            Quick University Templates:
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-cream-border bg-cream hover:bg-cream-border/50 text-ink transition-colors"
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              Sender (Name & Email Address)
            </label>
            <input
              type="text"
              placeholder="e.g. Prof. Alan Turing <turing@university.edu>"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-cream border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CS301 Final Project Deadline Rescheduled"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-cream border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-ink block mb-1">
              Email Body Text *
            </label>
            <textarea
              required
              rows={5}
              placeholder="Paste raw email contents here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-cream border border-cream-border rounded-xl text-ink focus:outline-none focus:border-forest leading-relaxed font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-cream-border flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isIngesting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-xs font-semibold rounded-xl transition-all shadow-xs disabled:opacity-60"
            >
              <Sparkles className={`w-3.5 h-3.5 text-gold ${isIngesting ? 'animate-spin' : ''}`} />
              <span>{isIngesting ? 'Analyzing & Routing...' : 'Analyze & Ingest with AI'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

