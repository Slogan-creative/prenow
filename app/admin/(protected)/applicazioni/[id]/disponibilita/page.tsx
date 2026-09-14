import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
import {entityId} from '@/lib/management-validation';
import {saveAvailability} from './actions';
export const dynamic='force-dynamic';
export default async function Availability({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string;error?:string}>}){
 await requirePlatformAdmin();const {id}=await params;try{entityId(id);}catch{notFound();}
 const q=await searchParams,db=await createServerClient();
 const [tenant,operators,closures,absences,blocks]=await Promise.all([
 db.from('tenants').select('nome').eq('id',id).maybeSingle(),
 db.from('operators').select('id,nome').eq('tenant_id',id).order('nome'),
 db.from('closures').select('*').eq('tenant_id',id).order('data_inizio'),
 db.from('operator_absences').select('*').eq('tenant_id',id).order('data_inizio'),
 db.from('manual_blocks').select('*').eq('tenant_id',id).order('data')]);
 if([tenant,operators,closures,absences,blocks].some(r=>r.error))throw new Error('Impossibile caricare la disponibilità.');
 if(!tenant.data)notFound();
 const sections=[{kind:'closures',label:'Chiusure del salone',rows:closures.data||[]},{kind:'operator_absences',label:'Assenze operatori',rows:absences.data||[]},{kind:'manual_blocks',label:'Blocchi orari',rows:blocks.data||[]}];
 return <><Link href={`/admin/applicazioni/${id}`}>← Configurazione applicazione</Link><h1>{tenant.data.nome}: disponibilità</h1>
 <p>Queste regole impediscono nuove prenotazioni. Gli appuntamenti già confermati non vengono cancellati: controlla eventuali conflitti nell’agenda.</p>
 <Link href={`/admin/agenda?tenant=${id}`}>Apri agenda</Link>
 {q.saved && <p role="status">Disponibilità aggiornata.</p>}{q.error && <p role="alert">{q.error}</p>}
 {sections.map(s=><section key={s.kind}><h2>{s.label}</h2><form action={saveAvailability} className="settings-card">
 <input type="hidden" name="tenant" value={id}/><input type="hidden" name="kind" value={s.kind}/>
 <label>Motivo <input name="motivo" required maxLength={120}/></label>
 <label>Dal <input name="dal" type="date" required/></label>
 {s.kind!=='manual_blocks' && <><label>Al <input name="al" type="date" required/></label><label><input name="all" type="checkbox" defaultChecked/> Tutto il giorno (ignora la fascia oraria)</label></>}
 {s.kind!=='closures' && <label>Operatore <select name="operator" required={s.kind==='operator_absences'}><option value="">Tutti gli operatori</option>{operators.data?.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select></label>}
 <label>Dalle <input type="time" name="from"/></label><label>Alle <input type="time" name="to"/></label>
 <button className="btn btn-primary">Aggiungi</button></form>
 {s.rows.length===0 && <p>Nessuna regola configurata.</p>}
 {s.rows.map(r=><div className="settings-card" key={r.id}><strong>{r.motivo}</strong><p>{r.data || r.data_inizio}{r.data_fine && ` — ${r.data_fine}`} · {r.tutto_il_giorno?'Tutto il giorno':`${r.ora_inizio} — ${r.ora_fine}`} {r.operator_id && ` · ${operators.data?.find(o=>o.id===r.operator_id)?.nome || 'Operatore'}`}</p>
 <form action={saveAvailability}><input type="hidden" name="tenant" value={id}/><input type="hidden" name="kind" value={s.kind}/><input type="hidden" name="id" value={r.id}/><input type="hidden" name="remove" value="on"/>
 <label><input type="checkbox" name="confirm" required/> Confermo la rimozione di questa regola</label><button className="btn btn-danger">Rimuovi regola</button></form></div>)}</section>)}</>;
}
