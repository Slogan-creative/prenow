'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

const clean=(v:FormDataEntryValue|null,n=500)=>String(v||'').trim().slice(0,n);
const settingsPath=(slug:string,tab:string)=>`/titolare/${encodeURIComponent(slug)}/impostazioni?tab=${tab}`;

export async function saveOwnerSettings(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantManager(slug);const db=await createServerClient();
 const args={p_slug:slug,p_name:clean(form.get('nome'),120),p_description:clean(form.get('descrizione'),600),p_via:clean(form.get('via'),180),p_cap:clean(form.get('cap'),10),p_citta:clean(form.get('citta'),100),p_provincia:clean(form.get('provincia'),4),p_phone:clean(form.get('telefono'),25),p_whatsapp:clean(form.get('whatsapp'),25),p_email:clean(form.get('email'),320),p_maps_url:clean(form.get('maps_url'),1000),p_website:clean(form.get('sito_web'),1000),p_instagram:clean(form.get('instagram'),1000),p_facebook:clean(form.get('facebook'),1000),p_logo_url:clean(form.get('logo_url'),2000),p_primary:clean(form.get('color_primary'),7),p_background:clean(form.get('color_bg'),7),p_text:clean(form.get('color_text'),7)};
 const {error}=await db.rpc('prenow_owner_save_settings',args);if(error)redirect(settingsPath(slug,'attivita')+'&error=1');revalidatePath(`/titolare/${slug}`,'layout');redirect(settingsPath(slug,'attivita')+'&saved=1');
}
export async function saveService(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantManager(slug),db=await createServerClient(),id=clean(form.get('id'),36),raw=clean(form.get('prezzo'),20).replace(',','.');
 const values={tenant_id:ctx.tenant_id,nome:clean(form.get('nome'),120),durata_min:Number(form.get('durata')),prezzo_centesimi:raw===''?null:Math.round(Number(raw)*100),ordine:Number(form.get('ordine')||0),attivo:form.get('attivo')==='on'};
 const result=id?await db.from('services').update(values).eq('id',id).eq('tenant_id',ctx.tenant_id):await db.from('services').insert(values);if(result.error)redirect(settingsPath(slug,'servizi')+'&error=service');revalidatePath(`/titolare/${slug}`,'layout');redirect(settingsPath(slug,'servizi')+'&saved=service');
}
export async function saveOperator(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantManager(slug),db=await createServerClient(),id=clean(form.get('id'),36);const values={tenant_id:ctx.tenant_id,nome:clean(form.get('nome'),120),cognome:clean(form.get('cognome'),120)||null,email:clean(form.get('email'),320)||null,telefono:clean(form.get('telefono'),25)||null,attivo:form.get('attivo')==='on'};
 const result=id?await db.from('operators').update(values).eq('id',id).eq('tenant_id',ctx.tenant_id):await db.from('operators').insert(values);if(result.error)redirect(settingsPath(slug,'operatori')+'&error=operator');revalidatePath(`/titolare/${slug}`,'layout');redirect(settingsPath(slug,'operatori')+'&saved=operator');
}
export async function saveHours(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantManager(slug);const db=await createServerClient(),chiuso=form.get('chiuso')==='on';
 const weekday=Number(form.get('weekday')),starts=form.getAll('da').map(v=>clean(v,5)),ends=form.getAll('a').map(v=>clean(v,5));
 const fasce=chiuso?[]:starts.map((da,i)=>({da,a:ends[i]||''})).filter(x=>/^\d{2}:\d{2}$/.test(x.da)&&/^\d{2}:\d{2}$/.test(x.a)&&x.da<x.a).slice(0,6);
 if(!Number.isInteger(weekday)||weekday<0||weekday>6||(!chiuso&&!fasce.length))redirect(settingsPath(slug,'orari')+'&error=hours');
 const {error}=await db.rpc('prenow_owner_save_hours',{p_slug:slug,p_operator:null,p_weekday:weekday,p_closed:chiuso,p_ranges:fasce});
 if(error)redirect(settingsPath(slug,'orari')+'&error=hours');
 revalidatePath(`/titolare/${slug}/impostazioni`);redirect(settingsPath(slug,'orari')+'&saved=hours');
}

type Theme='scuro'|'chiaro';
const validTheme=(value:string):value is Theme=>value==='scuro'||value==='chiaro';
async function currentBranding(db:Awaited<ReturnType<typeof createServerClient>>,tenantId:string){
 const {data,error}=await db.from('tenant_branding').select('tema,color_primary,logo_url,logo_light_url').eq('tenant_id',tenantId).maybeSingle();
 if(error)throw error;
 return data||{tema:'scuro',color_primary:'#C79A45',logo_url:null,logo_light_url:null};
}
async function persistAppearance(db:Awaited<ReturnType<typeof createServerClient>>,slug:string,theme:Theme,primary:string,logoUrl:string|null,logoLightUrl:string|null){
 const {error}=await db.rpc('prenow_owner_save_appearance',{p_slug:slug,p_theme:theme,p_primary:primary,p_logo_url:logoUrl,p_logo_light_url:logoLightUrl});
 if(error)throw error;
}

