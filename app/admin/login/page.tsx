'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// Login reale: password verificata da Supabase Auth (hash sicuro, gestito da
// loro), non più il confronto in chiaro che c'era nel prototipo HTML.
// Dopo il login, è comunque requirePlatformAdmin() (lato server) a decidere
// se questa persona può entrare in /admin — un login riuscito non basta da
// solo, deve anche avere una riga in platform_admins.
export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (caricamento) return;
    setErrore(null);
    setCaricamento(true);
    try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErrore('Email o password non corretti.');
      setCaricamento(false);
      return;
    }
    if (!data.session) {
      setErrore('Sessione non disponibile. Riprova.');
      setCaricamento(false);
      return;
    }
    // Richiesta completa con i cookie appena salvati, senza cache del router.
    window.location.replace('/admin');
    } catch {
      setErrore('Collegamento non disponibile. Riprova.');
      setCaricamento(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', padding: 24 }}>
      <h1 className="page-title">Accesso Super Admin</h1>
      <form onSubmit={handleSubmit} className="field" style={{ marginTop: 20 }}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {errore && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{errore}</p>}
        <button className="btn btn-primary" type="submit" disabled={caricamento} style={{ width: '100%' }}>
          {caricamento ? 'Accesso in corso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}
