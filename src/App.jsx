import { Routes, Route } from 'react-router-dom';
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
    if (state.children.length === 0) {
      return (
        <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-5xl mb-4">😕</span>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Noch keine Kinder angelegt</h1>
          <p className="text-gray-500 mb-6">Die Eltern müssen zuerst ein Kind in der App anlegen.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-sage-500 text-white rounded-xl font-semibold cursor-pointer"
          >
            Erneut versuchen
          </button>
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
