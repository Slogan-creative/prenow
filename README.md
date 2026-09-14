# Prenow — primo test Super Admin

Questo pacchetto contiene il primo modulo reale, non l'intera piattaforma.
Disponibili: login Supabase, controllo ruolo Super Admin, Dashboard con dati del database, elenco applicazioni, modifica servizi e orari, logout.
Non disponibili: prenotazione, backoffice staff, wizard, branding, notifiche, PWA installabile, separazione per sottodominio.
Il middleware di questo modulo aggiorna soltanto la sessione; la risoluzione dei tenant sarà aggiunta con la PWA.

## Caricamento GitHub
Caricare il contenuto della cartella prenow nella radice del repository.
package.json deve comparire accanto a README.md, non in una sottocartella.
Non caricare ZIP, node_modules, .next o .env.local.
Il database è già stato configurato manualmente: non rieseguire le migration originali.

## Vercel
Importare Slogan-creative/prenow. Framework Next.js, Root Directory predefinita.
Aggiungere NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN dalle impostazioni di Supabase e .env.example.
Non serve alcuna service_role key per questo modulo.
Prima usare l'indirizzo vercel.app: i domini reali saranno collegati più avanti.

## Verifica
Compilazione di produzione Next.js 15.5.24 e controllo TypeScript completati con successo.
Login con il tuo utente e lettura dei dati reali devono ancora essere verificati online.
Dopo la build: aprire /admin senza login (deve mostrare login); accedere con l'utente Super Admin; verificare Venus, piano Pro e 2 operatori; uscire e verificare nuovamente la protezione.
Provare anche un utente autenticato non amministratore: deve vedere la pagina non autorizzato.

## Sviluppo locale
npm install
npm run typecheck
npm run build
npm run dev


## Gestione applicazioni
Da Applicazioni, cliccare sul nome del salone. Si possono modificare i servizi esistenti (nome, prezzo, durata, attivazione) e le fasce orarie esistenti, salvando ogni scheda separatamente. Non richiede SQL aggiuntivo. Creazione nuovi servizi, gestione operatori e prenotazioni non incluse in questo aggiornamento.


## Prenotazione di collaudo
Nuovo flusso /prenota/venus riservato al Super Admin, raggiungibile da Applicazioni → Prova prenotazione. Eseguire UNA volta setup/booking-test.sql nel SQL Editor del progetto già configurato. La query è rieseguibile, non cancella dati né modifica le policy esistenti. Disponibilità entro 60 giorni in Europe/Rome; durata, associazioni operatore-servizio, chiusure, assenze, blocchi e appuntamenti occupati verificati nel database. Salvataggio reale, con nota Collaudo Prenow. Usare dati di prova. Le informazioni di clienti esistenti non vengono sovrascritte. Nessun invio email, account cliente, cronologia, cancellazione cliente, installazione PWA o accesso pubblico inclusi in questa versione. La compilazione applicativa è verificata; la query e il flusso reale devono essere collaudati in Supabase prima di aprire l'accesso ai clienti.


## Elenco appuntamenti
Menu Appuntamenti: elenco con filtri per applicazione e stato, 25 risultati per pagina e orari Europe/Rome. Il Super Admin può cancellare un appuntamento confermato dopo aver selezionato la conferma; lo storico rimane nel database. Non serve SQL aggiuntivo per questo aggiornamento.


## Area clienti — prove
Eseguire setup/customer-access.sql una volta nel SQL Editor; non modifica le policy delle tabelle. /cliente/venus/login: registrazione e login email/password. /cliente/venus: prossimi appuntamenti e storico, cancellazione confermata prima dell'inizio. /cliente/venus/prenota: prenotazione legata al proprio auth.uid(), con email confermata. Ogni funzione verifica l'identità; nessuna lettura diretta delle tabelle clienti è concessa. Catalogo e disponibilità sono accessibili solo dopo login. Il profilo di un cliente già esistente non viene collegato automaticamente per email: per questo caso sarà necessaria una funzione di collegamento nel gestionale. Configurare Supabase Authentication → URL Configuration: Site URL https://prenow.vercel.app e Redirect URL https://prenow.vercel.app/cliente/venus/login. Per collaudare senza sostituire la sessione admin, usare una finestra in incognito e un nuovo account con email accessibile. Nessuna notifica appuntamento, recupero password, privacy personalizzata o PWA installabile inclusi. Compilazione verificata; query e accesso cliente da verificare online.


## Interfaccia clienti mobile
Servizi a schede, orari selezionabili, riepilogo prima della conferma e pulsante disabilitato durante il salvataggio. Stile scuro con accento oro in area clienti. Non serve rieseguire SQL. Compilazione e tipi verificati; resa mobile da verificare nel browser dopo il caricamento.
