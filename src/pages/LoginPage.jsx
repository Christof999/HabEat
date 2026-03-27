import { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const VALID_USERS = [
  { username: 'Daniela', password: 'Admin' },
  { username: 'Peter', password: 'Admin' },
  { username: 'Teste', password: 'Admin' },
  { username: 'Svenja', password: 'Admin' },
  { username: 'Felix', password: 'Admin' },
  { username: 'Thomas', password: 'admin' },
  { username: 'Martina', password: 'admin' },
];

export default function LoginPage() {
  const { dispatch } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const match = VALID_USERS.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase()
        && u.password === password
    );

    if (match) {
      dispatch({
        type: 'SET_LOGGED_IN',
        payload: { username: match.username },
      });
    } else {
      setError('Benutzername oder Passwort ist falsch.');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <span className="text-4xl">🥕</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800">HabEat</h1>
        <p className="text-gray-400 text-sm mt-1">Ernährungstracking für dein Kind</p>
      </div>

      {/* Login Card */}
      <div className={`w-full max-w-sm bg-white rounded-3xl shadow-sm p-6 space-y-5 ${shaking ? 'animate-shake' : ''}`}>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Willkommen zurück</h2>
          <p className="text-sm text-gray-400 mt-0.5">Melde dich an, um fortzufahren.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" />
              Benutzername
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="z. B. Daniela, Peter, Teste"
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl bg-warm-50 border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4" />
              Passwort
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Passwort eingeben"
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-warm-50 border border-sage-200 focus:outline-none focus:ring-2 focus:ring-sage-300 transition text-gray-800 placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-sage-500 hover:bg-sage-600 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm cursor-pointer"
          >
            Anmelden
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-300 mt-8">Testversion · v1.0.0</p>
    </div>
  );
}
