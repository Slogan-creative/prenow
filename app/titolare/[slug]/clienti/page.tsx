import Link from 'next/link';
import {requireTenantManager} from '@/lib/owner-auth';
import {createServerClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';
export default async function Customers({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{q?:string}>}){
 const {slug}=await params,q=await searchParams,ctx=await requireTenantManager(slug),db=await createServerClient();
 let query=db.from('customers').select('id,nome,cognome,email,telefono,created_at').eq('tenant_id',ctx.tenant_id).order('created_at',{ascending:false}).limit(200);
 if(q.q)query=query.or(`nome.ilike.%${q.q}%,cognome.ilike.%${q.q}%,email.ilike.%${q.q}%,telefono.ilike.%${q.q}%`);
 const {data}=await query;
 return <><div className="owner-heading"><div><p>Rubrica</p><h1>Clienti</h1><span>Contatti raccolti dalle prenotazioni.</span></div></div>
 <form className="owner-search"><input name="q" placeholder="Cerca per nome, email o telefono" defaultValue={q.q||''}/><button>Cerca</button></form>
 <section className="owner-panel owner-customer-list">{data?.map(c=><article className="owner-customer-row" key={c.id}><div className="owner-avatar">{c.nome.charAt(0)}</div><div className="owner-customer-copy"><b>{c.nome} {c.cognome}</b><span title={c.email||''}>{c.email||'Email non indicata'}</span><span>{c.telefono||'—'}</span></div><Link className="owner-quick-book" title={`Nuovo appuntamento per ${c.nome}`} aria-label={`Nuovo appuntamento per ${c.nome}`} href={`/staff/${encodeURIComponent(slug)}/prenotazione?customer=${encodeURIComponent(c.id)}`}>＋</Link></article>)}{!data?.length&&<div className="owner-empty">Nessun cliente trovato.</div>}</section></>;
}
