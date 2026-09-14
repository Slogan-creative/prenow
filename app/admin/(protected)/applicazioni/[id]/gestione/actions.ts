'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import {
  requiredName,
  serviceDuration,
  servicePrice,
  entityId,
  assignmentIds,
} from '@/lib/management-validation';

export async function saveResource(form: FormData) {
  await requirePlatformAdmin();

  let tenant: string;

  try {
    tenant = entityId(form.get('tenant'));
  } catch {
    redirect('/admin/applicazioni');
  }

  const path = `/admin/applicazioni/${tenant}/gestione`;

  const fail = (message: string): never =>
    redirect(`${path}?error=${encodeURIComponent(message)}`);

  let input: {
    p_tenant: string;
    p_kind: string;
    p_id: string | null;
    p_name: string;
    p_active: boolean;
    p_duration: number | null;
    p_price: number | null;
    p_services: string[];
  };

  try {
    const kind = form.get('kind');

    if (kind !== 'service' && kind !== 'operator') {
      throw new Error('Operazione non valida.');
    }

    const rawId = form.get('id');

    input = {
      p_tenant: tenant,
      p_kind: kind,
      p_id: rawId ? entityId(rawId) : null,
      p_name: requiredName(form.get('nome')),
      p_active: form.get('attivo') === 'on',
      p_duration:
        kind === 'service'
          ? serviceDuration(form.get('durata'))
          : null,
      p_price:
        kind === 'service'
          ? servicePrice(form.get('prezzo'))
          : null,
      p_services:
        kind === 'operator'
          ? assignmentIds(form.getAll('services'))
          : [],
    };
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : 'Controlla i dati inseriti.',
    );
  }

  const db = await createServerClient();
  const { data, error } = await db.rpc(
    'prenow_manage_resource',
    input!,
  );

  if (error || !data) {
    fail(
      error?.code === 'PGRST202'
        ? 'Configurazione mancante: esegui setup/management.sql.'
        : 'Salvataggio non riuscito. Riprova; se persiste, verifica i log Supabase.',
    );
  }

  revalidatePath(path);
  revalidatePath(`/admin/applicazioni/${tenant}`);
  revalidatePath('/cliente', 'layout');

  redirect(`${path}?saved=1`);
}
