'use server';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {randomUUID} from 'node:crypto';
export async function uploadLogo(form:FormData){
 await requirePlatformAdmin();const tenant=String(form.get('tenant')||'');if(!/^[0-9a-f-]{36}$/i.test(tenant))redirect('/admin/applicazioni');
 const path=`/admin/applicazioni/${tenant}`;const fail=(message:string):never=>redirect(`${path}?error=${encodeURIComponent(message)}`);
 const db=await createServerClient();const {data:branding,error:readError}=await db.from('tenant_branding').select('tenant_id').eq('tenant_id',tenant).maybeSingle();if(readError||!branding)fail('Configurazione non disponibile.');
 const image=String(form.get('image')||'');if(image.length>2800000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))fail('Immagine non valida.');
 const bytes=Buffer.from(image.split(',')[1],'base64');
 if(bytes.length>2*1024*1024||bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR')fail('PNG non valido.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width>1024||height>1024)fail('Il logo deve essere ottimizzato entro 1024 pixel.');
 const object=`${tenant}/${randomUUID()}.png`;
 const {error:uploadError}=await db.storage.from('tenant-logos').upload(object,bytes,{contentType:'image/png',upsert:false,cacheControl:'31536000'});
 if(uploadError)fail('Caricamento non riuscito. Verifica che la configurazione Storage per i loghi sia stata eseguita.');
 const {data:publicUrl}=db.storage.from('tenant-logos').getPublicUrl(object);
 const {data:saved,error:saveError}=await db.from('tenant_branding').update({logo_url:publicUrl.publicUrl}).eq('tenant_id',tenant).select('tenant_id');
 if(saveError||!saved?.length){await db.storage.from('tenant-logos').remove([object]);fail('Logo non salvato. Il logo precedente è rimasto invariato.');}
 // Non cancellare il vecchio oggetto: preserva eventuali riferimenti e permette recupero.
 revalidatePath(path);revalidatePath('/cliente','layout');redirect(`${path}?saved=1`);
}
