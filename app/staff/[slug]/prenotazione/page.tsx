import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';

import {createServerClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';
export default async function ManualBooking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {slug}=await params;const session=await createServerClient();const user=await session.auth.getUser();
 if(!user.data.user)redirect(`/staff/${encodeURIComponent(slug)}/login`);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const access=await session.rpc('prenow_staff_agenda',{p_slug:slug,p_date:today});
 if(access.error||!access.data||!['tenant_admin','staff'].includes(access.data.role))return <main className="booking"><h1>Accesso non autorizzato</h1><p>La prenotazione manuale è riservata a staff e responsabili.</p></main>;
 const salon=await session.from('tenants').select('id').eq('slug',slug).maybeSingle();if(salon.error||!salon.data)notFound();
 const id=salon.data.id;
 const q=await searchParams,db=await createServerClient(),path=`/staff/${encodeURIComponent(slug)}/prenotazione`;
 const [tenant,services,operators,customers]=await Promise.all([
 db.from('tenants').select('nome,slug').eq('id',id).maybeSingle(),
 db.from('services').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('nome'),
 db.from('operators').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('nome'),
 db.from('customers').select('id,nome,cognome').eq('tenant_id',id).order('nome').limit(500)]);
 if([tenant,services,operators,customers].some(r=>r.error))throw new Error('Impossibile caricare la prenotazione manuale.');
 if(!tenant.data)notFound();
 let slots:{start_at:string}[]=[];let slotError=false;
 if(q.service&&q.operator&&q.date){
 const result=await db.rpc('prenow_customer_slots',{p_slug:tenant.data.slug,p_service:q.service,p_operator:q.operator,p_date:q.date});
 slots=result.data||[];slotError=!!result.error;
 }
 async function book(form:FormData){
 'use server';const db=await createServerClient();
 const result=await db.rpc('prenow_staff_book',{p_tenant:id,p_service:String(form.get('service')),p_operator:String(form.get('operator')),p_start:String(form.get('start')),p_customer:String(form.get('customer')),p_note:String(form.get('note')||'')});
 const back=new URLSearchParams({service:String(form.get('service')),operator:String(form.get('operator')),date:String(form.get('date'))});
 if(result.error || !result.data){back.set('error',result.error?.code==='PGRST202'?'Funzione non installata: collaudare setup/remaining-management.sql nel database di test.':'Prenotazione non salvata. L’orario potrebbe non essere più disponibile.');redirect(path+'?'+back);}
 redirect(`/staff/${encodeURIComponent(slug)}?date=${form.get('date')}`);
 }
 const fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 return <><Link href={`/staff/${encodeURIComponent(slug)}`}>← Agenda staff</Link><h1>{tenant.data.nome}: prenotazione manuale</h1><p>Usa un cliente già presente nel salone. Sono rispettati orari, assegnazioni, chiusure e disponibilità.</p>
 {q.error&&<p role="alert">{q.error}</p>}
 <form method="get" className="settings-card"><label>Servizio <select required name="service" defaultValue={q.service}><option value="">Seleziona</option>{services.data?.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label><label>Operatore <select required name="operator" defaultValue={q.operator}><option value="">Seleziona</option>{operators.data?.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label><label>Data <input required type="date" name="date" defaultValue={q.date}/></label><button className="btn btn-primary">Cerca orari</button></form>
 {slotError&&<p role="alert">Controlla servizio, operatore e data.</p>}
 {q.date&&!slotError&&!slots.length&&<p>Nessun orario disponibile: verifica anche l’associazione tra operatore e servizio.</p>}
 {!!slots.length&&<form action={book} className="settings-card"><input type="hidden" name="service" value={q.service}/><input type="hidden" name="operator" value={q.operator}/><input type="hidden" name="date" value={q.date}/>
 <label>Orario <select required name="start">{slots.map(s=><option key={s.start_at} value={s.start_at}>{fmt.format(new Date(s.start_at))}</option>)}</select></label><label>Cliente <select name="customer" required><option value="">Seleziona cliente</option>{customers.data?.map(c=><option key={c.id} value={c.id}>{c.nome} {c.cognome}</option>)}</select></label><p>Elenco limitato ai primi 500 clienti.</p><label>Note interne <textarea name="note" maxLength={1000}/></label><button className="btn btn-primary">Conferma prenotazione</button></form>}</>;
}
