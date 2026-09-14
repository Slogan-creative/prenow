import Link from 'next/link';
import type {CSSProperties} from 'react';
import {createServerClient} from '@/lib/supabase/server';
import {customerTheme,publicLogo,type CustomerBranding} from '@/lib/customer-theme';
export default async function CustomerLayout({children,params}:{children:React.ReactNode;params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createServerClient();
 const {data,error}=await db.rpc('prenow_customer_branding',{p_slug:slug});
 // Query non installata: tema di base, senza bloccare login e prenotazioni.
 const branding:CustomerBranding=error||!data?{}:data;const logo=publicLogo(branding.logo_url);
 return <div className="customer-ui" style={customerTheme(branding) as CSSProperties}>
 {branding.nome&&<header className="customer-brand"><Link href={`/cliente/${slug}`}>
 {logo&&<img src={logo} alt="" width={56} height={56} referrerPolicy="no-referrer"/>}<span>{branding.nome}</span>
 </Link></header>}{children}</div>;
}
