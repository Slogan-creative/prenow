'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
import {entityId,requiredName} from '@/lib/management-validation';
export async function saveAvailability(form:FormData) {
 await requirePlatformAdmin();
 let tenant:string;
 try {tenant=entityId(form.get('tenant'));} catch {redirect('/admin/applicazioni');}
 const path=`/admin/applicazioni/${tenant!}/disponibilita`;
 const fail=(message:string):never=>redirect(`${path}?error=${encodeURIComponent(message)}`);
 const kind=String(form.get('kind'));
 if(!['closures','operator_absences','manual_blocks'].includes(kind))fail('Operazione non valida.');
 const db=await createServerClient();
 const owner=await db.from('tenants').select('id').eq('id',tenant!).maybeSingle();
 if(owner.error || !owner.data)fail('Applicazione non disponibile.');
 if(form.get('remove')==='on'){
  if(form.get('confirm')!=='on')fail('Conferma la rimozione.');
  let id:string;try{id=entityId(form.get('id'));}catch{fail('Identificativo non valido.');}
  const result=await db.from(kind).delete().eq('tenant_id',tenant!).eq('id',id!).select('id');
  if(result.error || !result.data?.length)fail('Elemento non rimosso.');
 }else{
  let motivo:string;try{motivo=requiredName(form.get('motivo'));}catch{fail('Inserisci un motivo di massimo 120 caratteri.');}
  const first=String(form.get('dal')),last=kind==='manual_blocks'?first:String(form.get('al'));
  const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
  if(!validDate(first)||!validDate(last)||last<first)fail('Controlla le date.');
  const all=kind!=='manual_blocks' && form.get('all')==='on';
  const from=String(form.get('from')||''),to=String(form.get('to')||'');
  const time=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if(!all && (!time(from)||!time(to)||from>=to))fail('Inserisci una fascia oraria valida, senza attraversare la mezzanotte.');
  let operator:string|null=null;
  if(kind!=='closures' && form.get('operator')){
   try{operator=entityId(form.get('operator'));}catch{fail('Operatore non valido.');}
   const check=await db.from('operators').select('id').eq('id',operator!).eq('tenant_id',tenant!).maybeSingle();
   if(check.error || !check.data)fail('Operatore non appartenente al salone.');
  }
  if(kind==='operator_absences' && !operator)fail('Seleziona un operatore.');
  const row=kind==='manual_blocks'
   ?{tenant_id:tenant!,operator_id:operator,data:first,ora_inizio:from,ora_fine:to,motivo:motivo!}
   :{tenant_id:tenant!,...(kind==='operator_absences'?{operator_id:operator}:{}),data_inizio:first,data_fine:last,tutto_il_giorno:all,ora_inizio:all?null:from,ora_fine:all?null:to,motivo:motivo!};
  const result=await db.from(kind).insert(row);
  if(result.error)fail('Disponibilità non salvata. Riprova.');
 }
 revalidatePath(path);revalidatePath('/cliente','layout');
 redirect(`${path}?saved=1`);
}
