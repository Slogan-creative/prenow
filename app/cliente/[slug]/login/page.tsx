import {createServerClient} from '@/lib/supabase/server';
import {publicLogo} from '@/lib/customer-theme';
import LoginForm from './LoginForm';

type Branding={logo_url?:string|null};

export default async function Login({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const db=await createServerClient();
 const {data}=await db.rpc('prenow_customer_branding',{p_slug:slug});
 const branding=(data||{}) as Branding;
 return <LoginForm slug={slug} logo={publicLogo(branding.logo_url)}/>;
}
