import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { saveSettings } from './actions';

export default async function Settings({params, searchParams}: {params: Promise<{id:string}>; searchParams: Promise<{saved?:string;error?:string}>}) {
  await requirePlatformAdmin();
  const {id} = await params;
  const message = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createServerClient();
  const [tenant, services, hours, operators, branding] = await Promise.all([
    db.from('tenants').select('nome').eq('id',id).maybeSingle(),
    db.from('services').select('id,nome,durata_min,prezzo_centesimi,attivo').eq('tenant_id',id).order('ordine'),
    db.from('business_hours').select('id,weekday,chiuso,fasce').eq('tenant_id',id).is('operator_id',null).order('weekday'),
    db.from('operators').select('nome').eq('tenant_id',id),
    db.from('tenant_branding').select('logo_url,color_primary,color_bg,color_text').eq('tenant_id',id).maybeSingle()
  ]);
  if (tenant.error || services.error || hours.error || operators.error || branding.error) throw new Error('Impossibile leggere la configurazione. Riprova.');
  if (!tenant.data) notFound();
  const days = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  return <><Link href="/admin/applicazioni">← Applicazioni</Link><h1 className="page-title">{tenant.data.nome}</h1>
    {message.saved && <p role="status" style={{color:'var(--success)'}}>Modifica salvata.</p>}
    {message.error && <p role="alert" style={{color:'var(--danger)'}}>{message.error}</p>}
    <p>Operatori: {operators.data?.map(o=>o.nome).join(', ') || 'Nessuno'}.</p>
    <h2>Personalizzazione</h2><p>Questi dati definiscono l’identità grafica dell’app cliente.</p>
    {branding.data && <form action={saveSettings} className="settings-card branding-form">
      <input type="hidden" name="tenant" value={id}/><input type="hidden" name="kind" value="branding"/>
      <div className="field"><label htmlFor="branding-name">Nome visualizzato</label><input id="branding-name" name="nome" defaultValue={tenant.data.nome} required maxLength={120}/></div>
      <div className="field"><label htmlFor="branding-logo">Logo (URL HTTPS, facoltativo)</label><input id="branding-logo" name="logo_url" type="url" defaultValue={branding.data.logo_url || ''} placeholder="https://…"/></div>
      <div className="field-row"><div className="field"><label htmlFor="branding-primary">Colore principale</label><input id="branding-primary" name="primary_color" type="text" pattern="#[0-9a-fA-F]{6}" defaultValue={branding.data.color_primary}/></div><div className="field"><label htmlFor="branding-bg">Sfondo</label><input id="branding-bg" name="background_color" type="text" pattern="#[0-9a-fA-F]{6}" defaultValue={branding.data.color_bg}/></div><div className="field"><label htmlFor="branding-text">Testo</label><input id="branding-text" name="text_color" type="text" pattern="#[0-9a-fA-F]{6}" defaultValue={branding.data.color_text}/></div></div>
      <button className="btn btn-primary" type="submit">Salva personalizzazione</button>
    </form>}
    <h2>Servizi</h2><p>Salva ogni servizio dopo averlo modificato. I servizi disattivati restano nello storico.</p>
    <div className="settings-grid">{services.data?.map(s=><form action={saveSettings} className="settings-card" key={s.id}>
      <input type="hidden" name="tenant" value={id}/><input type="hidden" name="id" value={s.id}/><input type="hidden" name="kind" value="service"/>
      <div className="field"><label htmlFor={`name-${s.id}`}>Nome servizio</label><input id={`name-${s.id}`} name="nome" defaultValue={s.nome} required maxLength={120}/></div>
      <div className="field-row"><div className="field"><label htmlFor={`price-${s.id}`}>Prezzo (€)</label><input id={`price-${s.id}`} name="prezzo" type="number" min="0" max="100000" step="0.01" defaultValue={s.prezzo_centesimi === null ? '' : (s.prezzo_centesimi/100).toFixed(2)}/><div className="field-hint">Vuoto: prezzo non mostrato.</div></div>
      <div className="field"><label htmlFor={`duration-${s.id}`}>Durata (minuti)</label><input id={`duration-${s.id}`} name="durata" type="number" min="15" max="1440" step="15" defaultValue={s.durata_min} required/></div></div>
      <label><input type="checkbox" name="attivo" defaultChecked={s.attivo}/> Servizio attivo</label><button className="btn btn-primary" type="submit">Salva servizio</button>
    </form>)}</div>
    <h2>Orari del salone</h2><p>Puoi inserire una o due fasce al giorno. Seleziona “Chiuso” per i giorni di chiusura.</p>
    <div className="settings-grid">{hours.data?.sort((a,b)=>((a.weekday+6)%7)-((b.weekday+6)%7)).map(h=><form action={saveSettings} className="settings-card" key={h.id}>
      <h3>{days[h.weekday]}</h3><input type="hidden" name="tenant" value={id}/><input type="hidden" name="id" value={h.id}/><input type="hidden" name="kind" value="hours"/>
      <label><input type="checkbox" name="chiuso" defaultChecked={h.chiuso}/> Chiuso</label>
      {[0,1].map(i=><div className="field-row" key={i}><div className="field"><label htmlFor={`from-${h.id}-${i}`}>Fascia {i+1}: dalle</label><input id={`from-${h.id}-${i}`} type="time" name={`da${i}`} defaultValue={h.fasce?.[i]?.da || ''}/></div><div className="field"><label htmlFor={`to-${h.id}-${i}`}>Alle</label><input id={`to-${h.id}-${i}`} type="time" name={`a${i}`} defaultValue={h.fasce?.[i]?.a || ''}/></div></div>)}
      <button className="btn btn-primary" type="submit">Salva {days[h.weekday]}</button>
    </form>)}</div>
  </>;
}
