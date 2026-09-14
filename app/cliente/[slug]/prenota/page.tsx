import Link from 'next/link';
import BookingWizard from './BookingWizard';
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
 async function availability(service:string,operator:string,date:string) {
  'use server';
  const db=await createServerClient();
  const {data,error}=await db.rpc('prenow_customer_slots',{p_slug:slug,p_service:service,p_operator:operator,p_date:date});
  return {slots:(data||[]) as {start_at:string}[],error:!!error};
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
 {!q.booking && <BookingWizard catalog={cat} today={today} initial={{service:q.service||'',operator:q.operator||'',date:q.date||today}} availability={availability} action={book}/>}
 </main>;
}
