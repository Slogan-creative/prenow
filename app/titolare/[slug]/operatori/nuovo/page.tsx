import Link from 'next/link';
import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';
import {saveStaffAccess} from '../actions';
export const dynamic='force-dynamic';
export default async function NewOperator({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const ctx=await requireTenantManager(slug),db=await createServerClient();
 const {data:services}=await db.from('services').select('id,nome').eq('tenant_id',ctx.tenant_id).eq('attivo',true).order('ordine').order('created_at');
 return <><div className="owner-heading"><div><p><Link href={`/titolare/${slug}/operatori`}>← Operatori</Link></p><h1>Nuovo operatore</h1><span>Aggiungi i dati, il livello di accesso e i servizi assegnati.</span></div></div>
 <form action={saveStaffAccess} className="owner-panel owner-staff-card owner-form">
  <input type="hidden" name="slug" value={slug}/><div className="owner-form-grid">
   <label>Nome<input name="nome" required maxLength={120}/></label><label>Cognome<input name="cognome" maxLength={120}/></label>
   <label>Email<input name="email" type="email" placeholder="Necessaria per l’accesso"/></label><label>Telefono<input name="telefono" type="tel"/></label>
   <label>Permesso<select name="ruolo" defaultValue="operator"><option value="operator">Base</option><option value="staff">Gestione</option></select></label>
   <label className="check"><input name="attivo" type="checkbox" defaultChecked/> Operatore attivo</label>
  </div>
  <fieldset className="owner-service-checks"><legend>Servizi assegnati</legend>{services?.map(s=><label key={s.id}><input type="checkbox" name="services" value={s.id}/>{s.nome}</label>)}</fieldset>
  <button className="owner-primary">Crea operatore</button>
 </form></>;
}