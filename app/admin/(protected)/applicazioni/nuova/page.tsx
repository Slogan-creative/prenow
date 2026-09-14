import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
export default async function NewApplication({searchParams}:{searchParams:Promise<{error?:string}>}){
 await requirePlatformAdmin();const q=await searchParams;
 async function create(form:FormData){
 'use server';await requirePlatformAdmin();
 const name=String(form.get('name')||'').trim(),slug=String(form.get('slug')||'').trim().toLowerCase();
 if(!name||name.length>120||!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug))redirect('/admin/applicazioni/nuova?error=Controlla%20nome%20e%20indirizzo.');
 const db=await createServerClient();const r=await db.rpc('prenow_create_application',{p_name:name,p_slug:slug});
 if(r.error || !r.data)redirect('/admin/applicazioni/nuova?error='+encodeURIComponent(r.error?.code==='PGRST202'?'Funzione non installata: collaudare setup/remaining-management.sql nel database di test.':'Creazione non riuscita. Verifica che l’indirizzo sia libero.'));
 redirect(`/admin/applicazioni/${r.data}`);
 }
 return <><Link href="/admin/applicazioni">← Applicazioni</Link><h1>Nuova applicazione</h1><p>Verrà creata in configurazione, con tutti i giorni chiusi. Configura logo, orari, servizi e operatori prima di distribuirla. La creazione non configura automaticamente domini o DNS.</p>
 {q.error&&<p role="alert">{q.error}</p>}<form action={create} className="settings-card"><label>Nome <input name="name" required maxLength={120}/></label><label>Indirizzo identificativo <input name="slug" required minLength={3} maxLength={48} pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]" placeholder="nome-attivita"/></label><p>Solo lettere minuscole, numeri e trattini; questo identificativo comparirà nel percorso dell’app.</p><button className="btn btn-primary">Crea applicazione</button></form></>;
}
