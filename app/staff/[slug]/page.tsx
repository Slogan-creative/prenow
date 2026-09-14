import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createServerClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
type Item={id:string;start_at:string;end_at:string;stato:string;customer:string;operator:string;service:string};
export default async function StaffAgenda({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{date?:string}>}){
 const {slug}=await params,q=await searchParams,db=await createServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/staff/${encodeURIComponent(slug)}/login`);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 const date=q.date&&/^\d{4}-\d{2}-\d{2}$/.test(q.date)?q.date:today;
 const result=await db.rpc('prenow_staff_agenda',{p_slug:slug,p_date:date});
 if(result.error||!result.data)return <main className="booking"><h1>Agenda non disponibile</h1><p>Il tuo account potrebbe non essere abilitato a questo salone, oppure la configurazione staff non è ancora installata.</p><Link href={`/staff/${encodeURIComponent(slug)}/login`}>Torna al login</Link></main>;
 const data=result.data as {nome:string;role:string;appointments:Item[]},fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 async function logout(){'use server';const db=await createServerClient();await db.auth.signOut();redirect(`/staff/${encodeURIComponent(slug)}/login`);}
 return <main className="booking"><h1>{data.nome}: agenda staff</h1><p>{data.role==='operator'?'Solo i tuoi appuntamenti':'Appuntamenti del salone'} · Orari italiani</p><form action={logout}><button className="btn">Esci</button></form><form method="get"><label>Data <input type="date" name="date" required defaultValue={date}/></label><button className="btn btn-primary">Mostra</button></form>{!data.appointments.length&&<p>Nessun appuntamento.</p>}{data.appointments.map(a=><article className="settings-card" key={a.id}><h2>{fmt.format(new Date(a.start_at))}–{fmt.format(new Date(a.end_at))}</h2><p>{a.customer} · {a.operator} · {a.service}</p><p>{a.stato.replace(/_/g,' ')}</p></article>)}</main>;
}
