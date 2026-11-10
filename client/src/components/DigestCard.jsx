import React from 'react';
import { Sparkles, BookOpen, CheckSquare, Calendar, ArrowRight } from 'lucide-react';

export default function DigestCard({ digest, onFilterAcademics }) {
  if (!digest) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl glass p-5 sm:p-6 bg-white/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-white/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shadow-xs">
            <Sparkles className="h-4 w-4 text-[#4F46E5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#1F2937] leading-tight">
                Daily Academic Digest
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50/80 text-indigo-700 border border-indigo-200/50">
                Today's Brief
              </span>
            </div>
            <p className="text-[11px] text-[#4B5563]">
              {digest.date || 'Updated this morning'}
            </p>
          </div>
        </div>

        {onFilterAcademics && (
          <button
            onClick={onFilterAcademics}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] transition-colors"
          >
            <span>View Academics</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Headline & Narrative */}
      <div className="mt-3.5">
        <h4 className="text-sm sm:text-base font-bold text-[#1F2937] leading-snug">
          {digest.headline}
        </h4>
        <p className="mt-2 text-xs sm:text-sm text-[#4B5563] leading-relaxed">
          {digest.summary}
        </p>
      </div>

      {/* Action Items List */}
      {digest.actionItems && digest.actionItems.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-white/50">
          <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wide block mb-2.5">
            Key Academic Action Items
          </span>
          <ul className="space-y-2">
            {digest.actionItems.map((item, idx) => (
              <li key={idx} className="glass-nested flex items-start gap-2.5 p-2.5 text-xs text-[#1F2937]">
                <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
