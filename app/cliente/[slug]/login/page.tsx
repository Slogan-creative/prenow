'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {createBrowserSupabaseClient} from '@/lib/supabase/client';
export default function Login(){
 const {slug}=useParams<{slug:string}>();const [signup,setSignup]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setMessage('');const f=new FormData(e.currentTarget);let navigating=false;
 try{const db=createBrowserSupabaseClient();const email=String(f.get('email')).trim();const password=String(f.get('password'));
 const r=signup?await db.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/cliente/${slug}/login`,data:{nome:String(f.get('nome')||'').trim(),cognome:String(f.get('cognome')||'').trim(),telefono:String(f.get('telefono')||'').trim()}}}):await db.auth.signInWithPassword({email,password});
 if(r.error){setMessage(signup?'Registrazione non riuscita. Controlla i dati inseriti.':'Accesso non riuscito. Controlla le credenziali e conferma la tua email.');return;}
 if(!r.data.session){setMessage('Controlla la tua casella email per confermare la registrazione. Poi torna qui e accedi.');return;}
 window.location.replace(`/cliente/${encodeURIComponent(slug)}`);navigating=true;}catch{setMessage('Collegamento non disponibile. Riprova.');}finally{if(!navigating)setBusy(false);}}
 return <main className="claude-page login-page"><header className="claude-titlebar"><Link href={`/cliente/${slug}`} className="round-back">‹</Link><h1>{signup?'Crea account':'Accedi'}</h1></header>
 <section className="login-content"><h2>{signup?'Crea il tuo profilo':'Bentornato'}</h2><p>{signup?'Inserisci i tuoi dati per prenotare.':'Accedi per gestire i tuoi appuntamenti.'}</p><form onSubmit={submit} className="claude-card form-card">
 {signup&&<><label>Nome<input name="nome" autoComplete="given-name" required/></label><label>Cognome<input name="cognome" autoComplete="family-name" required/></label><label>Cellulare<input name="telefono" type="tel" autoComplete="tel" required/></label></>}
 <label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={8} autoComplete={signup?'new-password':'current-password'} required/></label>
 {message&&<p role="status" className="form-message">{message}</p>}<button disabled={busy} className="claude-primary">{busy?'Attendi…':signup?'Registrati':'Accedi'}</button></form>
 <button className="claude-secondary full" disabled={busy} onClick={()=>{setSignup(!signup);setMessage('')}}>{signup?'Ho già un account':'Crea un account'}</button></section></main>;
}
