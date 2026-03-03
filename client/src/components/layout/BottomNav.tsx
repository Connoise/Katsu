import { NavLink } from 'react-router-dom';
import { Clock, FolderKanban, CalendarDays, LayoutDashboard, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

const mobileNavItems = [
  { to: '/', icon: Clock, label: 'Today' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-katsu-surface border-t border-katsu-border z-50">
      <div className="flex justify-around items-center h-16">
        {mobileNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors',
                isActive ? 'text-katsu-accent' : 'text-katsu-text-dim'
              )
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
