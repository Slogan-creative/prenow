'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

const clean=(v:FormDataEntryValue|null,n=320)=>String(v||'').trim().slice(0,n);
const back=(slug:string,id?:string,tab?:string)=>id?`/titolare/${encodeURIComponent(slug)}/operatori/${id}${tab?`?tab=${tab}`:''}`:`/titolare/${encodeURIComponent(slug)}/impostazioni?tab=operatori`;
type Member={operator_id:string;membership_id:string|null;nome:string;cognome:string|null;email:string|null;telefono:string|null;ruolo:'staff'|'operator';attivo:boolean;services:string[]};
async function memberFor(slug:string,id:string){const db=await createServerClient(),{data,error}=await db.rpc('prenow_owner_staff',{p_slug:slug});if(error)throw error;const member=((data||[]) as Member[]).find(x=>x.operator_id===id);if(!member)throw new Error('Operatore non trovato');return {db,member}}
async function persistMember(slug:string,member:Member,changes:Partial<Member>){const db=await createServerClient(),next={...member,...changes};const {error}=await db.rpc('prenow_owner_manage_staff',{p_slug:slug,p_membership_id:next.membership_id,p_operator_id:next.operator_id,p_name:next.nome,p_surname:next.cognome||'',p_email:(next.email||'').toLowerCase(),p_phone:next.telefono||'',p_role:next.ruolo,p_active:next.attivo,p_services:next.services});if(error)throw error}

export async function saveStaffAccess(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantManager(slug);const db=await createServerClient(),services=form.getAll('services').map(String).filter(Boolean),operatorId=clean(form.get('operator_id'),36)||null;
 const {data,error}=await db.rpc('prenow_owner_manage_staff',{p_slug:slug,p_membership_id:clean(form.get('membership_id'),36)||null,p_operator_id:operatorId,p_name:clean(form.get('nome'),120),p_surname:clean(form.get('cognome'),120),p_email:clean(form.get('email')).toLowerCase(),p_phone:clean(form.get('telefono'),25),p_role:clean(form.get('ruolo'),20),p_active:form.get('attivo')==='on',p_services:services});
 if(error)redirect(back(slug,operatorId||undefined)+(operatorId?'?':'&')+'error=save');revalidatePath(`/titolare/${slug}`,'layout');redirect(operatorId?back(slug,operatorId)+'?saved=1':back(slug,String(data))+'?saved=1');
}
export async function saveOperatorData(form:FormData){
 const slug=clean(form.get('slug'),48),id=clean(form.get('operator_id'),36);await requireTenantManager(slug);
 try{const {member}=await memberFor(slug,id);await persistMember(slug,member,{nome:clean(form.get('nome'),120),cognome:clean(form.get('cognome'),120)||null,email:clean(form.get('email')).toLowerCase()||null,telefono:clean(form.get('telefono'),25)||null})}catch{redirect(back(slug,id)+'?error=save')}
 revalidatePath(back(slug,id));redirect(back(slug,id)+'?saved=1');
}
export async function toggleOperatorActive(form:FormData){
 const slug=clean(form.get('slug'),48),id=clean(form.get('operator_id'),36);await requireTenantManager(slug);
 try{const {member}=await memberFor(slug,id);await persistMember(slug,member,{attivo:form.get('attivo')==='on'})}catch{redirect(back(slug,id)+'?error=save')}
 revalidatePath(back(slug,id));redirect(back(slug,id)+'?saved=1');
}
export async function toggleOperatorService(form:FormData){
 const slug=clean(form.get('slug'),48),id=clean(form.get('operator_id'),36),serviceId=clean(form.get('service_id'),36);await requireTenantManager(slug);
 try{const {member}=await memberFor(slug,id),set=new Set(member.services);form.get('enabled')==='on'?set.add(serviceId):set.delete(serviceId);await persistMember(slug,member,{services:[...set]})}catch{redirect(back(slug,id,'servizi')+'&error=save')}
 revalidatePath(back(slug,id));redirect(back(slug,id,'servizi')+'&saved=1');
}
export async function saveOperatorHours(form:FormData){
 const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);await requireTenantManager(slug);const db=await createServerClient(),weekday=Number(form.get('weekday')),closed=form.get('chiuso')==='on',starts=form.getAll('start').map(String),ends=form.getAll('end').map(String),ranges=closed?[]:starts.map((s,i)=>({da:s,a:ends[i]})).filter(({da,a})=>da&&a&&da<a);
 const {error}=await db.rpc('prenow_owner_save_hours',{p_slug:slug,p_operator:operatorId,p_weekday:weekday,p_closed:closed,p_ranges:ranges});if(error)redirect(back(slug,operatorId,'orari')+'&error=hours');revalidatePath(back(slug,operatorId));redirect(back(slug,operatorId,'orari')+'&saved=1');
}
export async function addOperatorAbsence(form:FormData){const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);await requireTenantManager(slug);const db=await createServerClient(),{error}=await db.rpc('prenow_owner_add_absence',{p_slug:slug,p_operator:operatorId,p_start:clean(form.get('data_inizio'),10),p_end:clean(form.get('data_fine'),10),p_reason:clean(form.get('motivo'),500)});if(error)redirect(back(slug,operatorId,'assenze')+'&error=absence');revalidatePath(back(slug,operatorId));redirect(back(slug,operatorId,'assenze')+'&saved=1')}
export async function deleteOperatorAbsence(form:FormData){const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);await requireTenantManager(slug);const db=await createServerClient(),{error}=await db.rpc('prenow_owner_delete_absence',{p_slug:slug,p_operator:operatorId,p_absence:clean(form.get('absence_id'),36)});if(error)redirect(back(slug,operatorId,'assenze')+'&error=absence');revalidatePath(back(slug,operatorId));redirect(back(slug,operatorId,'assenze')+'&saved=1')}
export async function removeOperator(form:FormData){const slug=clean(form.get('slug'),48),operatorId=clean(form.get('operator_id'),36);await requireTenantManager(slug);const db=await createServerClient(),{error}=await db.rpc('prenow_owner_remove_operator',{p_slug:slug,p_operator:operatorId});if(error)redirect(back(slug,operatorId)+'?error=remove');revalidatePath(`/titolare/${slug}`,'layout');redirect(back(slug))}
