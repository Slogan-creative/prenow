import Link from 'next/link';
import {createServerClient} from '@/lib/supabase/server';
import {publicLogo} from '@/lib/customer-theme';

type Service={
 id:string;
 nome:string;
 durata_min?:number;
 prezzo_centesimi?:number|null;
 durata?:number;
 prezzo?:number|null;
};
type Catalog={nome:string;services:Service[]};

export default async function CustomerHome({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createServerClient();
 const [{data:catalog},{data:branding}]=await Promise.all([db.rpc('prenow_customer_catalog',{p_slug:slug}),db.rpc('prenow_customer_branding',{p_slug:slug})]);
 const cat=(catalog||{nome:slug,services:[]}) as Catalog;const logo=publicLogo(branding?.logo_url);
 const teaserServices=cat.services.slice(0,3);
 const duration=(service:Service)=>service.durata_min??service.durata??0;
 const price=(service:Service)=>service.prezzo_centesimi??service.prezzo??null;

 return <main className="claude-home">
  <section className="customer-hero">
   {logo?<div className="hero-logo-wrap"><img className="brand-logo" src={logo} alt={cat.nome}/></div>:<div className="customer-wordmark">{cat.nome}</div>}
   <h1>Prenota il tuo<br/>appuntamento</h1>
   <p>Taglio, barba e cura del dettaglio. Scegli servizio, professionista e orario.</p>
   <Link className="claude-primary" href={`/cliente/${slug}/prenota`}>Prenota ora</Link>
   <div className="home-links"><Link href={`/cliente/${slug}/appuntamenti`}>I miei appuntamenti</Link><Link href={`/cliente/${slug}/informazioni`}>Info negozio</Link></div>
  </section>

  <section className="home-services">
   <div className="section-label">Servizi</div>
   <div className="svc-teaser-card">
    {teaserServices.map((service,index)=>{
     const servicePrice=price(service);
     return <Link key={service.id} className={`svc-teaser-row${index===teaserServices.length-1?' last':''}`} href={`/cliente/${slug}/prenota?service=${service.id}`}>
      <div>
       <div className="svc-teaser-nome">{service.nome}</div>
       <div className="svc-teaser-durata">{duration(service)} min</div>
      </div>
      {servicePrice!==null&&<div className="svc-teaser-prezzo">€{Math.round(servicePrice/100)}</div>}
     </Link>;
    })}
    {cat.services.length>3&&<Link className="svc-see-all" href={`/cliente/${slug}/prenota`}>
     Vedi tutti i {cat.services.length} servizi e i prezzi ›
    </Link>}
   </div>
  </section>
 </main>;
}
