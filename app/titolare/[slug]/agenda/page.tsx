import {requireTenantAccess} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';
import AgendaDateFilter from './AgendaDateFilter';

export const dynamic='force-dynamic';
const statusClass=(value:string)=>{const s=value.toLowerCase();if(s==='confermato')return 'confirmed';if(s==='completato')return 'completed';if(s.includes('cancell'))return 'cancelled';if(s.includes('show')||s.includes('assente'))return 'noshow';return 'neutral'};

export default async function Agenda({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{date?:string;operator?:string}>}){
 const {slug}=await params,q=await searchParams,ctx=await requireTenantAccess(slug);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const date=/^\d{4}-\d{2}-\d{2}$/.test(q.date||'')?q.date!:today;
 const db=await createServerClient();
 const [{data},{data:operators}]=await Promise.all([
  db.rpc('prenow_staff_agenda',{p_slug:slug,p_date:date}),
  db.from('operators').select('id,nome,cognome').eq('tenant_id',ctx.tenant_id).eq('attivo',true).order('nome')
 ]);
 let rows=(data?.appointments||[]) as any[];
 if(q.operator)rows=rows.filter(a=>a.operator_id===q.operator);
 const fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 return <>
  <div className="owner-heading"><div><p>Organizzazione</p><h1>{ctx.role==='operator'?'La mia agenda':'Agenda'}</h1><span>{ctx.role==='operator'?'Consulta esclusivamente i tuoi appuntamenti.':'Consulta gli appuntamenti dell’attività.'}</span></div>{ctx.role!=='operator'&&<a className="owner-primary" href={`/staff/${slug}/prenotazione`}>+ Nuova prenotazione</a>}</div>
  <AgendaDateFilter date={date} operator={q.operator}/>
  {ctx.role!=='operator'&&<nav className="owner-filter-chips"><a className={!q.operator?'active':''} href={`?date=${date}`}>Tutti</a>{operators?.map(o=><a className={q.operator===o.id?'active':''} href={`?date=${date}&operator=${o.id}`} key={o.id}>{o.nome}</a>)}</nav>}
  <section className="owner-panel">{!rows.length?<div className="owner-empty">Nessun appuntamento per questa data.</div>:<div className="owner-list">{rows.map(a=><article key={a.id}><time>{fmt.format(new Date(a.start_at))}</time><div><b>{a.customer}</b><span>{a.service} · {a.operator}</span></div><em className={statusClass(String(a.stato))}>{String(a.stato).replace(/_/g,' ')}</em></article>)}</div>}</section>
 </>;
}