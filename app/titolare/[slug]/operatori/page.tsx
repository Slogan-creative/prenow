import {requireTenantAdmin} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';
import {saveStaffAccess} from './actions';

export const dynamic='force-dynamic';
type Service={id:string;nome:string};
type Member={id:string;user_id:string|null;nome:string;cognome:string|null;email:string;telefono:string|null;ruolo:'manager'|'operator';attivo:boolean;operator_id:string|null;services:string[]};

export default async function OperatorsPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{saved?:string;error?:string}>}){
 const {slug}=await params,q=await searchParams,ctx=await requireTenantAdmin(slug),db=await createServerClient();
 const [{data:staff},{data:services}]=await Promise.all([
  db.rpc('prenow_owner_staff',{p_slug:slug}),
  db.from('services').select('id,nome').eq('tenant_id',ctx.tenant_id).eq('attivo',true).order('ordine').order('created_at')
 ]);
 const members=(staff||[]) as Member[],available=(services||[]) as Service[];
 return <><div className="owner-heading"><div><p>Persone e accessi</p><h1>Operatori</h1><span>Crea collaboratori, assegna i servizi e stabilisci cosa possono gestire.</span></div></div>
 {q.saved&&<p className="owner-alert success">Operatore e permessi salvati.</p>}
 {q.error&&<p className="owner-alert error">Non è stato possibile salvare. Controlla email, ruolo e servizi.</p>}
 <section className="owner-panel"><div className="owner-panel-head"><div><h2>Nuovo collaboratore</h2><p>Se non ha ancora un account, l’accesso resterà in attesa finché si registrerà con questa email.</p></div></div><StaffForm slug={slug} services={available}/></section>
 <section className="owner-panel"><div className="owner-panel-head"><div><h2>Team</h2><p>{members.length} collaborator{members.length===1?'e':'i'} configurat{members.length===1?'o':'i'}.</p></div></div>
 {!members.length?<div className="owner-empty">Nessun collaboratore configurato.</div>:<div className="owner-staff-grid">{members.map(member=><StaffForm key={member.id} slug={slug} services={available} member={member}/>)}</div>}</section></>;
}

function StaffForm({slug,services,member}:{slug:string;services:Service[];member?:Member}){
 const assigned=new Set(member?.services||[]);
 return <form action={saveStaffAccess} className="owner-staff-card">
  <div className="owner-staff-card-head"><div className="owner-staff-avatar">{(member?.nome||'N').charAt(0)}</div><div><h3>{member?member.nome+' '+(member.cognome||''):'Nuovo operatore'}</h3>{member&&<span className={member.user_id?'access-active':'access-pending'}>{member.user_id?'Accesso attivo':'Registrazione in attesa'}</span>}</div></div>
  <input type="hidden" name="slug" value={slug}/><input type="hidden" name="membership_id" value={member?.id||''}/><input type="hidden" name="operator_id" value={member?.operator_id||''}/>
  <div className="owner-form-grid"><label>Nome<input name="nome" defaultValue={member?.nome||''} required/></label><label>Cognome<input name="cognome" defaultValue={member?.cognome||''}/></label><label>Email di accesso<input name="email" type="email" defaultValue={member?.email||''} required/></label><label>Telefono<input name="telefono" defaultValue={member?.telefono||''}/></label><label>Permessi<select name="ruolo" defaultValue={member?.ruolo||'operator'}><option value="operator">Operatore semplice</option><option value="manager">Gestione operativa</option></select></label><label className="check"><input name="attivo" type="checkbox" defaultChecked={member?.attivo??true}/> Accesso e operatore attivi</label></div>
  <fieldset className="owner-service-checks"><legend>Servizi eseguibili</legend>{services.map(service=><label key={service.id}><input type="checkbox" name="services" value={service.id} defaultChecked={!member||assigned.has(service.id)}/><span>{service.nome}</span></label>)}</fieldset>
  <div className="owner-permission-note">{(member?.ruolo||'operator')==='manager'?'Può gestire agenda, clienti e prenotazioni. Non può modificare impostazioni o permessi.':'Può vedere esclusivamente la propria agenda e i propri appuntamenti.'}</div>
  <button className="owner-primary">{member?'Salva modifiche':'Aggiungi collaboratore'}</button>
 </form>;
}
