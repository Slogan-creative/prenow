# Collaudo unico Prenow
Ramo: codex/prenow-complete-management. Non eseguire merge prima del collaudo.
## Database isolato
Non applicare i nuovi script al progetto live.
L'ambiente di test deve replicare lo schema e le RPC esistenti; le sole nuove migrazioni non creano lo schema di base.
Applicare management.sql, remaining-management.sql, staff.sql, security-hardening.sql solo dopo revisione.
Configurarne URL e anon key nella Preview Vercel, senza cambiare Production.
Usare utenti e dati fittizi.
## Matrice di verifica
- Cliente: signup/conferma email/login/logout, refresh sessione, prenota/cancella, storico.
- Cliente: tentativi diretti INSERT/UPDATE su appointments devono fallire; RPC non devono accettare altre identità o saloni.
- Super Admin: crea app; verifica sette giorni chiusi; configura branding, orari, operatori, servizi, assegnazioni.
- Gestione: prezzo zero e vuoto; durata invalida; assegnazioni cross-tenant; disattivazione preserva storico.
- Agenda: giorno/sette giorni; mezzanotte e cambio ora legale Europe/Rome; filtro salone.
- Disponibilità: chiusura totale/parziale, assenza, blocco generale e individuale; rimozione confermata.
- Prenotazione manuale: cliente del salone; slot assegnato; due richieste simultanee producono un solo appuntamento.
- Staff: registrazione preesistente; associazione, modifica e revoca; operatore vede solo propria agenda.
- Staff: staff/responsabile cambia solo appuntamenti del proprio salone; operatore non può cambiare stati; completamento/no-show vietati prima della fine; doppio invio non sovrascrive stati già cambiati.
- Staff: test API dirette, non solo interfaccia; nessun accesso cross-tenant.
- PWA: manifest valido, installazione su Chrome/Safari, avvio standalone, nessuna cache di dati privati.
## Dipendenze ancora non completate
- Invio reale di conferme e reminder: scegliere/configurare provider email, mittente, credenziali, scheduler e retries.
- Domini: confermare dominio posseduto, DNS, alias Vercel e risoluzione tenant verificata. Nessun DNS modificato.
- Staff: cancellazione/completamento/no-show implementati; inserimento e riprogrammazione da area staff ancora da completare.
- Icone PNG 192/512 personalizzate e compatibilità completa PWA da verificare; icona SVG generica disponibile.
## Verifiche automatiche
npm ci
npm run typecheck
node tests/management-validation.cjs
npm run build
La build Vercel verifica compilazione, non sostituisce collaudo RLS o login reale.
