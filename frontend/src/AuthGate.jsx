import React, { useEffect, useState } from 'react';
import App from './App.jsx';

export default function AuthGate() {
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    fetch('/api/session').then(response => response.json()).then(data => setAuthenticated(!!data.authenticated))
      .catch(() => setAuthenticated(false));
    const expired = () => setAuthenticated(false);
    window.addEventListener('vocalis:unauthorized', expired);
    return () => window.removeEventListener('vocalis:unauthorized', expired);
  }, []);

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

  return <App voiceAuthenticated={authenticated} onVoiceLogin={login} onLogout={logout} />;
}
