import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, CalendarDays,
  Timer, BookOpen, Layout, Clock, Settings
} from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: Clock, label: 'Today' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/focus', icon: Timer, label: 'Focus' },
  { to: '/notes', icon: BookOpen, label: 'Notes' },
  { to: '/templates', icon: Layout, label: 'Templates' },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 bg-katsu-surface border-r border-katsu-border h-screen sticky top-0">
      <div className="p-4 border-b border-katsu-border">
        <h1 className="text-xl font-bold text-katsu-accent tracking-tight">Katsu</h1>
        <p className="text-xs text-katsu-text-dim mt-0.5">Creative Project Manager</p>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-katsu-surface-2 text-katsu-accent border-r-2 border-katsu-accent'
                  : 'text-katsu-text-muted hover:text-katsu-text hover:bg-katsu-surface-2'
              )
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-katsu-border">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
              isActive
                ? 'bg-katsu-surface-2 text-katsu-accent'
                : 'text-katsu-text-muted hover:text-katsu-text hover:bg-katsu-surface-2'
            )
          }
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
