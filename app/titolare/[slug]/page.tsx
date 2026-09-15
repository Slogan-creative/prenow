import Link from 'next/link';
import {requireTenantAdmin} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';
export default async function OwnerDashboard({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,ctx=await requireTenantAdmin(slug),db=await createServerClient();
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const {data}=await db.rpc('prenow_owner_dashboard',{p_slug:slug,p_date:today});
 const d=(data||{today_count:0,upcoming_count:0,customers_count:0,active_services:0,next:[]}) as {today_count:number;upcoming_count:number;customers_count:number;active_services:number;next:Array<{id:string;start_at:string;customer:string;operator:string;service:string}>};
 const time=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 return <><div className="owner-heading"><div><p>Oggi</p><h1>Ciao, {ctx.nome}</h1><span>Qui trovi l’andamento della tua attività.</span></div><Link className="owner-primary" href={`/titolare/${slug}/prenota`}>+ Nuova prenotazione</Link></div><section className="owner-kpis"><article><span>Appuntamenti oggi</span><b>{d.today_count}</b></article><article><span>Prossimi appuntamenti</span><b>{d.upcoming_count}</b></article><article><span>Clienti</span><b>{d.customers_count}</b></article><article><span>Servizi attivi</span><b>{d.active_services}</b></article></section><section className="owner-panel"><div className="owner-panel-head"><div><h2>Prossimi appuntamenti</h2><p>La situazione della giornata a colpo d’occhio.</p></div><Link href={`/titolare/${slug}/agenda`}>Vedi agenda</Link></div>{!d.next?.length?<div className="owner-empty">Nessun appuntamento previsto per oggi.</div>:<div className="owner-list">{d.next.map(a=><article key={a.id}><time>{time.format(new Date(a.start_at))}</time><div><b>{a.customer}</b><span>{a.service} · {a.operator}</span></div><em>Confermato</em></article>)}</div>}</section><section className="owner-quick"><h2>Gestione rapida</h2><div><Link href={`/titolare/${slug}/impostazioni#servizi`}><b>Servizi</b><span>Prezzi, durata e disponibilità</span></Link><Link href={`/titolare/${slug}/impostazioni#operatori`}><b>Operatori</b><span>Staff e assegnazioni</span></Link><Link href={`/titolare/${slug}/impostazioni#orari`}><b>Orari</b><span>Aperture, chiusure e assenze</span></Link></div></section></>;
}
