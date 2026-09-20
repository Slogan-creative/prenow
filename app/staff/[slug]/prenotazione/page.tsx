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

 async function previewRecurrence(input:{
  service:string;operator:string;start:string;customName:string;customDuration:number;
  recurrenceType:string;endMode:string;count:number|null;endDate:string|null;weekOfMonth:number|null;weekday:number|null;
 }){
  'use server';
  const db=await createServerClient();
  const result=await db.rpc('prenow_staff_preview_recurrence',{
   p_tenant:id,
   p_service:input.service===CUSTOM?null:input.service,
   p_operator:input.operator,
   p_start:input.start,
   p_custom_name:input.service===CUSTOM?input.customName:null,
   p_custom_duration:input.service===CUSTOM?input.customDuration:null,
   p_recurrence_type:input.recurrenceType,
   p_end_mode:input.endMode,
   p_count:input.endMode==='count'?input.count:null,
   p_end_date:input.endMode==='date'?input.endDate:null,
   p_week_of_month:input.recurrenceType==='monthly_nth_weekday'?input.weekOfMonth:null,
   p_weekday:input.recurrenceType==='monthly_nth_weekday'?input.weekday:null
  });
  if(result.error||!result.data)return {error:true,total:0,available:0,conflicts:0,occurrences:[] as {occurrence_no:number;date:string;start_at:string;available:boolean}[]};
  const data=result.data as {total:number;available:number;conflicts:number;occurrences:{occurrence_no:number;date:string;start_at:string;available:boolean}[]};
  return {...data,error:false};
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
  const note=clean(form.get('note'),1000);
  const recurring=form.get('recurring')==='1';

  if(recurring){
   const recurrenceType=clean(form.get('recurrence_type'),32);
   const endMode=clean(form.get('recurrence_end_mode'),12);
   const count=endMode==='count'?Number(form.get('recurrence_count')):null;
   const endDate=endMode==='date'?clean(form.get('recurrence_end_date'),10):null;
   const weekOfMonth=recurrenceType==='monthly_nth_weekday'?Number(form.get('recurrence_week_of_month')):null;
   const weekday=recurrenceType==='monthly_nth_weekday'?Number(form.get('recurrence_weekday')):null;
   const result=await db.rpc('prenow_staff_book_recurrence',{
    p_tenant:id,
    p_customer:customer,
    p_service:isCustom?null:service,
    p_operator:operator,
    p_start:start,
    p_note:note,
    p_custom_name:isCustom?customName:null,
    p_custom_duration:isCustom?duration:null,
    p_custom_price_cents:isCustom?priceCents:null,
    p_recurrence_type:recurrenceType,
    p_end_mode:endMode,
    p_count:endMode==='count'?count:null,
    p_end_date:endMode==='date'?endDate:null,
    p_week_of_month:recurrenceType==='monthly_nth_weekday'?weekOfMonth:null,
    p_weekday:recurrenceType==='monthly_nth_weekday'?weekday:null
   });
   if(result.error||!result.data)redirect(`/titolare/${encodeURIComponent(slug)}/prenota?error=booking`);
  }else{
   const result=isCustom
    ?await db.rpc('prenow_staff_book_custom',{p_tenant:id,p_operator:operator,p_start:start,p_customer:customer,p_note:note,p_service_name:customName,p_duration:duration,p_price_cents:priceCents})
    :await db.rpc('prenow_staff_book',{p_tenant:id,p_service:service,p_operator:operator,p_start:start,p_customer:customer,p_note:note});
   if(result.error||!result.data)redirect(`/titolare/${encodeURIComponent(slug)}/prenota?error=booking`);
  }

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
  previewRecurrence={previewRecurrence}
  book={book}
 />;
}
