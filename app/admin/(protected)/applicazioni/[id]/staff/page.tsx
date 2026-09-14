import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
import {entityId} from '@/lib/management-validation';
export const dynamic='force-dynamic';
export default async function Staff({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string}>}){
 await requirePlatformAdmin();const {id}=await params;try{entityId(id);}catch{notFound();}
 const q=await searchParams,db=await createServerClient();
 const [tenant,members,operators]=await Promise.all([db.from('tenants').select('nome,slug').eq('id',id).maybeSingle(),db.from('tenant_users').select('id,user_id,nome,ruolo,operator_id').eq('tenant_id',id).order('nome'),db.from('operators').select('id,nome').eq('tenant_id',id).order('nome')]);
 if([tenant,members,operators].some(r=>r.error))throw new Error('Impossibile caricare lo staff.');if(!tenant.data)notFound();
 const path=`/admin/applicazioni/${id}/staff`;
 async function save(f:FormData){
 'use server';await requirePlatformAdmin();const db=await createServerClient();
 if(f.get('remove')==='on'&&f.get('confirm')!=='on')redirect(path+'?error=Conferma%20la%20revoca.');
 const r=await db.rpc('prenow_manage_staff',{p_tenant:id,p_user:String(f.get('user')),p_role:String(f.get('role')||'staff'),p_name:String(f.get('name')||''),p_operator:f.get('operator')?String(f.get('operator')):null,p_remove:f.get('remove')==='on'});
 if(r.error)redirect(path+'?error='+encodeURIComponent(r.error.code==='PGRST202'?'Funzione non installata: collaudare setup/staff.sql nel database di test.':'Operazione non riuscita. Controlla utente e operatore.'));
 redirect(path+'?saved=1');
 }
 return <><Link href={`/admin/applicazioni/${id}`}>← Configurazione</Link><h1>{tenant.data.nome}: staff</h1><p>Collega esclusivamente utenti già registrati. L’UUID è disponibile in Supabase → Authentication → Users. Non inserire password.</p><p><Link href={`/staff/${tenant.data.slug}/login`}>Accesso staff del salone</Link></p>
 {q.saved&&<p role="status">Staff aggiornato.</p>}{q.error&&<p role="alert">{q.error}</p>}
 <form action={save} className="settings-card"><label>UUID utente <input name="user" required/></label><label>Nome <input name="name" required maxLength={120}/></label><label>Ruolo <select name="role"><option value="staff">Staff</option><option value="tenant_admin">Responsabile salone</option><option value="operator">Operatore (solo propria agenda)</option></select></label><label>Operatore collegato <select name="operator"><option value="">Nessuno</option>{operators.data?.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label><button className="btn btn-primary">Aggiungi o aggiorna accesso</button></form>
 {members.data?.map(m=><div key={m.id} className="settings-card"><strong>{m.nome}</strong><p>{m.ruolo} · {m.user_id||'Non collegato'}</p>{m.user_id&&<form action={save}><input type="hidden" name="user" value={m.user_id}/><input type="hidden" name="remove" value="on"/><label><input type="checkbox" name="confirm" required/> Confermo la revoca dell’accesso al salone</label><button className="btn btn-danger">Revoca accesso</button></form>}</div>)}</>;
}
