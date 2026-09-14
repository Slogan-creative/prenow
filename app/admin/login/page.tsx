'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// Login reale: password verificata da Supabase Auth (hash sicuro, gestito da
// loro), non più il confronto in chiaro che c'era nel prototipo HTML.
// Dopo il login, è comunque requirePlatformAdmin() (lato server) a decidere
// se questa persona può entrare in /admin — un login riuscito non basta da
// solo, deve anche avere una riga in platform_admins.
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCaricamento(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCaricamento(false);
    if (error) {
      setErrore('Email o password non corretti.');
      return;
    }
    router.push('/admin');
    router.refresh(); // forza il layout server a rileggere la sessione
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
