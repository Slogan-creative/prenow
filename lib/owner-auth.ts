import {redirect} from 'next/navigation';
import {createServerClient} from './supabase/server';

export type OwnerRole='tenant_admin'|'staff'|'operator';
export type OwnerContext={tenant_id:string;nome:string;slug:string;role:OwnerRole;operator_id:string|null};

export async function requireTenantAccess(slug:string,allowed:OwnerRole[]=['tenant_admin','staff','operator']):Promise<OwnerContext>{
 const db=await createServerClient();
 const {data:{user}}=await db.auth.getUser();
 const loginPath=`/titolare/${encodeURIComponent(slug)}/login`;
 if(!user)redirect(loginPath);
 const {data,error}=await db.rpc('prenow_owner_context',{p_slug:slug});
 if(error||!data)redirect(`${loginPath}?error=unauthorized`);
 const context=data as OwnerContext;
 if(!allowed.includes(context.role))redirect(`/titolare/${encodeURIComponent(slug)}?error=forbidden`);
 return context;
}

export const requireTenantAdmin=(slug:string)=>requireTenantAccess(slug,['tenant_admin']);
