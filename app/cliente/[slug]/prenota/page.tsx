import Link from 'next/link';
import BookingWizard from './BookingWizard';
import {redirect} from 'next/navigation';
import {createServerClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';

type Catalog={nome:string;services:{id:string;nome:string;durata:number;prezzo:number|null}[];operators:{id:string;nome:string;services:string[]}[]};

export default async function Booking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
 const {slug}=await params;
 const q=await searchParams;
 const session=await createServerClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user)redirect(`/cliente/${slug}/login`);

 const db=await createServerClient();
 const {data,error}=await db.rpc('prenow_customer_catalog',{p_slug:slug});
 if(error)return <main className="claude-page"><header className="claude-titlebar"><Link href={`/cliente/${slug}`} className="round-back">‹</Link><h1>Prenota</h1></header><p className="page-error">Le prenotazioni non sono disponibili al momento.</p></main>;
 const cat=data as Catalog;

 async function availability(service:string,operator:string,date:string){
  'use server';
  const db=await createServerClient();
  const {data,error}=await db.rpc('prenow_customer_slots',{p_slug:slug,p_service:service,p_operator:operator,p_date:date});
  return {slots:(data||[]) as {start_at:string}[],error:!!error};
 }

 async function book(f:FormData){
  'use server';
  const session=await createServerClient();
  const {data:{user}}=await session.auth.getUser();
  if(!user)redirect(`/cliente/${slug}/login`);
  const db=await createServerClient();
  const common={
   p_slug:slug,
   p_service:String(f.get('service')),
   p_operator:String(f.get('operator')),
   p_start:String(f.get('start')),
   p_nome:String(f.get('nome')),
   p_cognome:String(f.get('cognome')),
   p_telefono:String(f.get('telefono'))
  };
  const guest=user.is_anonymous===true;
  const result=guest
   ?await db.rpc('prenow_customer_book_guest',{...common,p_email:String(f.get('email'))})
   :await db.rpc('prenow_customer_book',common);
  const back=new URLSearchParams({
   service:String(f.get('service')),
   operator:String(f.get('operator')),
   date:String(f.get('date'))
  });
  if(result.error){
   back.set('error',guest?'Prenotazione non salvata. Controlla i dati; se questa email ha già un account, accedi prima di prenotare.':'Prenotazione non salvata. Controlla i dati e scegli un orario ancora disponibile.');
   redirect(`/cliente/${slug}/prenota?${back}`);
  }
  revalidatePath('/admin');
  revalidatePath(`/cliente/${slug}/appuntamenti`);
  redirect(`/cliente/${slug}/prenota?booking=${result.data}&service=${f.get('service')}&operator=${f.get('operator')}&date=${f.get('date')}&start=${encodeURIComponent(String(f.get('start')))}`);
 }

 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const meta=(user.user_metadata||{}) as Record<string,string>;
 const guest=user.is_anonymous===true;

 return <main className="claude-page booking-flow">
  {q.booking
   ?<>
    <header className="claude-titlebar"><Link href={`/cliente/${slug}`} className="round-back">‹</Link><h1>Prenota</h1></header>
    <section className="booking-success">
     <div className="success-check">✓</div>
     <h2>Appuntamento confermato</h2>
     <p>Trovi tutti i dettagli in “I miei appuntamenti”.</p>
     <div className="claude-card success-card"><strong>La prenotazione è stata registrata</strong><span>Codice: {q.booking}</span></div>
     <Link className="claude-primary" href={`/cliente/${slug}/appuntamenti`}>Vai ai miei appuntamenti</Link>
     <Link className="claude-secondary full" href={`/cliente/${slug}`}>Torna alla home</Link>
    </section>
   </>
   :<>
    {q.error&&<p role="alert" className="page-error">{q.error}</p>}
    <BookingWizard
     catalog={cat}
     today={today}
     homeHref={`/cliente/${slug}`}
     initial={{service:q.service||'',operator:q.operator||'',date:q.date||today}}
     profile={{
      nome:guest?'':meta.nome||'',
      cognome:guest?'':meta.cognome||'',
      email:guest?'':user.email||'',
      telefono:guest?'':meta.telefono||'',
      guest
     }}
     availability={availability}
     action={book}
    />
   </>}
 </main>;
}
