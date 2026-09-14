import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
type Catalog={nome:string;services:{id:string;nome:string;durata:number;prezzo:number|null}[];operators:{id:string;nome:string;services:string[]}[]};
export default async function Booking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
 await requirePlatformAdmin();
 const {slug}=await params; const q=await searchParams;
 const db=await createServerClient();
 const {data,error}=await db.rpc('prenow_test_catalog',{p_slug:slug});
 if(error) return <main className="booking"><Link href="/admin/applicazioni">← Dashboard</Link><h1>Prenotazione di prova</h1><p>Configurazione prenotazioni non disponibile. Esegui prima la query setup/booking-test.sql.</p></main>;
 const cat=data as Catalog;
 const service=cat.services.find(s=>s.id===q.service);
 const operator=cat.operators.find(o=>o.id===q.operator && service && o.services.includes(service.id));
 let slots:{start_at:string}[]=[]; let slotError=false;
 if(service && operator && /^\d{4}-\d{2}-\d{2}$/.test(q.date||'')) {
  const r=await db.rpc('prenow_test_slots',{p_slug:slug,p_service:service.id,p_operator:operator.id,p_date:q.date});
  slots=r.data||[];slotError=!!r.error;
 }
 async function book(f:FormData) {
  'use server';
  await requirePlatformAdmin();const db=await createServerClient();
  const {data,error}=await db.rpc('prenow_test_book',{p_slug:slug,p_service:String(f.get('service')),p_operator:String(f.get('operator')),p_start:String(f.get('start')),p_nome:String(f.get('nome')),p_cognome:String(f.get('cognome')),p_email:String(f.get('email')),p_telefono:String(f.get('telefono'))});
  const back=new URLSearchParams({service:String(f.get('service')),operator:String(f.get('operator')),date:String(f.get('date'))});
  if(error) {back.set('error','Prenotazione non salvata. Controlla i dati e scegli un orario ancora disponibile.');redirect(`/prenota/${slug}?${back}`);}
  revalidatePath('/admin');redirect(`/prenota/${slug}?booking=${data}`);
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main className="booking"><Link href="/admin/applicazioni">← Dashboard</Link><h1>{cat.nome}</h1><p>Collaudo riservato al Super Admin. Gli appuntamenti vengono salvati realmente. Usa dati di prova.</p>
 {q.booking && <section role="status" className="settings-card"><h2>Prenotazione confermata</h2><p>Codice: {q.booking}</p><Link href={`/prenota/${slug}`}>Nuova prenotazione</Link></section>}
 {q.error && <p role="alert" style={{color:'var(--danger)'}}>{q.error}</p>}
 {!q.booking && <><form className="settings-card" method="get"><h2>1. Servizio e operatore</h2><div className="field"><label htmlFor="service">Servizio</label><select id="service" name="service" defaultValue={q.service||''} required><option value="">Scegli un servizio</option>{cat.services.map(s=><option key={s.id} value={s.id}>{s.nome} · {s.durata} min{s.prezzo===null?'':` · € ${(s.prezzo/100).toFixed(2)}`}</option>)}</select></div>
 <div className="field"><label htmlFor="operator">Operatore</label><select id="operator" name="operator" defaultValue={q.operator||''} required><option value="">Scegli un operatore</option>{cat.operators.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></div><div className="field"><label htmlFor="date">Giorno</label><input id="date" type="date" name="date" min={today} defaultValue={q.date||today} required/></div><button className="btn btn-primary">Mostra disponibilità</button><p>Disponibilità per i prossimi 60 giorni, in ora italiana.</p></form>
 {q.service && q.operator && !operator && <p role="alert">Questa combinazione di servizio e operatore non è disponibile.</p>}
 {service && operator && q.date && <section className="settings-card"><h2>2. Orario e dati del cliente</h2><p>{service.nome} · {operator.nome} · {q.date} · {service.durata} minuti</p>{slotError?<p role="alert">Impossibile leggere gli orari. Riprova.</p>:!slots.length?<p>Nessun orario disponibile per questo giorno. Scegli un altro giorno.</p>:<form action={book}>
 <input type="hidden" name="service" value={service.id}/><input type="hidden" name="operator" value={operator.id}/><input type="hidden" name="date" value={q.date}/>
 <div className="field"><label htmlFor="start">Orario disponibile</label><select name="start" id="start" required>{slots.map(s=><option key={s.start_at} value={s.start_at}>{new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(s.start_at))}</option>)}</select></div>
 {['nome','cognome','email','telefono'].map(key=><div className="field" key={key}><label htmlFor={key}>{({nome:'Nome',cognome:'Cognome',email:'Email',telefono:'Cellulare'} as Record<string,string>)[key]}</label><input id={key} name={key} type={key==='email'?'email':key==='telefono'?'tel':'text'} maxLength={key==='email'?254:key==='telefono'?25:120} required/></div>)}
 <button className="btn btn-primary">Conferma prenotazione di prova</button></form>}</section>}</>}
 </main>;
}
