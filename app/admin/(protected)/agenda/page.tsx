import Link from 'next/link';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export default async function Agenda({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await requirePlatformAdmin();const q=await searchParams,db=await createServerClient();
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const date=q.date&&valid(q.date)?q.date:today,days=q.view==='week'?7:1;
 const nextDate=(offset:number)=>new Date(Date.parse(date)+offset*86400000).toISOString().slice(0,10);
 const tenant=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.tenant||'')?q.tenant:'';
 const tenants=await db.from('tenants').select('id,nome').order('nome');
 // Broad UTC window, then exact local-day filtering handles Italian DST transitions.
 let query=db.from('appointments').select('id,start_at,end_at,stato,tenants(nome),customers(nome,cognome),operators(nome),services(nome)').gte('start_at',new Date(Date.parse(date)-86400000).toISOString()).lt('start_at',new Date(Date.parse(nextDate(days))+86400000).toISOString()).order('start_at');
 if(tenant)query=query.eq('tenant_id',tenant);
 const result=await query;if(result.error||tenants.error)throw new Error('Impossibile caricare l’agenda.');
 const localDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'});
 const fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 const rows=(result.data||[]) as unknown as {id:string;start_at:string;end_at:string;stato:string;tenants:{nome:string}|null;customers:{nome:string;cognome:string|null}|null;operators:{nome:string}|null;services:{nome:string}|null}[];
 const link=(offset:number)=>`/admin/agenda?${new URLSearchParams({date:nextDate(offset),view:days===7?'week':'day',tenant:tenant||''})}`;
 return <><h1>Agenda</h1><p>Orari Europe/Rome. Visualizzazione giornaliera o sette giorni dalla data selezionata.</p><Link href="/admin/appuntamenti">Elenco e cancellazioni</Link>
 <form method="get" className="toolbar"><label>Data <input type="date" name="date" defaultValue={date} required/></label><label>Vista <select name="view" defaultValue={days===7?'week':'day'}><option value="day">Giorno</option><option value="week">Sette giorni</option></select></label>
 <label>Salone <select name="tenant" defaultValue={tenant}><option value="">Tutti</option>{tenants.data?.map(t=><option value={t.id} key={t.id}>{t.nome}</option>)}</select></label><button className="btn btn-primary">Mostra</button></form>
 <div className="toolbar"><Link href={link(-days)}>← Precedente</Link><Link href={link(days)}>Successivo →</Link>{tenant && <Link href={`/admin/applicazioni/${tenant}/disponibilita`}>Chiusure, assenze e blocchi</Link>}</div>
 {Array.from({length:days},(_,i)=>{const day=nextDate(i),items=rows.filter(r=>localDay.format(new Date(r.start_at))===day);return <section key={day}><h2>{day.split('-').reverse().join('/')}</h2>{!items.length?<p>Nessun appuntamento.</p>:<div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Orario</th><th>Salone</th><th>Cliente</th><th>Operatore</th><th>Servizio</th><th>Stato</th></tr></thead><tbody>{items.map(a=><tr key={a.id}><td>{fmt.format(new Date(a.start_at))}–{fmt.format(new Date(a.end_at))}</td><td>{a.tenants?.nome}</td><td>{a.customers?.nome} {a.customers?.cognome}</td><td>{a.operators?.nome}</td><td>{a.services?.nome}</td><td>{a.stato.replace(/_/g,' ')}</td></tr>)}</tbody></table></div>}</section>;})}</>;
}
