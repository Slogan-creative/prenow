'use client';
import {useState} from 'react';
import {createBrowserSupabaseClient} from '@/lib/supabase/client';
export default function StaffLogin({slug}:{slug:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <main className="booking"><h1>Accesso staff</h1><p>{slug}</p><form onSubmit={async e=>{
 e.preventDefault();if(busy)return;setBusy(true);setError('');
 try{const f=new FormData(e.currentTarget),db=createBrowserSupabaseClient();const r=await db.auth.signInWithPassword({email:String(f.get('email')),password:String(f.get('password'))});
 if(r.error)throw new Error('Credenziali non valide o servizio non disponibile.');
 const verified=await db.auth.getUser();if(verified.error||!verified.data.user)throw new Error('Sessione non verificata. Riprova.');
 window.location.replace(`/staff/${encodeURIComponent(slug)}`);
 }catch(e){setError(e instanceof Error?e.message:'Accesso non riuscito.');setBusy(false);}
 }} className="settings-card"><label>Email <input type="email" name="email" required autoComplete="username"/></label><label>Password <input type="password" name="password" required autoComplete="current-password"/></label><button className="btn btn-primary" disabled={busy}>{busy?'Accesso in corso…':'Accedi'}</button>{error&&<p role="alert">{error}</p>}</form><p>Questo accesso non abilita alla dashboard Super Admin.</p></main>;
}
