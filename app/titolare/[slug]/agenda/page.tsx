import {requireTenantAccess} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';
import AgendaProgram from './AgendaProgram';

export const dynamic='force-dynamic';

export default async function Agenda({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{operator?:string}>}){
 const {slug}=await params,q=await searchParams,ctx=await requireTenantAccess(slug);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const endDate=new Date(today+'T12:00:00');
 endDate.setDate(endDate.getDate()+365);
 const end=[
  endDate.getFullYear(),
  String(endDate.getMonth()+1).padStart(2,'0'),
  String(endDate.getDate()).padStart(2,'0')
 ].join('-');

 const db=await createServerClient();
 const [{data},{data:operators}]=await Promise.all([
  db.rpc('prenow_staff_agenda_range',{p_slug:slug,p_start:today,p_end:end}),
  db.from('operators').select('id,nome,cognome').eq('tenant_id',ctx.tenant_id).eq('attivo',true).order('nome')
 ]);

 let rows=(data?.appointments||[]) as any[];
 if(q.operator)rows=rows.filter(a=>a.operator_id===q.operator);

 return <>
  <div className="owner-heading">
   <div>
    <p>Organizzazione</p>
    <h1>{ctx.role==='operator'?'La mia agenda':'Agenda'}</h1>
    <span>{ctx.role==='operator'?'Consulta i tuoi prossimi appuntamenti.':'Programma continuo dei prossimi appuntamenti.'}</span>
   </div>
   {ctx.role!=='operator'&&<a className="owner-primary" href={`/staff/${slug}/prenotazione`}>+ Nuova prenotazione</a>}
  </div>

  {ctx.role!=='operator'&&<nav className="owner-filter-chips agenda-operator-filters">
   <a className={!q.operator?'active':''} href="?">Tutti</a>
   {operators?.map(o=><a className={q.operator===o.id?'active':''} href={`?operator=${o.id}`} key={o.id}>{o.nome}</a>)}
  </nav>}

  <section className="owner-panel agenda-program-panel">
   <AgendaProgram appointments={rows} today={today}/>
  </section>
 </>;
}
