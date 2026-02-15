import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useApp } from './contexts/AppContext';
import AppShell from './components/layout/AppShell';
import GrandparentShell from './components/layout/GrandparentShell';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import TrackingPage from './pages/TrackingPage';
import HistoryPage from './pages/HistoryPage';
import DetectivePage from './pages/DetectivePage';
import EmergencyPage from './pages/EmergencyPage';
import SettingsPage from './pages/SettingsPage';
import GrandparentEntryPage from './pages/GrandparentEntryPage';
import GrandparentHomePage from './pages/GrandparentHomePage';
import GrandparentSymptomsPage from './pages/GrandparentSymptomsPage';

function App() {
  const { state } = useApp();

  // Grandparent entry route — always accessible
  // (handled before login check so the QR link works without login)

  if (!state.loggedIn) {
    return (
      <Routes>
        <Route path="/g/:token" element={<GrandparentEntryPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Grandparent mode — simplified UI
  if (state.grandparentMode) {
    // Wait for Firestore to load the parent's data
    if (!state.firestoreReady || state.children.length === 0) {
      return (
        <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6 text-center">
          <Loader2 className="w-10 h-10 text-sage-500 animate-spin mb-4" />
          <p className="text-lg font-semibold text-gray-700">Daten werden geladen...</p>
          <p className="text-sm text-gray-400 mt-1">Bitte einen Moment Geduld.</p>
        </div>
      );
    }

    return (
      <Routes>
        <Route element={<GrandparentShell />}>
          <Route path="/" element={<GrandparentHomePage />} />
          <Route path="/symptoms" element={<GrandparentSymptomsPage />} />
          <Route path="/emergency" element={<EmergencyPage />} />
        </Route>
        <Route path="/track" element={<TrackingPage />} />
        <Route path="*" element={<GrandparentHomePage />} />
      </Routes>
    );
  }

  // Normal mode
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
