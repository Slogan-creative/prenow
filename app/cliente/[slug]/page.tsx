import Link from 'next/link';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createServerClient} from '@/lib/supabase/server';
type Booking={id:string;start:string;end:string;stato:string;service:string;operator:string};
export default async function MyBookings({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{saved?:string;error?:string}>}){
 const {slug}=await params;const q=await searchParams;const db=await createServerClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect(`/cliente/${slug}/login`);
 const {data,error}=await db.rpc('prenow_customer_appointments',{p_slug:slug});
 async function logout(){'use server';const db=await createServerClient();await db.auth.signOut();redirect(`/cliente/${slug}/login`);}
 async function cancel(f:FormData){'use server';const db=await createServerClient();if(f.get('confirm')!=='on')redirect(`/cliente/${slug}?error=1`);const r=await db.rpc('prenow_customer_cancel',{p_slug:slug,p_booking:String(f.get('id'))});if(r.error||!r.data)redirect(`/cliente/${slug}?error=1`);revalidatePath('/admin/appuntamenti');revalidatePath(`/cliente/${slug}`);redirect(`/cliente/${slug}?saved=1`);}
 const rows=(data||[]) as Booking[];const labels:Record<string,string>={confermato:'Confermato',completato:'Completato',cancellato_cliente:'Cancellato da te',cancellato_negozio:'Cancellato dal salone',no_show:'Non presentato'};
 const format=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',dateStyle:'short',timeStyle:'short'});
 return <main className="booking"><h1>Le mie prenotazioni</h1><p>{user.email}</p><div className="toolbar"><Link className="btn btn-primary" href={`/cliente/${slug}/prenota`}>Prenota un appuntamento</Link><form action={logout}><button className="btn btn-secondary">Esci</button></form></div>
 {q.saved && <p role="status">Appuntamento cancellato.</p>}{q.error && <p role="alert">Cancellazione non riuscita: l’appuntamento potrebbe essere già cambiato o iniziato.</p>}
 {error?<p role="alert">Impossibile caricare le prenotazioni. Riprova.</p>:!rows.length?<p>Non hai ancora prenotazioni per questo salone.</p>:<>{['Prossimi appuntamenti','Storico'].map((title,i)=><section key={title}><h2>{title}</h2>{rows.filter(a=>i===0?new Date(a.start)>new Date() && a.stato==='confermato':new Date(a.start)<=new Date() || a.stato!=='confermato').map(a=><article className="settings-card" style={{marginBottom:16}} key={a.id}><h3>{a.service} · {a.operator}</h3><p>{format.format(new Date(a.start))}<br/>{labels[a.stato]}</p>{a.stato==='confermato' && new Date(a.start)>new Date() && <details><summary>Cancella prenotazione</summary><form action={cancel}><input type="hidden" name="id" value={a.id}/><label><input type="checkbox" name="confirm" required/> Confermo la cancellazione</label><button className="btn btn-danger">Cancella</button></form></details>}</article>)}</section>)}</>}
 </main>;
}
