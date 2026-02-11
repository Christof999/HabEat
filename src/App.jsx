import { Routes, Route } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import AppShell from './components/layout/AppShell';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import TrackingPage from './pages/TrackingPage';
import HistoryPage from './pages/HistoryPage';
import DetectivePage from './pages/DetectivePage';
import EmergencyPage from './pages/EmergencyPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const { state } = useApp();

  if (!state.onboardingComplete || state.children.length === 0) {
    return <OnboardingPage />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/detective" element={<DetectivePage />} />
        <Route path="/emergency" element={<EmergencyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/track" element={<TrackingPage />} />
    </Routes>
  );
}

export default App;
