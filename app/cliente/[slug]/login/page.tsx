'use client';
import {useState} from 'react';
import {useParams} from 'next/navigation';
import {createBrowserSupabaseClient} from '@/lib/supabase/client';
export default function Login(){
 const {slug}=useParams<{slug:string}>();const [signup,setSignup]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setMessage('');const f=new FormData(e.currentTarget);let navigating=false;
 try{const db=createBrowserSupabaseClient();const email=String(f.get('email')).trim();const password=String(f.get('password'));const r=signup?await db.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/cliente/${slug}/login`}}):await db.auth.signInWithPassword({email,password});
 if(r.error){setMessage(signup?'Registrazione non riuscita. Controlla email e password.':'Accesso non riuscito. Controlla le credenziali e conferma prima la tua email.');return;}
 if(!r.data.session){setMessage('Controlla la tua casella email per confermare la registrazione. Poi torna qui e accedi.');return;}
 window.location.replace(`/cliente/${encodeURIComponent(slug)}`);navigating=true;}catch{setMessage('Collegamento non disponibile. Riprova.');}finally{if(!navigating)setBusy(false);}}
 return <main className="booking"><h1>{signup?'Crea il tuo account':'Accedi'}</h1><p>Area clienti · {slug}</p><form onSubmit={submit} className="settings-card"><div className="field"><label htmlFor="email">Email</label><input name="email" id="email" type="email" autoComplete="email" required/></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" minLength={8} autoComplete={signup?'new-password':'current-password'} required/></div>{message && <p role="status">{message}</p>}<button disabled={busy} className="btn btn-primary">{busy?'Attendi…':signup?'Registrati':'Accedi'}</button></form><button className="btn btn-secondary" disabled={busy} onClick={()=>{setSignup(!signup);setMessage('');}}>{signup?'Ho già un account':'Crea un account'}</button></main>;
}
