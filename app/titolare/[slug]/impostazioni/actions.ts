'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireTenantAdmin} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

const clean=(v:FormDataEntryValue|null,n=500)=>String(v||'').trim().slice(0,n);
export async function saveOwnerSettings(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantAdmin(slug);const db=await createServerClient();
 const args={p_slug:slug,p_name:clean(form.get('nome'),120),p_description:clean(form.get('descrizione'),600),p_via:clean(form.get('via'),180),p_cap:clean(form.get('cap'),10),p_citta:clean(form.get('citta'),100),p_provincia:clean(form.get('provincia'),4),p_phone:clean(form.get('telefono'),25),p_whatsapp:clean(form.get('whatsapp'),25),p_email:clean(form.get('email'),320),p_maps_url:clean(form.get('maps_url'),1000),p_website:clean(form.get('sito_web'),1000),p_instagram:clean(form.get('instagram'),1000),p_facebook:clean(form.get('facebook'),1000),p_logo_url:clean(form.get('logo_url'),2000),p_primary:clean(form.get('color_primary'),7),p_background:clean(form.get('color_bg'),7),p_text:clean(form.get('color_text'),7)};
 const {error}=await db.rpc('prenow_owner_save_settings',args);if(error)redirect(`/titolare/${slug}/impostazioni?error=1`);revalidatePath(`/titolare/${slug}`,'layout');redirect(`/titolare/${slug}/impostazioni?saved=1`);
}
export async function saveService(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantAdmin(slug),db=await createServerClient(),id=clean(form.get('id'),36),raw=clean(form.get('prezzo'),20).replace(',','.');
 const values={tenant_id:ctx.tenant_id,nome:clean(form.get('nome'),120),durata_min:Number(form.get('durata')),prezzo_centesimi:raw===''?null:Math.round(Number(raw)*100),ordine:Number(form.get('ordine')||0),attivo:form.get('attivo')==='on'};
 const result=id?await db.from('services').update(values).eq('id',id).eq('tenant_id',ctx.tenant_id):await db.from('services').insert(values);if(result.error)redirect(`/titolare/${slug}/impostazioni?error=service`);revalidatePath(`/titolare/${slug}`,'layout');redirect(`/titolare/${slug}/impostazioni?saved=service#servizi`);
}
export async function saveOperator(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantAdmin(slug),db=await createServerClient(),id=clean(form.get('id'),36);const values={tenant_id:ctx.tenant_id,nome:clean(form.get('nome'),120),cognome:clean(form.get('cognome'),120)||null,email:clean(form.get('email'),320)||null,telefono:clean(form.get('telefono'),25)||null,attivo:form.get('attivo')==='on'};
 const result=id?await db.from('operators').update(values).eq('id',id).eq('tenant_id',ctx.tenant_id):await db.from('operators').insert(values);if(result.error)redirect(`/titolare/${slug}/impostazioni?error=operator`);revalidatePath(`/titolare/${slug}`,'layout');redirect(`/titolare/${slug}/impostazioni?saved=operator#operatori`);
}
export async function saveHours(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantAdmin(slug),db=await createServerClient(),id=clean(form.get('id'),36),chiuso=form.get('chiuso')==='on';const fasce=chiuso?[]:[0,1].map(i=>({da:clean(form.get(`da${i}`),5),a:clean(form.get(`a${i}`),5)})).filter(x=>x.da&&x.a);
 const {error}=await db.from('business_hours').update({chiuso,fasce}).eq('id',id).eq('tenant_id',ctx.tenant_id).is('operator_id',null);if(error)redirect(`/titolare/${slug}/impostazioni?error=hours`);revalidatePath(`/titolare/${slug}`,'layout');redirect(`/titolare/${slug}/impostazioni?saved=hours#orari`);
}
