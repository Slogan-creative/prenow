import {notFound,redirect} from 'next/navigation';
import {createServerClient} from '@/lib/supabase/server';
import ManualBookingWizard from './ManualBookingWizard';

export const dynamic='force-dynamic';
const clean=(v:FormDataEntryValue|null,n=320)=>String(v||'').trim().slice(0,n);
const CUSTOM='__custom__';

export default async function ManualBooking({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {slug}=await params,session=await createServerClient(),user=await session.auth.getUser();
 if(!user.data.user)redirect(`/staff/${encodeURIComponent(slug)}/login`);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const access=await session.rpc('prenow_staff_agenda',{p_slug:slug,p_date:today});
 if(access.error||!access.data||!['tenant_admin','staff'].includes(access.data.role))return <main className="booking"><h1>Accesso non autorizzato</h1><p>La prenotazione manuale è riservata a staff e responsabili.</p></main>;
 const salon=await session.from('tenants').select('id').eq('slug',slug).maybeSingle();
 if(salon.error||!salon.data)notFound();
 const id=salon.data.id,q=await searchParams,db=await createServerClient();
 const [services,operators,customers]=await Promise.all([
  db.from('services').select('id,nome,durata_min,prezzo_centesimi').eq('tenant_id',id).eq('attivo',true).order('ordine').order('created_at'),
  db.from('operators').select('id,nome').eq('tenant_id',id).eq('attivo',true).order('nome'),
  db.from('customers').select('id,nome,cognome,email,telefono').eq('tenant_id',id).order('nome').limit(500)
 ]);
 if([services,operators,customers].some(r=>r.error))throw new Error('Impossibile caricare la prenotazione manuale.');

 async function availability(service:string,operator:string,date:string,customName:string,customDuration:number){
  'use server';
  const db=await createServerClient();
  if(!service||!operator||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {slots:[],error:true};
  if(service===CUSTOM){
   if(!customName.trim()||!Number.isInteger(customDuration)||customDuration<5||customDuration>480)return {slots:[],error:true};
   const result=await db.rpc('prenow_staff_slots_custom',{p_tenant:id,p_operator:operator,p_date:date,p_duration:customDuration});
   return {slots:(result.data||[]) as {start_at:string}[],error:!!result.error};
  }
  const result=await db.rpc('prenow_customer_slots',{p_slug:slug,p_service:service,p_operator:operator,p_date:date});
  return {slots:(result.data||[]) as {start_at:string}[],error:!!result.error};
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
  if(isCustom&&(!customName||!Number.isInteger(duration)||duration<5||duration>480||!Number.isFinite(priceEuros)||priceEuros<0))redirect(`/titolare/${encodeURIComponent(slug)}/prenota?error=custom`);
  if(form.get('customer_mode')==='nuovo'){
   const created=await db.rpc('prenow_staff_create_customer',{p_tenant:id,p_name:clean(form.get('nome'),120),p_surname:clean(form.get('cognome'),120),p_email:clean(form.get('email')).toLowerCase(),p_phone:clean(form.get('telefono'),25)});
   if(created.error||!created.data)redirect(`/titolare/${encodeURIComponent(slug)}/prenota?error=customer`);
   customer=String(created.data);
  }
  if(!customer)redirect(`/titolare/${encodeURIComponent(slug)}/prenota?error=customer`);
  const start=clean(form.get('start'),60);
  const operator=clean(form.get('operator'),36);
  const result=isCustom
   ?await db.rpc('prenow_staff_book_custom',{p_tenant:id,p_operator:operator,p_start:start,p_customer:customer,p_note:clean(form.get('note'),1000),p_service_name:customName,p_duration:duration,p_price_cents:priceCents})
   :await db.rpc('prenow_staff_book',{p_tenant:id,p_service:service,p_operator:operator,p_start:start,p_customer:customer,p_note:clean(form.get('note'),1000)});
  if(result.error||!result.data)redirect(`/titolare/${encodeURIComponent(slug)}/prenota?error=booking`);
  const date=clean(form.get('date'),10);
  redirect(`/titolare/${encodeURIComponent(slug)}/agenda?date=${encodeURIComponent(date)}`);
 }

 return <ManualBookingWizard
  slug={slug}
  today={today}
  services={services.data||[]}
  operators={operators.data||[]}
  customers={customers.data||[]}
  initialCustomer={q.customer}
  availability={availability}
  book={book}
 />;
}
