import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createServerClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const clean=(v:FormDataEntryValue|null,n=320)=>String(v||'').trim().slice(0,n);
export default async function ManualBooking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {slug}=await params,session=await createServerClient(),user=await session.auth.getUser();
 if(!user.data.user)redirect(`/staff/${encodeURIComponent(slug)}/login`);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const access=await session.rpc('prenow_staff_agenda',{p_slug:slug,p_date:today});
 if(access.error||!access.data||!['tenant_admin','staff'].includes(access.data.role))return <main className="booking"><h1>Accesso non autorizzato</h1><p>La prenotazione manuale è riservata a staff e responsabili.</p></main>;
 const salon=await session.from('tenants').select('id').eq('slug',slug).maybeSingle();if(salon.error||!salon.data)notFound();
 const id=salon.data.id,q=await searchParams,db=await createServerClient(),path=`/staff/${encodeURIComponent(slug)}/prenotazione`;
 const search=(q.customer_search||'').trim().toLowerCase(),mode=q.customer_mode==='nuovo'?'nuovo':'esistente';
 const [tenant,services,operators,customers]=await Promise.all([
  db.from('tenants').select('nome,slug').eq('id',id).maybeSingle(),
  db.from('services').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('ordine').order('created_at'),
  db.from('operators').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('nome'),
  db.from('customers').select('id,nome,cognome,email,telefono').eq('tenant_id',id).order('nome').limit(500)
 ]);
 if([tenant,services,operators,customers].some(r=>r.error))throw new Error('Impossibile caricare la prenotazione manuale.');if(!tenant.data)notFound();
 const filtered=(customers.data||[]).filter(c=>!search||`${c.nome} ${c.cognome||''} ${c.email||''} ${c.telefono||''}`.toLowerCase().includes(search));
 let slots:{start_at:string}[]=[],slotError=false;
 if(q.service&&q.operator&&q.date){const result=await db.rpc('prenow_customer_slots',{p_slug:tenant.data.slug,p_service:q.service,p_operator:q.operator,p_date:q.date});slots=result.data||[];slotError=!!result.error;}
 async function book(form:FormData){
  'use server';const db=await createServerClient();let customer=clean(form.get('customer'),36);
  if(form.get('customer_mode')==='nuovo'){
   const created=await db.rpc('prenow_staff_create_customer',{p_tenant:id,p_name:clean(form.get('nome'),120),p_surname:clean(form.get('cognome'),120),p_email:clean(form.get('email')).toLowerCase(),p_phone:clean(form.get('telefono'),25)});
   if(created.error||!created.data){redirect(path+'?error='+encodeURIComponent('Cliente non salvato. Controlla i dati.'));}customer=String(created.data);
  }
  const result=await db.rpc('prenow_staff_book',{p_tenant:id,p_service:clean(form.get('service'),36),p_operator:clean(form.get('operator'),36),p_start:clean(form.get('start'),60),p_customer:customer,p_note:clean(form.get('note'),1000)});
  const back=new URLSearchParams({service:clean(form.get('service')),operator:clean(form.get('operator')),date:clean(form.get('date'),10)});
  if(result.error||!result.data){back.set('error','Prenotazione non salvata. L’orario potrebbe non essere più disponibile.');redirect(path+'?'+back);}
  redirect(`/staff/${encodeURIComponent(slug)}?date=${form.get('date')}`);
 }
 const fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 const preserved=<><input type="hidden" name="service" value={q.service||''}/><input type="hidden" name="operator" value={q.operator||''}/><input type="hidden" name="date" value={q.date||''}/></>;
 return <><Link href={`/staff/${encodeURIComponent(slug)}`}>← Agenda staff</Link><h1>{tenant.data.nome}: prenotazione manuale</h1><p>Scegli un cliente esistente oppure creane uno nuovo. Orari, assegnazioni e disponibilità vengono sempre verificati.</p>
 {q.error&&<p role="alert">{q.error}</p>}
 <form method="get" className="settings-card"><label>Servizio <select required name="service" defaultValue={q.service}><option value="">Seleziona</option>{services.data?.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label><label>Operatore <select required name="operator" defaultValue={q.operator}><option value="">Seleziona</option>{operators.data?.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label><label>Data <input required type="date" name="date" defaultValue={q.date}/></label><button className="btn btn-primary">Cerca orari</button></form>
 {slotError&&<p role="alert">Controlla servizio, operatore e data.</p>}{q.date&&!slotError&&!slots.length&&<p>Nessun orario disponibile: verifica anche l’associazione tra operatore e servizio.</p>}
 {!!slots.length&&<form action={book} className="settings-card manual-booking-form">{preserved}<label>Orario <select required name="start">{slots.map(s=><option key={s.start_at} value={s.start_at}>{fmt.format(new Date(s.start_at))}</option>)}</select></label>
 <fieldset className="customer-mode"><legend>Cliente</legend><div className="owner-tabs"><Link className={mode==='esistente'?'active':''} href={`${path}?${new URLSearchParams({service:q.service||'',operator:q.operator||'',date:q.date||'',customer_mode:'esistente'})}`}>Cliente esistente</Link><Link className={mode==='nuovo'?'active':''} href={`${path}?${new URLSearchParams({service:q.service||'',operator:q.operator||'',date:q.date||'',customer_mode:'nuovo'})}`}>Nuovo cliente</Link></div>
 <input type="hidden" name="customer_mode" value={mode}/>
 {mode==='esistente'?<><label>Cerca<input name="customer_search" form="customer-search" placeholder="Nome, email o telefono"/></label><div className="customer-results">{filtered.map(c=><label key={c.id} className="customer-result"><input type="radio" required name="customer" value={c.id}/><span><b>{c.nome} {c.cognome||''}</b><small>{c.email||c.telefono||'Nessun contatto'}</small></span></label>)}</div></>:<div className="field-row"><label>Nome<input required name="nome"/></label><label>Cognome<input name="cognome"/></label><label>Email<input type="email" name="email"/></label><label>Telefono<input type="tel" name="telefono"/></label></div>}
 </fieldset><label>Note interne <textarea name="note" maxLength={1000}/></label><button className="btn btn-primary">Conferma prenotazione</button></form>}
 {mode==='esistente'&&!!slots.length&&<form id="customer-search" method="get" className="customer-search-form">{preserved}<input type="hidden" name="customer_mode" value="esistente"/></form>}</>;
}