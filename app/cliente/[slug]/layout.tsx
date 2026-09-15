import InstallApp from './InstallApp';
import CustomerNav from './CustomerNav';
import type {Metadata} from 'next';
import type {CSSProperties} from 'react';
import {createServerClient} from '@/lib/supabase/server';
import {customerTheme,type CustomerBranding} from '@/lib/customer-theme';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 return {title:'Prenotazioni online',description:'Accedi, prenota un appuntamento e gestisci le tue prenotazioni.',manifest:`/cliente/${encodeURIComponent(slug)}/manifest.webmanifest`};
}
export default async function CustomerLayout({children,params}:{children:React.ReactNode;params:Promise<{slug:string}>}){
 const {slug}=await params;const db=await createServerClient();
 const {data,error}=await db.rpc('prenow_customer_branding',{p_slug:slug});
 const branding:CustomerBranding=error||!data?{}:data;
 return <div className="customer-ui" style={customerTheme(branding) as CSSProperties}>
  <div className="customer-app">{children}</div>
  <CustomerNav slug={slug}/>
  <InstallApp slug={slug}/>
 </div>;
}
