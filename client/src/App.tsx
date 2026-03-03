import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { TodayPage } from './pages/TodayPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { CalendarPage } from './pages/CalendarPage';
import { FocusPage } from './pages/FocusPage';
import { NotesPage } from './pages/NotesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SettingsPage } from './pages/SettingsPage';
import { UndoProvider } from './contexts/UndoContext';
import { KeyboardProvider } from './contexts/KeyboardContext';

export default function App() {
  return (
    <BrowserRouter>
      <KeyboardProvider>
        <UndoProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<TodayPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/focus" element={<FocusPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </UndoProvider>
      </KeyboardProvider>
    </BrowserRouter>
  );
}
