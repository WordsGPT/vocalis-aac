import React, { useEffect, useState } from 'react';
import App from './App.jsx';

export default function AuthGate() {
  const [authenticated, setAuthenticated] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    fetch('/api/session')
      .then(response => {
        if (!response.ok) return { authenticated: true, auth_required: false };
        return response.json();
      })
      .then(data => {
        if (!data) return;
        if (data.auth_required === false) {
          setAuthenticated(true);
          setAuthRequired(false);
        } else {
          setAuthenticated(!!data.authenticated);
          setAuthRequired(true);
        }
      })
      .catch(() => {
        setAuthenticated(true);
        setAuthRequired(false);
      });
    const expired = () => {
      if (authRequired) setAuthenticated(false);
    };
    window.addEventListener('vocalis:unauthorized', expired);
    return () => window.removeEventListener('vocalis:unauthorized', expired);
  }, [authRequired]);

  const login = async (username, password) => {
    const response = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || 'No se pudo iniciar sesión.');
    }
    setAuthenticated(true);
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setAuthenticated(false);
  };

  return <App voiceAuthenticated={authenticated} authRequired={authRequired} onVoiceLogin={login} onLogout={logout} />;
}
