import { requirePlatformAdmin } from '@/lib/auth';
import { getDashboardKpis, listTenantsWithStats, listRecentActivity } from '@/lib/queries/admin-dashboard';

const STATO_LABELS: Record<string, string> = {
  bozza: 'Bozza',
  configurazione: 'Configurazione',
  attiva: 'Attiva',
  manutenzione: 'Manutenzione',
  sospesa: 'Sospesa',
  archiviata: 'Archiviata',
};
const STATO_BADGE: Record<string, string> = {
  bozza: 'muted',
  configurazione: 'warn',
  attiva: 'ok',
  manutenzione: 'warn',
  sospesa: 'bad',
  archiviata: 'muted',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Server Component: questa funzione gira SOLO sul server, mai nel browser.
// Le query a Supabase (dentro getDashboardKpis ecc.) vengono eseguite qui,
// il client riceve solo HTML già pronto — nessuna chiave/segreto arriva mai
// al browser da questa pagina.
export default async function AdminDashboardPage() {
  await requirePlatformAdmin();
  const [kpis, tenants, activity] = await Promise.all([
    getDashboardKpis(),
    listTenantsWithStats(),
    listRecentActivity(6),
  ]);

  const needsAttention = tenants.filter(
    (t) => t.domain_status !== 'ok' || t.stato === 'configurazione' || t.stato === 'bozza'
  );
  const recentTenants = tenants.slice(0, 5);

  const kpiCards: [string, number][] = [
    ['Applicazioni totali', kpis.applicazioniTotali],
    ['Attive', kpis.attive],
    ['In configurazione', kpis.inConfigurazione],
    ['Sospese', kpis.sospese],
    ['Clienti finali', kpis.clientiFinali],
    ['Operatori', kpis.operatori],
    ['Prenotazioni oggi', kpis.prenotazioniOggi],
    ['Prenotazioni settimana', kpis.prenotazioniSettimana],
    ['Prenotazioni mese', kpis.prenotazioniMese],
    ['Cancellazioni', kpis.cancellazioni],
    ['No-show', kpis.noShow],
  ];

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">
        Panoramica di tutte le applicazioni sulla piattaforma — dati letti in tempo reale da Supabase.
      </p>

      <div className="kpi-grid">
        {kpiCards.map(([label, num]) => (
          <div className="kpi-card" key={label}>
            <div className="kpi-num">{num}</div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
      </div>

      {needsAttention.length > 0 && (
        <>
          <div className="section-title">Richiede attenzione</div>
          <div className="panel" style={{ marginBottom: 24 }}>
            {needsAttention.map((t) => (
              <div className="attn-row" key={t.id}>
                <div className="attn-text">
                  <div className="attn-title">{t.nome}</div>
                  <div className="attn-sub">
                    {t.domain_status !== 'ok' ? `Dominio: ${t.domain_status}` : `Stato: ${STATO_LABELS[t.stato]}`} ·{' '}
                    {t.slug}
                  </div>
                </div>
                <span className={`badge ${STATO_BADGE[t.stato]}`}>{STATO_LABELS[t.stato]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="two-col">
        <div>
          <div className="section-title">Applicazioni recenti</div>
          <div className="panel">
            {recentTenants.map((t) => (
              <div className="list-row" key={t.id}>
                <div className="tenant-logo-fallback">{t.nome[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tname">{t.nome}</div>
                  <div className="tname-sub mono">{t.slug}</div>
                </div>
                <span className={`badge ${STATO_BADGE[t.stato]}`}>{STATO_LABELS[t.stato]}</span>
              </div>
            ))}
            {recentTenants.length === 0 && <div className="empty-state">Nessuna applicazione ancora creata.</div>}
          </div>
        </div>
        <div>
          <div className="section-title">Attività recente</div>
          <div className="panel">
            {activity.length === 0 && <div className="empty-state">Nessuna attività registrata.</div>}
            {activity.map((l) => (
              <div className="log-item" key={l.id}>
                <div className="log-time">{formatDateTime(l.created_at)}</div>
                <div>
                  <b>{l.tenant_nome ?? '—'}</b>
                  <br />
                  <span style={{ color: 'var(--text-muted)' }}>{l.azione}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
