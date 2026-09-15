import OwnerNav from './OwnerNav';
import {createServerClient} from '@/lib/supabase/server';
import type {OwnerContext} from '@/lib/owner-auth';

export default async function OwnerLayout({children,params}:{children:React.ReactNode;params:Promise<{slug:string}>}){
 const {slug}=await params;
 const db=await createServerClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return <>{children}</>;
 const {data,error}=await db.rpc('prenow_owner_context',{p_slug:slug});
 if(error||!data)return <>{children}</>;
 const ctx=data as OwnerContext;
 return <div className="owner-shell"><OwnerNav slug={slug} nome={ctx.nome} role={ctx.role}/><main className="owner-main"><header className="owner-topbar"><div><span>{ctx.role==='tenant_admin'?'Gestione attività':ctx.role==='manager'?'Gestione operativa':'La mia agenda'}</span><b>{ctx.nome}</b></div><a href={`/cliente/${slug}`}>App cliente ↗</a></header><div className="owner-content">{children}</div></main></div>;
}
