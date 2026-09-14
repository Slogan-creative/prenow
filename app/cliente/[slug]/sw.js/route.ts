import {NextResponse} from 'next/server';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug))return new NextResponse(null,{status:404});
 // No fetch handler or cache storage: private pages and API responses are not cached.
 return new NextResponse("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));",{headers:{'Content-Type':'application/javascript','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Service-Worker-Allowed':`/cliente/${slug}`}});
}
