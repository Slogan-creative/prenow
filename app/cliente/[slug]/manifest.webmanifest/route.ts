import {NextResponse} from 'next/server';
import {createServerClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug))return new NextResponse(null,{status:404});
 const db=await createServerClient();const {data,error}=await db.rpc('prenow_customer_branding',{p_slug:slug});
 if(error||!data)return new NextResponse(null,{status:404});
 const color=(v:unknown,fallback:string)=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:fallback;
 return NextResponse.json({id:`/cliente/${slug}`,name:data.nome||'Prenow',short_name:String(data.nome||'Prenow').slice(0,20),lang:'it',start_url:`/cliente/${slug}`,scope:`/cliente/${slug}`,display:'standalone',background_color:color(data.color_bg,'#15130F'),theme_color:color(data.color_primary,'#C79A45'),icons:[{src:'/prenow-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},{headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-store'}});
}
