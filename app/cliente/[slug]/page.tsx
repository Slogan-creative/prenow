import Link from 'next/link';
import {createServerClient} from '@/lib/supabase/server';
import {publicLogo} from '@/lib/customer-theme';
type Catalog={nome:string;services:{id:string;nome:string;durata:number;prezzo:number|null}[]};
export default async function CustomerHome({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createServerClient();
 const [{data:catalog},{data:branding}]=await Promise.all([db.rpc('prenow_customer_catalog',{p_slug:slug}),db.rpc('prenow_customer_branding',{p_slug:slug})]);
 const cat=(catalog||{nome:slug,services:[]}) as Catalog;const logo=publicLogo(branding?.logo_url);
 const money=(value:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value/100);
 return <main className="claude-home">
  <section className="customer-hero">
   {logo?<img className="brand-logo" src={logo} alt={cat.nome} width={360} height={160}/>:<div className="customer-wordmark">{cat.nome}</div>}
   <h1>Prenota il tuo<br/>appuntamento</h1>
   <p>Taglio, barba e cura del dettaglio. Scegli servizio, professionista e orario.</p>
   <Link className="claude-primary" href={`/cliente/${slug}/prenota`}>Prenota ora</Link>
   <div className="home-links"><Link href={`/cliente/${slug}/appuntamenti`}>I miei appuntamenti</Link><Link href={`/cliente/${slug}/informazioni`}>Info negozio</Link></div>
  </section>
  <section className="home-services"><p className="section-kicker">SERVIZI</p><div className="claude-card service-list">{cat.services.map(s=><Link key={s.id} href={`/cliente/${slug}/prenota?service=${s.id}`}><span><strong>{s.nome}</strong><small>{s.durata} min{s.prezzo!==null?` · ${money(s.prezzo)}`:''}</small></span><b aria-hidden="true">›</b></Link>)}</div></section>
 </main>;
}
