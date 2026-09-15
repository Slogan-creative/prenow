'use client';

import {useState} from 'react';
import {createBrowserSupabaseClient} from '@/lib/supabase/client';

type Props={slug:string;logo:string|null};

export default function LoginForm({slug,logo}:Props){
 const [signup,setSignup]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  setBusy(true);
  setMessage('');
  const f=new FormData(e.currentTarget);
  let navigating=false;
  try{
   const db=createBrowserSupabaseClient();
   const email=String(f.get('email')).trim();
   const password=String(f.get('password'));
   const r=signup
    ?await db.auth.signUp({
      email,
      password,
      options:{
       emailRedirectTo:`${window.location.origin}/cliente/${slug}/login`,
       data:{
        nome:String(f.get('nome')||'').trim(),
        cognome:String(f.get('cognome')||'').trim(),
        telefono:String(f.get('telefono')||'').trim()
       }
      }
     })
    :await db.auth.signInWithPassword({email,password});
   if(r.error){
    setMessage(signup?'Registrazione non riuscita. Controlla i dati inseriti.':'Accesso non riuscito. Controlla le credenziali e conferma la tua email.');
    return;
   }
   if(!r.data.session){
    setMessage('Controlla la tua casella email per confermare la registrazione. Poi torna qui e accedi.');
    return;
   }
   window.location.replace(`/cliente/${encodeURIComponent(slug)}`);
   navigating=true;
  }catch{
   setMessage('Collegamento non disponibile. Riprova.');
  }finally{
   if(!navigating)setBusy(false);
  }
 }

 async function continueAsGuest(){
  if(busy)return;
  setBusy(true);
  setMessage('');
  let navigating=false;
  try{
   const db=createBrowserSupabaseClient();
   const {data,error}=await db.auth.signInAnonymously();
   if(error||!data.session){
    setMessage('La modalità senza registrazione non è disponibile al momento. Riprova tra poco.');
    return;
   }
   window.location.replace(`/cliente/${encodeURIComponent(slug)}/prenota`);
   navigating=true;
  }catch{
   setMessage('Collegamento non disponibile. Riprova.');
  }finally{
   if(!navigating)setBusy(false);
  }
 }

 return <main className="claude-page login-page">
  <header className="claude-titlebar">
   <button type="button" className="round-back" aria-label="Torna alla home" onClick={()=>window.location.assign(`/cliente/${encodeURIComponent(slug)}`)}>‹</button>
   <h1>{signup?'Registrati':'Accedi'}</h1>
  </header>
  <section className="login-content">
   {logo&&<div className="hero-logo-wrap"><img className="brand-logo" src={logo} alt="Venus Parrucchieri"/></div>}
   <h2>{signup?'Crea il tuo profilo':'Come vuoi continuare?'}</h2>
   <p>{signup?'Inserisci i tuoi dati una sola volta: saranno già disponibili durante la prenotazione.':'Accedi, crea un account oppure prenota senza registrarti.'}</p>
   <form onSubmit={submit} className="claude-card form-card">
    {signup&&<>
     <label>Nome<input name="nome" autoComplete="given-name" maxLength={120} required/></label>
     <label>Cognome<input name="cognome" autoComplete="family-name" maxLength={120} required/></label>
    </>}
    <label>Email<input name="email" type="email" autoComplete="email" required/></label>
    {signup&&<label>Cellulare<input name="telefono" type="tel" autoComplete="tel" maxLength={25} required/></label>}
    <label>Password<input name="password" type="password" minLength={8} autoComplete={signup?'new-password':'current-password'} required/></label>
    {message&&<p role="status" className="form-message">{message}</p>}
    <button disabled={busy} className="claude-primary">{busy?'Attendi…':signup?'Registrati':'Accedi'}</button>
   </form>
   <button type="button" className="claude-secondary full" disabled={busy} onClick={()=>{setSignup(!signup);setMessage('')}}>
    {signup?'Ho già un account':'Registrati'}
   </button>
   <button type="button" className="claude-secondary full" style={{marginTop:12}} disabled={busy} onClick={continueAsGuest}>
    Continua senza registrazione
   </button>
   <p className="form-message">Senza account inserirai i dati di contatto al termine della prenotazione.</p>
  </section>
 </main>;
}
