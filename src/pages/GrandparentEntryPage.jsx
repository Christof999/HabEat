import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function GrandparentEntryPage() {
  const { token } = useParams();
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const username = atob(token);
      if (!username) throw new Error('Invalid token');

      dispatch({
        type: 'SET_GRANDPARENT_MODE',
        payload: { username },
      });
      navigate('/', { replace: true });
    } catch {
      setError(true);
    }
  }, [token, dispatch, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">😕</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Ungültiger Link</h1>
        <p className="text-gray-500">
          Dieser Einladungslink ist leider nicht gültig.
          Bitte die Eltern um einen neuen QR-Code.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-sage-500 animate-spin" />
    </div>
  );
}
