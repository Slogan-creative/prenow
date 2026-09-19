import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createServerClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';
const clean=(v:FormDataEntryValue|null,n=320)=>String(v||'').trim().slice(0,n);
const CUSTOM='__custom__';

export default async function ManualBooking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {slug}=await params,session=await createServerClient(),user=await session.auth.getUser();
 if(!user.data.user)redirect(`/staff/${encodeURIComponent(slug)}/login`);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const access=await session.rpc('prenow_staff_agenda',{p_slug:slug,p_date:today});
 if(access.error||!access.data||!['tenant_admin','staff'].includes(access.data.role))return <main className="booking"><h1>Accesso non autorizzato</h1><p>La prenotazione manuale è riservata a staff e responsabili.</p></main>;
 const salon=await session.from('tenants').select('id').eq('slug',slug).maybeSingle();if(salon.error||!salon.data)notFound();
 const id=salon.data.id,q=await searchParams,db=await createServerClient(),path=`/staff/${encodeURIComponent(slug)}/prenotazione`;
 const search=(q.customer_search||'').trim().toLowerCase(),mode=q.customer_mode==='nuovo'?'nuovo':'esistente';
 const custom=q.service===CUSTOM;
 const customDuration=Number(q.custom_duration||0);
 const [tenant,services,operators,customers]=await Promise.all([
  db.from('tenants').select('nome,slug').eq('id',id).maybeSingle(),
  db.from('services').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('ordine').order('created_at'),
  db.from('operators').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('nome'),
  db.from('customers').select('id,nome,cognome,email,telefono').eq('tenant_id',id).order('nome').limit(500)
 ]);
 if([tenant,services,operators,customers].some(r=>r.error))throw new Error('Impossibile caricare la prenotazione manuale.');if(!tenant.data)notFound();
 const selectedCustomer=(customers.data||[]).find(c=>c.id===q.customer);
 const filtered=(customers.data||[]).filter(c=>!search||`${c.nome} ${c.cognome||''} ${c.email||''} ${c.telefono||''}`.toLowerCase().includes(search));
 let slots:{start_at:string}[]=[],slotError=false;
 if(q.service&&q.operator&&q.date){
  if(custom){
   if(!q.custom_name||!Number.isInteger(customDuration)||customDuration<5||customDuration>480){slotError=true;}
   else{
    const result=await db.rpc('prenow_staff_slots_custom',{p_tenant:id,p_operator:q.operator,p_date:q.date,p_duration:customDuration});
    slots=result.data||[];slotError=!!result.error;
   }
  }else{
   const result=await db.rpc('prenow_customer_slots',{p_slug:tenant.data.slug,p_service:q.service,p_operator:q.operator,p_date:q.date});
   slots=result.data||[];slotError=!!result.error;
  }
 }

 async function book(form:FormData){
  'use server';
  const db=await createServerClient();
  let customer=clean(form.get('customer'),36);
  const service=clean(form.get('service'),40);
  const isCustom=service===CUSTOM;
  const customName=clean(form.get('custom_name'),120);
  const duration=Number(form.get('custom_duration'));
  const priceRaw=clean(form.get('custom_price'),24).replace(',','.');
  const priceEuros=Number(priceRaw);
  const priceCents=Math.round(priceEuros*100);
  const baseBack:Record<string,string>={
   service,
   operator:clean(form.get('operator'),36),
   date:clean(form.get('date'),10),
   customer_mode:clean(form.get('customer_mode'),12)||'esistente'
  };
  if(isCustom){
   baseBack.custom_name=customName;
   baseBack.custom_duration=String(form.get('custom_duration')||'');
   baseBack.custom_price=String(form.get('custom_price')||'');
   if(!customName||!Number.isInteger(duration)||duration<5||duration>480||!Number.isFinite(priceEuros)||priceEuros<0){
    const back=new URLSearchParams(baseBack);back.set('error','Controlla nome, durata e prezzo del servizio personalizzato.');redirect(path+'?'+back);
   }
  }
  if(form.get('customer_mode')==='nuovo'){
   const created=await db.rpc('prenow_staff_create_customer',{p_tenant:id,p_name:clean(form.get('nome'),120),p_surname:clean(form.get('cognome'),120),p_email:clean(form.get('email')).toLowerCase(),p_phone:clean(form.get('telefono'),25)});
   if(created.error||!created.data){const back=new URLSearchParams(baseBack);back.set('error','Cliente non salvato. Controlla i dati.');redirect(path+'?'+back);}
   customer=String(created.data);
  }
  const result=isCustom
   ?await db.rpc('prenow_staff_book_custom',{p_tenant:id,p_operator:clean(form.get('operator'),36),p_start:clean(form.get('start'),60),p_customer:customer,p_note:clean(form.get('note'),1000),p_service_name:customName,p_duration:duration,p_price_cents:priceCents})
   :await db.rpc('prenow_staff_book',{p_tenant:id,p_service:service,p_operator:clean(form.get('operator'),36),p_start:clean(form.get('start'),60),p_customer:customer,p_note:clean(form.get('note'),1000)});
  const back=new URLSearchParams({...baseBack,customer});
  if(result.error||!result.data){back.set('error','Prenotazione non salvata. L’orario potrebbe non essere più disponibile.');redirect(path+'?'+back);}
  redirect(`/staff/${encodeURIComponent(slug)}?date=${form.get('date')}`);
 }

 const fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 const preserveValues={
  service:q.service||'',operator:q.operator||'',date:q.date||'',
  ...(custom?{custom_name:q.custom_name||'',custom_duration:q.custom_duration||'',custom_price:q.custom_price||''}:{})
 };
 const preserved=<>{Object.entries(preserveValues).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>) }{selectedCustomer&&<input type="hidden" name="customer" value={selectedCustomer.id}/>}</>;
 const tabParams=(customerMode:string)=>new URLSearchParams({...preserveValues,customer_mode:customerMode,...(selectedCustomer?{customer:selectedCustomer.id}:{})});
 return <><Link href={`/titolare/${encodeURIComponent(slug)}/clienti`}>← Clienti</Link><h1>{tenant.data.nome}: prenotazione manuale</h1><p>{selectedCustomer?`Nuovo appuntamento per ${selectedCustomer.nome} ${selectedCustomer.cognome||''}. Scegli servizio, operatore, data e orario.`:'Scegli un cliente esistente oppure creane uno nuovo. Orari e disponibilità vengono sempre verificati.'}</p>
 {q.error&&<p role="alert">{q.error}</p>}
 {selectedCustomer&&<div className="selected-customer-panel"><div className="owner-avatar">{selectedCustomer.nome.charAt(0)}</div><div><b>{selectedCustomer.nome} {selectedCustomer.cognome||''}</b><span>{selectedCustomer.email||selectedCustomer.telefono||'Nessun contatto'}</span></div><Link href={path}>Cambia</Link></div>}
 <form method="get" className="settings-card">{selectedCustomer&&<input type="hidden" name="customer" value={selectedCustomer.id}/>}<label>Servizio <select required name="service" defaultValue={q.service}><option value="">Seleziona</option>{services.data?.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}<option value={CUSTOM}>Servizio personalizzato…</option></select></label>
 {custom&&<fieldset className="custom-service-fields"><legend>Servizio personalizzato</legend><div className="field-row"><label>Nome<input required name="custom_name" maxLength={120} defaultValue={q.custom_name||''} placeholder="Es. Trattamento speciale"/></label><label>Durata (min)<input required name="custom_duration" type="number" min="5" max="480" step="5" defaultValue={q.custom_duration||'30'}/></label><label>Prezzo €<input required name="custom_price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={q.custom_price||''} placeholder="0,00"/></label></div></fieldset>}
 <label>Operatore <select required name="operator" defaultValue={q.operator}><option value="">Seleziona</option>{operators.data?.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label><label>Data <input required type="date" name="date" defaultValue={q.date}/></label><button className="btn btn-primary">Cerca orari</button></form>
 {slotError&&<p role="alert">Controlla servizio, durata, operatore e data.</p>}{q.date&&!slotError&&!slots.length&&<p>Nessun orario disponibile per i parametri selezionati.</p>}
 {!!slots.length&&<form action={book} className="settings-card manual-booking-form">{preserved}<label>Orario <select required name="start">{slots.map(s=><option key={s.start_at} value={s.start_at}>{fmt.format(new Date(s.start_at))}</option>)}</select></label>
 {selectedCustomer?<><input type="hidden" name="customer_mode" value="esistente"/><input type="hidden" name="customer" value={selectedCustomer.id}/></>:<fieldset className="customer-mode"><legend>Cliente</legend><div className="owner-tabs"><Link className={mode==='esistente'?'active':''} href={`${path}?${tabParams('esistente')}`}>Cliente esistente</Link><Link className={mode==='nuovo'?'active':''} href={`${path}?${tabParams('nuovo')}`}>Nuovo cliente</Link></div>
 <input type="hidden" name="customer_mode" value={mode}/>
 {mode==='esistente'?<><label>Cerca<input name="customer_search" form="customer-search" placeholder="Nome, email o telefono"/></label><div className="customer-results">{filtered.map(c=><label key={c.id} className="customer-result"><input type="radio" required name="customer" value={c.id}/><span><b>{c.nome} {c.cognome||''}</b><small>{c.email||c.telefono||'Nessun contatto'}</small></span></label>)}</div></>:<div className="field-row"><label>Nome<input required name="nome"/></label><label>Cognome<input name="cognome"/></label><label>Email<input type="email" name="email"/></label><label>Telefono<input type="tel" name="telefono"/></label></div>}
 </fieldset>}<label>Note interne <textarea name="note" maxLength={1000}/></label><button className="btn btn-primary">Conferma prenotazione</button></form>}
 {mode==='esistente'&&!selectedCustomer&&!!slots.length&&<form id="customer-search" method="get" className="customer-search-form">{preserved}<input type="hidden" name="customer_mode" value="esistente"/></form>}</>;
}
