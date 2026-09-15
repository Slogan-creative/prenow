import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';
import {addOperatorAbsence,deleteOperatorAbsence,removeOperator,saveOperatorHours,saveStaffAccess} from '../actions';
export const dynamic='force-dynamic';
const DAYS=[['Lunedì',1],['Martedì',2],['Mercoledì',3],['Giovedì',4],['Venerdì',5],['Sabato',6],['Domenica',0]] as const;
type Member={operator_id:string;membership_id:string|null;nome:string;cognome:string|null;email:string|null;telefono:string|null;ruolo:'staff'|'operator';attivo:boolean;services:string[]};
type Hours={weekday:number;chiuso:boolean;fasce:string[][]};
type Absence={id:string;data_inizio:string;data_fine:string;motivo:string|null};
export default async function OperatorDetail({params,searchParams}:{params:Promise<{slug:string;id:string}>;searchParams:Promise<{tab?:string;saved?:string;error?:string}>}){
 const {slug,id}=await params,q=await searchParams,ctx=await requireTenantManager(slug),db=await createServerClient();
 const [{data:all},{data:services},{data:hours},{data:standard},{data:absences}]=await Promise.all([
  db.rpc('prenow_owner_staff',{p_slug:slug}),db.from('services').select('id,nome').eq('tenant_id',ctx.tenant_id).order('ordine').order('created_at'),
  db.from('business_hours').select('weekday,chiuso,fasce').eq('tenant_id',ctx.tenant_id).eq('operator_id',id),
  db.from('business_hours').select('weekday,chiuso,fasce').eq('tenant_id',ctx.tenant_id).is('operator_id',null),
  db.from('operator_absences').select('id,data_inizio,data_fine,motivo').eq('tenant_id',ctx.tenant_id).eq('operator_id',id).gte('data_fine',new Date().toISOString().slice(0,10)).order('data_inizio')
 ]);
 const member=((all||[]) as Member[]).find(x=>x.operator_id===id);if(!member)notFound();
 const tab=['dati','permessi','orari','assenze'].includes(q.tab||'')?q.tab!:'dati';
 const hourMap=new Map<number,Hours>();(standard||[]).forEach(x=>hourMap.set(x.weekday,x as Hours));(hours||[]).forEach(x=>hourMap.set(x.weekday,x as Hours));
 return <><div className="owner-heading"><div><p><Link href={`/titolare/${slug}/operatori`}>← Operatori</Link></p><h1>{member.nome} {member.cognome||''}</h1><span>{member.email||'Accesso non ancora collegato'}</span></div><div className="owner-avatar owner-avatar-large">{member.nome.charAt(0)}</div></div>
 {q.saved&&<p className="owner-alert success">Modifiche salvate.</p>}{q.error&&<p className="owner-alert error">Operazione non completata. Controlla i dati.</p>}
 <nav className="owner-tabs">{['dati','permessi','orari','assenze'].map(t=><Link key={t} className={tab===t?'active':''} href={`?tab=${t}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</Link>)}</nav>
 {tab==='dati'&&<form action={saveStaffAccess} className="owner-panel owner-staff-card owner-form">
  <input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="membership_id" value={member.membership_id||''}/><input type="hidden" name="ruolo" value={member.ruolo}/>
  <div className="owner-form-grid"><label>Nome<input name="nome" required defaultValue={member.nome}/></label><label>Cognome<input name="cognome" defaultValue={member.cognome||''}/></label><label>Email<input name="email" type="email" defaultValue={member.email||''}/></label><label>Telefono<input name="telefono" defaultValue={member.telefono||''}/></label><label className="check"><input name="attivo" type="checkbox" defaultChecked={member.attivo}/> Attivo</label></div>
  <fieldset className="owner-service-checks"><legend>Servizi assegnati</legend>{services?.map(s=><label key={s.id}><input type="checkbox" name="services" value={s.id} defaultChecked={member.services.includes(s.id)}/>{s.nome}</label>)}</fieldset><button className="owner-primary">Salva dati</button>
 </form>}
 {tab==='permessi'&&<form action={saveStaffAccess} className="owner-panel owner-staff-card owner-form">
  <input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="membership_id" value={member.membership_id||''}/><input type="hidden" name="nome" value={member.nome}/><input type="hidden" name="cognome" value={member.cognome||''}/><input type="hidden" name="email" value={member.email||''}/><input type="hidden" name="telefono" value={member.telefono||''}/><input type="hidden" name="attivo" value={member.attivo?'on':''}/>{member.services.map(s=><input key={s} type="hidden" name="services" value={s}/>)}
  <p className="owner-permission-note">Cosa può fare {member.nome} nell’app di gestione.</p>
  <label className={`owner-perm-card ${member.ruolo==='operator'?'selected':''}`}><input type="radio" name="ruolo" value="operator" defaultChecked={member.ruolo==='operator'}/><b>Base</b><span>Vede solo la propria agenda e può segnare completato o assente.</span></label>
  <label className={`owner-perm-card ${member.ruolo==='staff'?'selected':''}`}><input type="radio" name="ruolo" value="staff" defaultChecked={member.ruolo==='staff'}/><b>Gestione</b><span>Gestisce servizi, operatori, agende, orari, clienti e impostazioni.</span></label><button className="owner-primary">Salva permesso</button>
 </form>}
 {tab==='orari'&&<section className="owner-hours-list">{DAYS.map(([name,weekday])=>{const day=hourMap.get(weekday)||{weekday,chiuso:true,fasce:[]};const ranges=(day.fasce?.length?day.fasce:[['09:00','13:00']]);return <form action={saveOperatorHours} className="owner-panel owner-day-editor" key={weekday}><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="weekday" value={weekday}/><header><b>{name}</b><label className="check"><input name="chiuso" type="checkbox" defaultChecked={day.chiuso}/> Chiuso</label></header>{ranges.map((r,i)=><div className="owner-range-row" key={i}><input type="time" name="start" defaultValue={r[0]}/><span>–</span><input type="time" name="end" defaultValue={r[1]}/></div>)}<button className="owner-secondary">Salva {name}</button></form>})}</section>}
 {tab==='assenze'&&<><form action={addOperatorAbsence} className="owner-panel owner-staff-card owner-form"><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><div className="owner-form-grid"><label>Data inizio<input required type="date" name="data_inizio"/></label><label>Data fine<input required type="date" name="data_fine"/></label><label className="wide">Motivo<input name="motivo" maxLength={500}/></label></div><button className="owner-primary">+ Aggiungi assenza</button></form><section className="owner-panel owner-compact-list">{(absences as Absence[]||[]).map(a=><div className="owner-list-row" key={a.id}><div><b>{a.data_inizio} – {a.data_fine}</b><span>{a.motivo||'Nessun motivo indicato'}</span></div><form action={deleteOperatorAbsence}><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><input type="hidden" name="absence_id" value={a.id}/><button className="owner-danger-link">Elimina</button></form></div>)}</section></>}
 {tab==='dati'&&<form action={removeOperator} className="owner-remove-form"><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operator_id" value={id}/><button className="owner-danger-button">Rimuovi operatore</button></form>}
 </>;
}