import OwnerNav from './OwnerNav';
import {requireTenantAdmin} from '@/lib/owner-auth';

export default async function OwnerLayout({children,params}:{children:React.ReactNode;params:Promise<{slug:string}>}){
 const {slug}=await params;const ctx=await requireTenantAdmin(slug);
 return <div className="owner-shell"><OwnerNav slug={slug} nome={ctx.nome}/><main className="owner-main"><header className="owner-topbar"><div><span>Gestione attività</span><b>{ctx.nome}</b></div><a href={`/cliente/${slug}`}>App cliente ↗</a></header><div className="owner-content">{children}</div></main></div>;
}
