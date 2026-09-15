'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireTenantAdmin} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

const clean=(v:FormDataEntryValue|null,n=320)=>String(v||'').trim().slice(0,n);
export async function saveStaffAccess(form:FormData){
 const slug=clean(form.get('slug'),48);
 await requireTenantAdmin(slug);
 const db=await createServerClient();
 const services=form.getAll('services').map(String).filter(Boolean);
 const args={
  p_slug:slug,
  p_membership_id:clean(form.get('membership_id'),36)||null,
  p_operator_id:clean(form.get('operator_id'),36)||null,
  p_name:clean(form.get('nome'),120),
  p_surname:clean(form.get('cognome'),120),
  p_email:clean(form.get('email')).toLowerCase(),
  p_phone:clean(form.get('telefono'),25),
  p_role:clean(form.get('ruolo'),20),
  p_active:form.get('attivo')==='on',
  p_services:services
 };
 const {error}=await db.rpc('prenow_owner_manage_staff',args);
 if(error)redirect(`/titolare/${slug}/operatori?error=1`);
 revalidatePath(`/titolare/${slug}`,'layout');
 redirect(`/titolare/${slug}/operatori?saved=1`);
}
