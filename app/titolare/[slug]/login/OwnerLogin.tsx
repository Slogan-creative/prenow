'use client';
import {useState} from 'react';
import {createBrowserSupabaseClient} from '@/lib/supabase/client';

export default function OwnerLogin({slug}:{slug:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[register,setRegister]=useState(false);
 return <main className="owner-login"><div><div className="owner-login-brand">Prenow</div><h1>{register?'Attiva il tuo accesso':'Gestisci la tua attività'}</h1><p>{register?'Usa la stessa email indicata dal titolare.':'Accedi come titolare, manager o operatore.'}</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');const f=new FormData(e.currentTarget),email=String(f.get('email')).trim().toLowerCase(),password=String(f.get('password')),db=createBrowserSupabaseClient();
 if(register){const result=await db.auth.signUp({email,password,options:{emailRedirectTo:`${window.location.origin}/titolare/${encodeURIComponent(slug)}`}});if(result.error){setError('Non è stato possibile creare l’accesso. Verifica email e password.');setBusy(false);return}if(result.data.session)window.location.replace(`/titolare/${encodeURIComponent(slug)}`);else{setMessage('Controlla la tua email per confermare l’account, poi torna qui per accedere.');setBusy(false)}return}
 const result=await db.auth.signInWithPassword({email,password});if(result.error){setError('Credenziali non valide.');setBusy(false);return}window.location.replace(`/titolare/${encodeURIComponent(slug)}`)}}>
 <label>Email<input name="email" type="email" required autoComplete="username"/></label><label>Password<input name="password" type="password" minLength={8} required autoComplete={register?'new-password':'current-password'}/></label>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<button disabled={busy}>{busy?(register?'Attivazione…':'Accesso…'):(register?'Crea accesso':'Accedi')}</button></form><button type="button" className="owner-login-switch" onClick={()=>{setRegister(!register);setError('');setMessage('')}}>{register?'Hai già un account? Accedi':'Sei stato invitato? Attiva il tuo accesso'}</button></div></main>;
}
