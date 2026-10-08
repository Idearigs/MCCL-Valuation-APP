import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthStatus } from '@mccl/shared';
import { api, ApiError } from './api';

export default function Login() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    api.status().then(s => {
      if (s.user) navigate('/', { replace: true });
      else setStatus(s);
    }).catch(() => setError('Cannot reach the server'));
  }, []);

  // Count down a short cooldown after repeated wrong PINs.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const PIN_LENGTH = status?.pinLength ?? 4;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = async (digit: string) => {
    if (loading || cooldown > 0) return;
    const next = pin + digit;
    setPin(next);
    setError('');

    if (next.length === PIN_LENGTH) {
      setLoading(true);
      try {
        await api.pinLogin(next);
        navigate('/');
      } catch (err) {
        const retryAfter = err instanceof ApiError ? Number(err.body?.retryAfter) || 0 : 0;
        if (retryAfter > 0) setCooldown(retryAfter);
        setError('Incorrect PIN');
        triggerShake();
        setPin('');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!status) {
    return <div className="login-shell"><div className="login-card">{error || 'Loading…'}</div></div>;
  }

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

        {error && (
          <div className="login-error" style={{ textAlign: 'center', marginBottom: 16 }}>
            {error}{cooldown > 0 && ` — try again in ${cooldown}s`}
          </div>
        )}

        <div className="pin-grid">
          {keys.map(k => (
            <button
              key={k}
              type="button"
              className="pin-key"
              onClick={() => handleDigit(k)}
              disabled={loading || cooldown > 0 || pin.length >= PIN_LENGTH}
            >
              {k}
            </button>
          ))}
          <button type="button" className="pin-key pin-key--ghost" disabled />
          <button
            type="button"
            className="pin-key"
            onClick={() => handleDigit('0')}
            disabled={loading || cooldown > 0 || pin.length >= PIN_LENGTH}
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

