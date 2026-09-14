'use server';
import { requirePlatformAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function saveSettings(form: FormData) {
  await requirePlatformAdmin();
  const tenant = String(form.get('tenant'));
  const path = `/admin/applicazioni/${tenant}`;
  const fail = (message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
  if (!/^[0-9a-f-]{36}$/i.test(tenant)) redirect('/admin/applicazioni');
  const db = await createServerClient();
  const { data: owner, error: ownerError } = await db.from('tenants').select('id').eq('id', tenant).maybeSingle();
  if (ownerError || !owner) fail('Applicazione non disponibile.');
  const id = String(form.get('id'));
  if (form.get('kind') === 'service') {
    const nome = String(form.get('nome') || '').trim();
    const durata = Number(form.get('durata'));
    const raw = String(form.get('prezzo') || '').trim().replace(',', '.');
    if (!nome || nome.length > 120 || !Number.isInteger(durata) || durata <= 0 || durata > 1440 || durata % 15) fail('Controlla nome e durata: usa multipli di 15 minuti.');
    if (raw && (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) > 100000)) fail('Inserisci un prezzo valido con massimo due decimali.');
    const { data, error } = await db.from('services').update({nome, durata_min: durata, prezzo_centesimi: raw ? Math.round(Number(raw)*100) : null, attivo: form.get('attivo') === 'on', updated_at: new Date().toISOString()}).eq('tenant_id', tenant).eq('id', id).select('id');
    if (error || !data?.length) fail('Servizio non salvato. Riprova.');
  } else if (form.get('kind') === 'hours') {
    const chiuso = form.get('chiuso') === 'on';
    const fasce: {da:string; a:string}[] = [];
    if (!chiuso) for (let i=0; i<2; i++) {
      const da = String(form.get(`da${i}`) || '');
      const a = String(form.get(`a${i}`) || '');
      if (!da && !a) continue;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(da) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a) || da >= a) fail('Ogni fascia deve avere un inizio precedente alla fine.');
      fasce.push({da,a});
    }
    fasce.sort((x,y)=>x.da.localeCompare(y.da));
    if (!chiuso && (!fasce.length || (fasce.length === 2 && fasce[0].a > fasce[1].da))) fail('Inserisci almeno una fascia senza sovrapposizioni.');
    const {data,error} = await db.from('business_hours').update({chiuso,fasce}).eq('tenant_id',tenant).eq('id',id).is('operator_id',null).select('id');
    if (error || !data?.length) fail('Orario non salvato. Riprova.');
  } else fail('Operazione non valida.');
  revalidatePath(path);
  redirect(`${path}?saved=1`);
}
