import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from './api';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'has@mccullochjewellers.co.uk';
const PIN_LENGTH = 4;

export default function Login() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = async (digit: string) => {
    if (loading) return;
    const next = pin + digit;
    setPin(next);
    setError('');

    if (next.length === PIN_LENGTH) {
      setLoading(true);
      try {
        const { token } = await api.login(ADMIN_EMAIL, next);
        setToken(token);
        navigate('/');
      } catch {
        setError('Incorrect PIN');
        triggerShake();
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (loading) return;
    setPin(p => p.slice(0, -1));
    setError('');
  };

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => (
    <div key={i} className={`pin-dot ${i < pin.length ? 'pin-dot--filled' : ''}`} />
  ));

  const keys = ['1','2','3','4','5','6','7','8','9'];

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">McCulloch</div>
        <div className="login-sub">Valuation Manager</div>

        <div className={`pin-display ${shake ? 'pin-display--shake' : ''}`}>
          {dots}
        </div>

        {error && <div className="login-error" style={{ textAlign: 'center', marginBottom: 16 }}>{error}</div>}

        <div className="pin-grid">
          {keys.map(k => (
            <button
              key={k}
              type="button"
              className="pin-key"
              onClick={() => handleDigit(k)}
              disabled={loading || pin.length >= PIN_LENGTH}
            >
              {k}
            </button>
          ))}
          <button type="button" className="pin-key pin-key--ghost" disabled />
          <button
            type="button"
            className="pin-key"
            onClick={() => handleDigit('0')}
            disabled={loading || pin.length >= PIN_LENGTH}
          >
            0
          </button>
          <button
            type="button"
            className="pin-key pin-key--back"
            onClick={handleBack}
            disabled={loading || pin.length === 0}
            aria-label="Backspace"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
