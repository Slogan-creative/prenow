'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

const clean=(v:FormDataEntryValue|null,n=320)=>String(v||'').trim().slice(0,n);
const back=(slug:string,id?:string,tab?:string)=>`/titolare/${encodeURIComponent(slug)}/operatori${id?`/${id}`:''}${tab?`?tab=${tab}`:''}`;

export async function saveStaffAccess(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantManager(slug);
 const db=await createServerClient(),services=form.getAll('services').map(String).filter(Boolean);
 const operatorId=clean(form.get('operator_id'),36)||null;
 const {data,error}=await db.rpc('prenow_owner_manage_staff',{
  p_slug:slug,p_membership_id:clean(form.get('membership_id'),36)||null,p_operator_id:operatorId,
  p_name:clean(form.get('nome'),120),p_surname:clean(form.get('cognome'),120),
  p_email:clean(form.get('email')).toLowerCase(),p_phone:clean(form.get('telefono'),25),
  p_role:clean(form.get('ruolo'),20),p_active:form.get('attivo')==='on',p_services:services
 });
 if(error)redirect(back(slug,operatorId||undefined)+'?error=save');
 revalidatePath(`/titolare/${slug}`,'layout');
 redirect(operatorId?back(slug,operatorId)+'?saved=1':back(slug,String(data))+'?saved=1');
}

export async function saveOperatorHours(form:FormData){
 const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);
 await requireTenantManager(slug);const db=await createServerClient();
 const weekday=Number(form.get('weekday')),closed=form.get('chiuso')==='on';
 const starts=form.getAll('start').map(String),ends=form.getAll('end').map(String);
 const ranges=closed?[]:starts.map((s,i)=>[s,ends[i]]).filter(([s,e])=>s&&e&&s<e);
 const {error}=await db.rpc('prenow_owner_save_hours',{p_slug:slug,p_operator:operatorId,p_weekday:weekday,p_closed:closed,p_ranges:ranges});
 if(error)redirect(back(slug,operatorId,'orari')+'&error=hours');
 revalidatePath(back(slug,operatorId));redirect(back(slug,operatorId,'orari')+'&saved=1');
}

export async function addOperatorAbsence(form:FormData){
 const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);
 await requireTenantManager(slug);const db=await createServerClient();
 const {error}=await db.rpc('prenow_owner_add_absence',{p_slug:slug,p_operator:operatorId,p_start:clean(form.get('data_inizio'),10),p_end:clean(form.get('data_fine'),10),p_reason:clean(form.get('motivo'),500)});
 if(error)redirect(back(slug,operatorId,'assenze')+'&error=absence');
 revalidatePath(back(slug,operatorId));redirect(back(slug,operatorId,'assenze')+'&saved=1');
}

export async function deleteOperatorAbsence(form:FormData){
 const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);
 await requireTenantManager(slug);const db=await createServerClient();
 const {error}=await db.rpc('prenow_owner_delete_absence',{p_slug:slug,p_operator:operatorId,p_absence:clean(form.get('absence_id'),36)});
 if(error)redirect(back(slug,operatorId,'assenze')+'&error=absence');
 revalidatePath(back(slug,operatorId));redirect(back(slug,operatorId,'assenze')+'&saved=1');
}

export async function removeOperator(form:FormData){
 const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);
 await requireTenantManager(slug);const db=await createServerClient();
 const {error}=await db.rpc('prenow_owner_remove_operator',{p_slug:slug,p_operator:operatorId});
 if(error)redirect(back(slug,operatorId)+'?error=remove');
 revalidatePath(`/titolare/${slug}`,'layout');redirect(back(slug)+'?removed=1');
}
