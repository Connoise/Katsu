import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface FABOption {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
}

interface FloatingActionButtonProps {
  options: FABOption[];
}

export function FloatingActionButton({ options }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOptionClick = (option: FABOption) => {
    setIsOpen(false);
    option.onClick();
  };

  return (
    <div ref={containerRef} className="md:hidden fixed bottom-20 right-4 z-40">
      {/* Popup menu */}
      <div
        className="absolute bottom-14 right-0 flex flex-col gap-1 min-w-[160px]"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.95)',
          transition: 'opacity 150ms ease, transform 150ms ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div className="bg-katsu-surface border border-katsu-border rounded-lg shadow-lg overflow-hidden">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.label}
                onClick={() => handleOptionClick(option)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-katsu-text hover:bg-katsu-surface-2 transition-colors"
              >
                <Icon size={16} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FAB button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-12 h-12 rounded-full bg-katsu-accent text-black flex items-center justify-center shadow-lg hover:bg-katsu-accent-hover transition-all"
        style={{
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 200ms ease',
        }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

export type { FABOption, FloatingActionButtonProps };
