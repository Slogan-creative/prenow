import Link from 'next/link';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requirePlatformAdmin} from '@/lib/auth';
import {createServerClient} from '@/lib/supabase/server';
type Row={id:string;tenant_id:string;start_at:string;end_at:string;stato:string;note:string|null;custom_service_name:string|null;tenants:{nome:string}|null;customers:{nome:string;cognome:string|null;email:string|null;telefono:string|null}|null;operators:{nome:string}|null;services:{nome:string}|null};
export default async function Appointments({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 await requirePlatformAdmin(); const q=await searchParams; const db=await createServerClient();
 const page=Math.max(1,Math.min(100000,Number.isInteger(Number(q.page))?Number(q.page):1));
 const tenant=/^[0-9a-f-]{36}$/i.test(q.tenant||'')?q.tenant:'';
 const statuses:Record<string,string>={confermato:'Confermato',completato:'Completato',cancellato_cliente:'Cancellato dal cliente',cancellato_negozio:'Cancellato dal salone',no_show:'Non presentato'};
 const status=q.status && statuses[q.status]?q.status:'';
 const t=await db.from('tenants').select('id,nome').order('nome');
 let query=db.from('appointments').select('id,tenant_id,start_at,end_at,stato,note,custom_service_name,tenants(nome),customers(nome,cognome,email,telefono),operators(nome),services(nome)',{count:'exact'}).order('start_at',{ascending:false}).order('id').range((page-1)*25,page*25-1);
 if(tenant)query=query.eq('tenant_id',tenant);if(status)query=query.eq('stato',status);
 const {data,error,count}=await query;
 if(error || t.error)throw new Error('Impossibile caricare gli appuntamenti. Riprova.');
 const rows=(data||[]) as unknown as Row[];
 async function cancel(form:FormData) {
  'use server'; await requirePlatformAdmin();
  const db=await createServerClient();const id=String(form.get('id'));const tenant=String(form.get('tenant'));
  if(form.get('confirm')!=='on')redirect('/admin/appuntamenti?error=Conferma%20la%20cancellazione.');
  const {data,error}=await db.from('appointments').update({stato:'cancellato_negozio',updated_at:new Date().toISOString()}).eq('id',id).eq('tenant_id',tenant).eq('stato','confermato').select('id');
  if(error || !data?.length)redirect('/admin/appuntamenti?error=Appuntamento%20non%20cancellato%3A%20potrebbe%20essere%20gi%C3%A0%20cambiato.');
  revalidatePath('/admin');revalidatePath('/admin/appuntamenti');
  redirect('/admin/appuntamenti?saved=1');
 }
 const fmt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',dateStyle:'short',timeStyle:'short'});
 const time=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'});
 const pageLink=(p:number)=>`/admin/appuntamenti?${new URLSearchParams({page:String(p),tenant:tenant||'',status})}`;
 return <><h1 className="page-title">Appuntamenti</h1><p>Orari italiani. La cancellazione conserva lo storico e libera la disponibilità dell’operatore.</p>
 {q.saved && <p role="status" style={{color:'var(--success)'}}>Appuntamento cancellato. L’orario è tornato disponibile.</p>}
 {q.error && <p role="alert" style={{color:'var(--danger)'}}>{q.error}</p>}
 <form method="get" className="toolbar"><div className="field"><label htmlFor="tenant">Applicazione</label><select id="tenant" name="tenant" defaultValue={tenant}><option value="">Tutte</option>{t.data?.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></div><div className="field"><label htmlFor="status">Stato</label><select id="status" name="status" defaultValue={status}><option value="">Tutti</option>{Object.entries(statuses).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><button className="btn btn-primary">Filtra</button><Link href="/admin/appuntamenti">Azzera filtri</Link></form>
 <p>{count||0} appuntamenti · Pagina {page}</p>
 <div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Quando</th><th>Salone</th><th>Cliente</th><th>Operatore e servizio</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}>
 <td>{fmt.format(new Date(a.start_at))} – {time.format(new Date(a.end_at))}</td><td>{a.tenants?.nome||'—'}</td><td>{a.customers?.nome} {a.customers?.cognome}<div className="tname-sub">{a.customers?.email}<br/>{a.customers?.telefono}</div></td><td>{a.operators?.nome}<br/>{a.custom_service_name||a.services?.nome||'—'}{a.note==='Collaudo Prenow' && <div className="tname-sub">Prenotazione di prova</div>}</td><td>{statuses[a.stato]}</td><td>{a.stato==='confermato' && <details><summary> cancella appuntamento</summary><form action={cancel} style={{marginTop:12}}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="tenant" value={a.tenant_id}/><label><input type="checkbox" name="confirm" required/> Confermo la cancellazione</label><br/><button className="btn btn-danger btn-sm" style={{marginTop:10}}>Cancella appuntamento</button></form></details>}</td></tr>)}</tbody></table></div>
 {!rows.length && <p>Nessun appuntamento con questi filtri.</p>}
 <div className="toolbar" style={{marginTop:20}}>{page>1 && <Link href={pageLink(page-1)}>← Precedente</Link>}{page*25<(count||0) && <Link href={pageLink(page+1)}>Successiva →</Link>}</div></>;
}
