// =============================================================================
// CONTROLLO ACCESSO — SUPER ADMIN
// =============================================================================
// Ogni pagina sotto /app/admin deve iniziare chiamando requirePlatformAdmin().
// Nota bene: questo NON è "il" controllo di sicurezza — quello vero è la RLS
// nel database (0002_rls_policies.sql), che blocca comunque le query anche
// se questa funzione avesse un bug. Questo controllo serve solo per
// l'esperienza utente (reindirizzare chi non è autorizzato prima ancora che
// provi a fare una query), non è l'unica linea di difesa.
// =============================================================================
import { redirect } from 'next/navigation';
import { createServerClient } from './supabase/server';

export async function requirePlatformAdmin() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  const { data: admin } = await supabase
    .from('platform_admins')
    .select('user_id, nome')
    .eq('user_id', user!.id)
    .maybeSingle();

  if (!admin) {
    redirect('/admin/non-autorizzato');
  }

  return { userId: user!.id, nome: admin!.nome as string };
}