export async function saveAppearance(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantManager(slug),db=await createServerClient();
 const theme=clean(form.get('tema'),8),primary=clean(form.get('color_primary'),7);
 if(!validTheme(theme)||!/^#[0-9a-fA-F]{6}$/.test(primary))redirect(settingsPath(slug,'aspetto')+'&error=appearance');
 try{const branding=await currentBranding(db,ctx.tenant_id);await persistAppearance(db,slug,theme,primary,branding.logo_url,branding.logo_light_url)}catch{redirect(settingsPath(slug,'aspetto')+'&error=appearance')}
 revalidatePath(`/titolare/${slug}`,'layout');redirect(settingsPath(slug,'aspetto')+'&saved=appearance');
}

export async function uploadThemeLogo(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantManager(slug),db=await createServerClient(),theme=clean(form.get('tema'),8),file=form.get('logo');
 if(!validTheme(theme)||!(file instanceof File)||file.size<1||file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))redirect(settingsPath(slug,'aspetto')+'&error=logo');
 const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
 const path=`${ctx.tenant_id}/${theme}-${Date.now()}.${extension}`;
 const {error:uploadError}=await db.storage.from('tenant-logos').upload(path,file,{contentType:file.type,cacheControl:'3600'});
 if(uploadError)redirect(settingsPath(slug,'aspetto')+'&error=logo');
 const {data:urlData}=db.storage.from('tenant-logos').getPublicUrl(path);
 try{const branding=await currentBranding(db,ctx.tenant_id);await persistAppearance(db,slug,theme,branding.color_primary||'#C79A45',theme==='scuro'?urlData.publicUrl:branding.logo_url,theme==='chiaro'?urlData.publicUrl:branding.logo_light_url)}catch{
  await db.storage.from('tenant-logos').remove([path]);redirect(settingsPath(slug,'aspetto')+'&error=logo');
 }
 revalidatePath(`/titolare/${slug}`,'layout');redirect(settingsPath(slug,'aspetto')+'&saved=logo');
}

export async function removeThemeLogo(form:FormData){
 const slug=clean(form.get('slug'),48),ctx=await requireTenantManager(slug),db=await createServerClient(),theme=clean(form.get('tema'),8);
 if(!validTheme(theme))redirect(settingsPath(slug,'aspetto')+'&error=logo');
 try{
  const branding=await currentBranding(db,ctx.tenant_id),oldUrl=theme==='chiaro'?branding.logo_light_url:branding.logo_url;
  await persistAppearance(db,slug,theme,branding.color_primary||'#C79A45',theme==='scuro'?null:branding.logo_url,theme==='chiaro'?null:branding.logo_light_url);
  const marker='/storage/v1/object/public/tenant-logos/';if(oldUrl?.includes(marker)){const path=decodeURIComponent(oldUrl.split(marker)[1]);if(path.startsWith(`${ctx.tenant_id}/`))await db.storage.from('tenant-logos').remove([path])}
 }catch{redirect(settingsPath(slug,'aspetto')+'&error=logo')}
 revalidatePath(`/titolare/${slug}`,'layout');redirect(settingsPath(slug,'aspetto')+'&saved=logo');
}


export async function saveCustomerBookingStatus(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantManager(slug);const db=await createServerClient();
 const enabled=form.get('enabled')==='on';
 const {error}=await db.rpc('prenow_owner_set_customer_bookings',{p_slug:slug,p_enabled:enabled});
 if(error)redirect(settingsPath(slug,'attivita')+'&error=booking');
 revalidatePath(`/titolare/${slug}`,'layout');
 revalidatePath(`/cliente/${slug}`,'layout');
 redirect(settingsPath(slug,'attivita')+'&saved=booking');
}

export async function saveCustomerRecurrenceStatus(form:FormData){
 const slug=clean(form.get('slug'),48);await requireTenantManager(slug);const db=await createServerClient();
 const enabled=form.get('enabled')==='on';const {error}=await db.rpc('prenow_owner_set_customer_recurrence',{p_slug:slug,p_enabled:enabled});
 if(error)redirect(settingsPath(slug,'attivita')+'&error=recurrence');revalidatePath(`/cliente/${slug}`,'layout');redirect(settingsPath(slug,'attivita')+'&saved=recurrence');
}
