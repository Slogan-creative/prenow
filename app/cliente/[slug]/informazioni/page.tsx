import Link from 'next/link';
import {createServerClient} from '@/lib/supabase/server';
export default async function Information({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createServerClient();const {data}=await db.rpc('prenow_customer_catalog',{p_slug:slug});const name=data?.nome||slug;
 return <main className="claude-page"><header className="claude-titlebar"><Link href={`/cliente/${slug}`} className="round-back">‹</Link><h1>Informazioni</h1></header><section className="info-body"><h2>{name}</h2><p>Servizi su appuntamento, cura e attenzione dedicate a ogni cliente.</p><div className="claude-card info-card"><div><span>Contatti</span><strong>Rivolgiti al negozio per informazioni</strong></div></div><div className="info-placeholder" aria-hidden="true"/><div className="info-actions"><Link href={`/cliente/${slug}/prenota`} className="claude-secondary">Prenota</Link><Link href={`/cliente/${slug}`} className="claude-secondary">Home</Link></div><p className="section-kicker">ORARI</p></section></main>;
}
