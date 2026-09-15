import {notFound,redirect} from 'next/navigation';
import {createServerClient} from './supabase/server';

export type OwnerContext={tenant_id:string;nome:string;slug:string;role:'tenant_admin'};

export async function requireTenantAdmin(slug:string):Promise<OwnerContext>{
 const db=await createServerClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect(`/titolare/${encodeURIComponent(slug)}/login`);
 const {data,error}=await db.rpc('prenow_owner_context',{p_slug:slug});
 if(error||!data)notFound();
 return data as OwnerContext;
}
