import Link from 'next/link';
import BookingDetails from './BookingDetails';
import {redirect} from 'next/navigation';

import {createServerClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
type Catalog={nome:string;services:{id:string;nome:string;durata:number;prezzo:number|null}[];operators:{id:string;nome:string;services:string[]}[]};
export default async function Booking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
 const {slug}=await params; const q=await searchParams;
 const session=await createServerClient(); const {data:{user}}=await session.auth.getUser(); if(!user)redirect(`/cliente/${slug}/login`);
 const db=await createServerClient();
 const {data,error}=await db.rpc('prenow_customer_catalog',{p_slug:slug});
 if(error) return <main className="booking"><Link href={`/cliente/${slug}`}>← Le mie prenotazioni</Link><h1>Prenotazione</h1><p>Le prenotazioni non sono disponibili al momento. Riprova più tardi.</p></main>;
 const cat=data as Catalog;
 const service=cat.services.find(s=>s.id===q.service);
 const operator=cat.operators.find(o=>o.id===q.operator && service && o.services.includes(service.id));
 let slots:{start_at:string}[]=[]; let slotError=false;
 if(service && operator && /^\d{4}-\d{2}-\d{2}$/.test(q.date||'')) {
  const r=await db.rpc('prenow_customer_slots',{p_slug:slug,p_service:service.id,p_operator:operator.id,p_date:q.date});
  slots=r.data||[];slotError=!!r.error;
 }
 async function book(f:FormData) {
  'use server';
  const session=await createServerClient(); const {data:{user}}=await session.auth.getUser(); if(!user)redirect(`/cliente/${slug}/login`);const db=await createServerClient();
  const {data,error}=await db.rpc('prenow_customer_book',{p_slug:slug,p_service:String(f.get('service')),p_operator:String(f.get('operator')),p_start:String(f.get('start')),p_nome:String(f.get('nome')),p_cognome:String(f.get('cognome')),p_telefono:String(f.get('telefono'))});
  const back=new URLSearchParams({service:String(f.get('service')),operator:String(f.get('operator')),date:String(f.get('date'))});
  if(error) {back.set('error','Prenotazione non salvata. Controlla i dati, la conferma email e scegli un orario ancora disponibile. Se il tuo profilo esiste già nel salone, contattalo per collegare l’account.');redirect(`/cliente/${slug}/prenota?${back}`);}
  revalidatePath('/admin');redirect(`/cliente/${slug}/prenota?booking=${data}`);
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main className="booking"><Link className="booking-back" href={`/cliente/${slug}`}>← Le mie prenotazioni</Link><span className="booking-eyebrow">PRENOTA IL TUO MOMENTO</span><h1>{cat.nome}</h1>
 {q.booking && <section role="status" className="settings-card"><div className="confirmation-mark">✓</div><h2>Appuntamento confermato</h2><p>Trovi tutti i dettagli nella tua area personale.</p><Link className="btn btn-primary" href={`/cliente/${slug}`}>Le mie prenotazioni</Link><p className="booking-reference">Codice: {q.booking}</p></section>}
 {q.error && <p role="alert" className="booking-error">{q.error}</p>}
 {!q.booking && <><form className="settings-card" method="get"><span className="booking-eyebrow">PASSAGGIO 1 DI 3</span><h2>Scegli il servizio</h2><fieldset className="choice-field"><legend>Servizi disponibili</legend><div className="service-grid">{cat.services.map(s=><label className="service-choice" key={s.id}><input type="radio" name="service" value={s.id} defaultChecked={service?.id===s.id} required/><span><strong>{s.nome}</strong><small>{s.durata} minuti</small>{s.prezzo!==null && <b>{new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(s.prezzo/100)}</b>}</span></label>)}</div></fieldset>
 <h2>Con chi e quando?</h2><div className="field"><label htmlFor="operator">Operatore</label><select id="operator" name="operator" defaultValue={q.operator||''} required><option value="">Scegli un operatore</option>{cat.operators.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></div><div className="field"><label htmlFor="date">Giorno</label><input id="date" type="date" name="date" min={today} defaultValue={q.date||today} required/></div><button className="btn btn-primary">Mostra gli orari disponibili</button><p>Puoi prenotare entro i prossimi 60 giorni. Tutti gli orari sono in ora italiana.</p></form>
 {q.service && q.operator && !operator && <p role="alert" className="booking-error">Questa combinazione di servizio e operatore non è disponibile.</p>}
 {service && operator && q.date && (slotError?<p role="alert" className="booking-error">Impossibile leggere gli orari. Riprova.</p>:!slots.length?<section className="settings-card"><h2>Nessun orario disponibile</h2><p>Scegli un altro giorno o un altro operatore.</p></section>:<BookingDetails action={book} service={service} operator={operator} date={q.date} slots={slots}/>)}</>}
 </main>;
}
