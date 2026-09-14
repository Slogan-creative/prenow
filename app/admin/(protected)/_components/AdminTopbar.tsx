export default function AdminTopbar({ nomeAdmin }: { nomeAdmin: string }) {
  // La ricerca globale (spec punto 43) non è ancora collegata a query reali:
  // è un input pronto, senza risultati finti dietro. Va implementata quando
  // decidiamo su quali entità cercare per prime (tenant? clienti finali?).
  const iniziali = nomeAdmin
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="topbar">
      <div className="search-box">
        <input placeholder="Cerca applicazioni, clienti… (non ancora collegata)" disabled />
      </div>
      <div className="topbar-right">
        <div className="account-chip">
          <div className="account-avatar">{iniziali}</div>
          <span className="account-name">{nomeAdmin}</span>
        </div>
      </div>
    </div>
  );
}
