import React, { useState } from 'react';

export function AccessPanel({ authenticated, onLogin, onLogout }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  if (authenticated) return <div className="rounded-xl border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-slate-200">
    <p className="m-0 mb-2">Sesión iniciada. Puedes usar los servicios de voz y respuestas de IA.</p>
    <button type="button" onClick={onLogout} className="text-emerald-200 underline">Cerrar sesión</button>
  </div>;
  return <form className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200"
    onSubmit={async event => {
      event.preventDefault();
      setError('');
      try { await onLogin(username, password); setPassword(''); }
      catch (problem) { setError(problem.message); }
    }}>
    <h3 className="font-bold m-0">Acceso a servicios de IA</h3>
    <p className="text-xs text-slate-400">Sin iniciar sesión, Vocalis usa la voz y el reconocimiento del navegador y respuestas básicas. Inicia sesión para usar Groq y Gemini.</p>
    <input aria-label="Usuario" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)}
      placeholder="Usuario" className="block w-full mb-2 p-2 rounded bg-slate-800" />
    <input aria-label="Contraseña" type="password" autoComplete="current-password" required value={password}
      onChange={event => setPassword(event.target.value)} placeholder="Contraseña"
      className="block w-full mb-2 p-2 rounded bg-slate-800" />
    <button type="submit" className="w-full p-2 rounded bg-violet-600 font-bold">Entrar</button>
    {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
  </form>;
}
