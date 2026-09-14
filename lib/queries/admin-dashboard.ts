// =============================================================================
// QUERY DASHBOARD SUPER ADMIN
// =============================================================================
// Queste sono le funzioni che sostituiscono i numeri finti del seed usato nel
// prototipo dashboard-super-admin.html. Ogni funzione qui interroga davvero
// Supabase. Vanno chiamate solo da pagine già protette da requirePlatformAdmin()
// (vedi lib/auth.ts) — non fanno loro stesse quel controllo, per restare
// funzioni pure e riutilizzabili anche altrove in futuro (es. un cron di report).
//
// Nota tecnica: usiamo createServerClient() (quello che RISPETTA la RLS), non
// createAdminClient(). Funziona comunque per un Super Admin perché ogni
// policy scritta in 0002_rls_policies.sql concede l'accesso anche quando
// is_platform_admin() è vero — vedi il commento in lib/supabase/server.ts sul
// perché preferiamo questo approccio (meno privilegi = meno rischio).
// =============================================================================
import { createServerClient } from '@/lib/supabase/server';

export type DashboardKpis = {
  applicazioniTotali: number;
  attive: number;
  inConfigurazione: number;
  sospese: number;
  clientiFinali: number;
  operatori: number;
  prenotazioniOggi: number;
  prenotazioniSettimana: number;
  prenotazioniMese: number;
  cancellazioni: number;
  noShow: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createServerClient();

  const countTenants = async (filter?: (q: any) => any) => {
    let query = supabase.from('tenants').select('*', { count: 'exact', head: true });
    if (filter) query = filter(query);
    const { count } = await query;
    return count ?? 0;
  };

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);
  const weekStart = addDays(todayStart, -todayStart.getDay());
  const weekEnd = addDays(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const countAppointmentsInRange = async (from: Date, to: Date) => {
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('stato', 'confermato')
      .gte('start_at', from.toISOString())
      .lt('start_at', to.toISOString());
    return count ?? 0;
  };

  const [
    applicazioniTotali,
    attive,
    inConfigurazione,
    sospese,
    { count: clientiFinali },
    { count: operatori },
    prenotazioniOggi,
    prenotazioniSettimana,
    prenotazioniMese,
    { count: cancellazioni },
    { count: noShow },
  ] = await Promise.all([
    countTenants(),
    countTenants((q) => q.eq('stato', 'attiva')),
    countTenants((q) => q.in('stato', ['bozza', 'configurazione'])),
    countTenants((q) => q.eq('stato', 'sospesa')),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('operators').select('*', { count: 'exact', head: true }).eq('attivo', true),
    countAppointmentsInRange(todayStart, todayEnd),
    countAppointmentsInRange(weekStart, weekEnd),
    countAppointmentsInRange(monthStart, monthEnd),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).in('stato', ['cancellato_cliente', 'cancellato_negozio']),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('stato', 'no_show'),
  ]);

  return {
    applicazioniTotali,
    attive,
    inConfigurazione,
    sospese,
    clientiFinali: clientiFinali ?? 0,
    operatori: operatori ?? 0,
    prenotazioniOggi,
    prenotazioniSettimana,
    prenotazioniMese,
    cancellazioni: cancellazioni ?? 0,
    noShow: noShow ?? 0,
  };
}

export type TenantSummary = {
  id: string;
  nome: string;
  slug: string;
  tipologia: string | null;
  stato: string;
  domain_status: string;
  created_at: string;
  updated_at: string;
  piano_nome: string | null;
  numero_operatori: number;
  numero_clienti: number;
  prenotazioni_mese: number;
};

/**
 * Elenco tenant con le colonne richieste per la schermata "Applicazioni".
 * Le tre metriche aggregate (operatori/clienti/prenotazioni mese) sono
 * calcolate con query separate per tenant: per poche decine di tenant va
 * benissimo così; se in futuro saranno centinaia, la prossima ottimizzazione
 * naturale è una vista materializzata Postgres calcolata via cron
 * (vedi ARCHITETTURA.md, sezione "Performance a scala").
 */
export async function listTenantsWithStats(): Promise<TenantSummary[]> {
  const supabase = await createServerClient();

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, nome, slug, tipologia, stato, domain_status, created_at, updated_at, subscriptions(plans(nome))')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!tenants) return [];

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const withStats = await Promise.all(
    tenants.map(async (t: any) => {
      const [{ count: numero_operatori }, { count: numero_clienti }, { count: prenotazioni_mese }] = await Promise.all([
        supabase.from('operators').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('attivo', true),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id),
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', t.id)
          .eq('stato', 'confermato')
          .gte('start_at', monthStart.toISOString()),
      ]);

      return {
        id: t.id,
        nome: t.nome,
        slug: t.slug,
        tipologia: t.tipologia,
        stato: t.stato,
        domain_status: t.domain_status,
        created_at: t.created_at,
        updated_at: t.updated_at,
        piano_nome: t.subscriptions?.[0]?.plans?.nome ?? null,
        numero_operatori: numero_operatori ?? 0,
        numero_clienti: numero_clienti ?? 0,
        prenotazioni_mese: prenotazioni_mese ?? 0,
      };
    })
  );

  return withStats;
}

export type ActivityLogEntry = {
  id: string;
  created_at: string;
  azione: string;
  tenant_id: string | null;
  tenant_nome: string | null;
};

export async function listRecentActivity(limit = 6): Promise<ActivityLogEntry[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, azione, tenant_id, tenants(nome)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    azione: row.azione,
    tenant_id: row.tenant_id,
    tenant_nome: row.tenants?.nome ?? null,
  }));
}
