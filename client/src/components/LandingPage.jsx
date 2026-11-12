import React from 'react';
import { 
  ArrowRight, 
  Mail, 
  Sparkles, 
  FileText, 
  CalendarClock, 
  CheckCircle2,
  BookOpen,
  Layers,
  Clock
} from 'lucide-react';

export default function LandingPage({ onEnterApp }) {
  const features = [
    {
      title: 'Smart Classification',
      desc: 'Sorts emails into academics, placements, clubs, events and more.',
      icon: Mail,
    },
    {
      title: 'AI Summaries',
      desc: 'Get key takeaways from long emails and threads.',
      icon: FileText,
    },
    {
      title: 'Deadlines & Reminders',
      desc: 'Never miss important dates or follow-ups.',
      icon: CalendarClock,
    },
    {
      title: 'Personalized Digest',
      desc: 'Your daily college updates, in one place.',
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col font-sans selection:bg-gold/20">
      
      {/* 1. Top Navigation */}
      <nav className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 flex items-center justify-center text-forest">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <span className="font-serif font-bold text-2xl text-forest tracking-tight">
              clg.inbox
            </span>
            <span className="hidden sm:inline-block ml-3 text-xs font-serif italic text-sage">
              Your college inbox, finally in order.
            </span>
          </div>
        </div>

        {/* Links & CTA */}
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-muted">
            <a href="#features" className="hover:text-forest transition-colors">Features</a>
            <a href="#about" className="hover:text-forest transition-colors">About</a>
            <a href="#faq" className="hover:text-forest transition-colors">FAQ</a>
          </div>

          <button
            onClick={onEnterApp}
            className="px-5 py-2.5 bg-forest hover:bg-forest-hover text-[#F1EBDD] text-sm font-medium rounded-xl transition-all shadow-xs"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-20 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.12]">
              Your college inbox, <br />
              <span className="italic font-normal">finally in order.</span>
            </h1>

            <p className="text-base sm:text-lg text-ink-muted max-w-xl leading-relaxed">
              AI-powered email assistant for students. Classify, summarise, get priorities and never miss what matters.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-5">
              <button
                onClick={onEnterApp}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-forest hover:bg-forest-hover text-[#F1EBDD] font-medium text-sm sm:text-base rounded-xl transition-all shadow-sm group"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onEnterApp}
                className="text-sm sm:text-base font-medium text-ink-muted hover:text-forest underline underline-offset-4 transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Right Hero Visual: Live Collegiate Intelligence Preview */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden border border-cream-border bg-gradient-to-br from-[#F4EFE4] via-[#EAE2D2] to-[#E1D7C2] p-5 sm:p-6 flex flex-col justify-between shadow-card space-y-4">
              <div className="flex items-center justify-between text-xs font-serif italic text-sage border-b border-forest/10 pb-2.5">
                <span>Daily Academic Command Edition</span>
                <span className="inline-flex items-center gap-1 not-italic font-sans font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-forest text-gold">
                  <Sparkles className="w-3 h-3" />
                  <span>Briefing</span>
                </span>
              </div>

              <div className="space-y-2.5 text-left">
                <div className="p-3 rounded-xl bg-cream-card border border-cream-border shadow-2xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800">
                      High Priority &middot; Exam
                    </span>
                    <span className="text-[10px] font-mono text-ink-muted">10:00 AM</span>
                  </div>
                  <p className="text-xs font-bold text-ink">
                    OS Midterm Room Relocation &rarr; Faraday 402
                  </p>
                  <p className="text-[11px] text-ink-muted leading-snug">
                    Carry ID card by 9:45 AM. Verified date extracted automatically.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-cream-card border border-cream-border shadow-2xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-forest/10 text-forest">
                      Placement Action
                    </span>
                    <span className="text-[10px] font-semibold text-forest flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" /> Tomorrow 6 PM
                    </span>
                  </div>
                  <p className="text-xs font-bold text-ink">
                    Confirm Technical Interview Slot
                  </p>
                  <p className="text-[11px] text-ink-muted leading-snug">
                    Added to Actions queue &amp; exportable to Calendar (.ics).
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-forest text-[#F1EBDD] flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-gold shrink-0" />
                    <span>Works with any college inbox, even without OAuth</span>
                  </span>
                  <Mail className="w-3.5 h-3.5 text-gold shrink-0" />
                </div>
              </div>

              <div className="text-[11px] text-ink-muted border-t border-forest/10 pt-2.5 flex items-center justify-between">
                <span>Designed for academic precision</span>
                <span className="font-bold text-forest">clg.inbox</span>
              </div>
            </div>
          </div>

        </div>

        {/* 3. "Why clg.inbox?" Feature Row */}
        <div id="features" className="mt-12 lg:mt-16 pt-12 border-t border-cream-border">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink mb-8">
            Why clg.inbox?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="editorial-card p-5 sm:p-6 flex flex-col justify-between space-y-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gold" />
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-ink mb-1.5">
                      {feat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Deep Forest Green Footer Band */}
      <footer className="w-full bg-forest text-[#F1EBDD] py-14 px-6 lg:px-12 mt-16 border-t border-forest-light">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-white/95">
            Less inbox. More progress.
          </p>

          <button
            onClick={onEnterApp}
            className="px-6 py-2.5 bg-forest-light hover:bg-[#386450] text-[#F1EBDD] text-sm font-medium rounded-xl border border-forest-light/80 transition-colors"
          >
            Open Dashboard →
          </button>
        </div>
      </footer>

    </div>
  );
}

