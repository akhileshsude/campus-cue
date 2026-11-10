import React from 'react';
import { 
  BookOpen, 
  Briefcase, 
  Users, 
  Calendar, 
  Bell, 
  Layers 
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'All', label: 'All Emails', icon: Layers },
  { id: 'Academics', label: 'Academics', icon: BookOpen },
  { id: 'Placements', label: 'Placements', icon: Briefcase },
  { id: 'Clubs', label: 'Clubs', icon: Users },
  { id: 'Events', label: 'Events', icon: Calendar },
  { id: 'Announcements', label: 'Announcements', icon: Bell },
];

export default function CategoryFilter({ activeCategory, onSelectCategory, counts = {} }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
      {CATEGORIES.map((cat) => {
        const IconComponent = cat.icon;
        const isSelected = activeCategory === cat.id;
        const count = counts[cat.id] ?? 0;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              isSelected
                ? 'bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/20 border border-transparent'
                : 'glass-nested text-[#4B5563] hover:text-[#1F2937]'
            }`}
          >
            <IconComponent className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-[#4B5563]'}`} />
            <span>{cat.label}</span>
            <span
              className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full font-bold transition-colors ${
                isSelected
                  ? 'bg-white/25 text-white'
                  : 'bg-white/60 text-[#4B5563]'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
