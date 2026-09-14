export default function NonAutorizzatoPage() {
  return (
    <div style={{ maxWidth: 480, margin: '100px auto', padding: 24, textAlign: 'center' }}>
      <h1 className="page-title">Accesso non autorizzato</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Il tuo account non risulta abilitato alla Dashboard Super Admin. Se pensi sia un errore, chiedi a chi
        gestisce la piattaforma di aggiungerti alla tabella <code>platform_admins</code>.
      </p>
    </div>
  );
}
