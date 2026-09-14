import { requirePlatformAdmin } from '@/lib/auth';
import { listTenantsWithStats } from '@/lib/queries/admin-dashboard';
export default async function Applications() {
  await requirePlatformAdmin();
  const tenants = await listTenantsWithStats();
  return <><h1 className="page-title">Applicazioni</h1>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:16}}>
    <thead><tr><th>Applicazione</th><th>Piano</th><th>Stato</th><th>Operatori</th><th>Indirizzo previsto</th><th>Collaudo</th></tr></thead>
    <tbody>{tenants.map(t => <tr key={t.id}><td><a href={`/admin/applicazioni/${t.id}`}>{t.nome}</a></td><td>{t.piano_nome || '—'}</td><td>{t.stato}</td><td>{t.numero_operatori}</td><td>{t.slug}.prenow.it</td><td><a href={`/prenota/${t.slug}`}>Prova prenotazione</a></td></tr>)}</tbody>
    </table></div><p>L'applicazione di prenotazione è ancora in preparazione.</p></>;
}
