# Domus Neapolis

Sito HTML con server Node.js 22+ senza dipendenze. Avvio: `npm start`. Verifica: `npm test`.

## Configurazione

1. Crea un progetto Supabase ed esegui `supabase/001_products.sql`, poi `supabase/003_categories.sql` nel SQL Editor. Il primo script importa soltanto i due prodotti reali con foto, San Gennaro e D10S; non sovrascrive prodotti o prezzi esistenti. Il secondo abilita le categorie personalizzate. Se il database prodotti esiste già, basta eseguire `003_categories.sql` prima del nuovo deploy.
2. Copia `.env.example` in `.env`. Imposta URL Supabase e chiave **secret/server** (oppure legacy service_role). Non inserire queste chiavi nei file pubblici. Le tabelle hanno RLS attiva e nessun accesso anonimo: tutte le richieste passano dal server.
3. Imposta `ADMIN_EMAIL`, una `ADMIN_PASSWORD` casuale di almeno 16 caratteri e `SESSION_SECRET` casuale di almeno 32 caratteri. Per generare un segreto: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Accesso su `/admin.html`. Nessuna registrazione amministratori pubblica. Per revocare tutte le sessioni cambia SESSION_SECRET.
4. Imposta su Render `SITE_URL=https://domusfour.it` e usa HTTPS in produzione. Il dominio attuale è ospitato su Vercel: le API devono passare dal proxy descritto qui sotto. In locale usa `SITE_URL=http://localhost:3000`.
5. Su Render usa questo repository completo per il Web Service Node: Root Directory vuota (radice del repository), Build Command `npm install`, Start Command `npm start`, Health Check Path `/health`. Se il servizio era collegato al vecchio repository backend, collega questo repository e rimuovi l'eventuale Root Directory `domus-backend`. Il servizio deve includere sia `server/` sia `public/`.

## Dominio Vercel e API Render

Il frontend pubblico è `https://domusfour.it`, mentre il backend è `https://domusfour.onrender.com`. I file `vercel.json` inoltrano `/api/*` e `/health` a Render: il browser continua a usare il dominio del sito, anche per il cookie HttpOnly dell'admin. Questo è un proxy, non un redirect del browser. Non servono chiamate cross-origin dal frontend né cookie di terze parti.

Se la Root Directory del progetto Vercel è la radice del repository, viene usato `vercel.json` con output `public`. Se è `public`, viene usato `public/vercel.json`, senza cambiare la Root Directory. Le regole di inoltro dei due file devono rimanere uguali. Fare push e attendere un nuovo deploy Vercel per applicarle; un deploy soltanto su Render non aggiorna queste regole.

Apri l'admin da `https://domusfour.it/admin.html`. Aprirlo dal dominio Render quando `SITE_URL` è `https://domusfour.it` produce intenzionalmente 403 alle richieste di modifica. Non cambiare SITE_URL al dominio Render per aggirare il controllo: deve corrispondere al dominio usato dai visitatori e dai link newsletter. `www.domusfour.it` è un'origine diversa e richiede un dominio/certificato valido e un redirect al dominio principale prima di usarlo.

Dopo il deploy, `https://domusfour.it/health` deve rispondere con JSON `{"ok":true}`; `/api/products` deve restituire l'elenco e `/api/admin/session` deve restituire JSON con stato 401 quando non si è autenticati. Un 404 su queste rotte indica che il proxy Vercel non è applicato. Un 403 al login indica che l'origine non coincide con SITE_URL. Non pubblicare credenziali o risposte contenenti sessioni nei log di debug.

## Backend unificato e contatti Telegram

Il vecchio backend è integrato in `server/contact.js`, importato dal server principale: nessun secondo processo da avviare e nessuna cartella da spostare. `POST /api/contact` mantiene i campi `nome`, `email`, `numero`, `motivo`, `messaggio` e l'invio Telegram preesistente. Accetta JSON e form URL-encoded, applica limiti ai campi e alle richieste, e restituisce gli errori di invio senza mostrare credenziali al client. `/health` restituisce lo stato di raggiungibilità del server, non verifica i servizi esterni.

Su Render conserva `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` già configurati; aggiungi le nuove variabili di `.env.example`. `SITE_URL` autorizza il sito per i contatti. `ALLOWED_ORIGINS` può contenere origini aggiuntive separate da virgola per il solo form contatti, mantenendo la compatibilità con il vecchio frontend durante il passaggio. Questa opzione non autorizza accessi incrociati ad admin o newsletter. Le chiamate contatti senza Origin restano accettate come nel backend originale.

`public/js/form.js` ora usa `/api/contact`, sullo stesso dominio del sito. Per pubblicare l'integrazione fai il push di questo progetto (`C:\domus-neapolis`); la vecchia cartella sul Desktop rimane una copia di riferimento e non contiene le modifiche integrate. Prima di dismettere il vecchio servizio, verifica il dominio, l'accesso admin, un messaggio di prova Telegram e la newsletter sul nuovo deploy.

## Gestione prodotti

La pagina Collezione è stata rimossa: il vecchio indirizzo porta ai prodotti Neapolis. Non sono più disponibili Maschere, Portafortuna e i sei articoli dimostrativi con immagini SVG; questi vengono esclusi dalle API pubbliche e dall'elenco admin anche nei database già configurati. Le nuove installazioni importano solo i due prodotti reali. Facoltativamente esegui `supabase/002_retire_sample_products.sql` per mettere in bozza anche i vecchi record nel database, senza cancellarli né modificare i prezzi dei prodotti reali.

### Categorie personalizzate

Apri l'admin, sezione **Categorie**, scrivi un nome (es. San Valentino) e premi **Crea categoria**. Viene salvata su Supabase e selezionata nel modulo prodotto senza perdere gli altri campi già compilati. Le categorie sono condivise da tutti gli amministratori e persistono dopo il logout. Santi e Calcio rimangono disponibili. I nomi duplicati restituiscono un messaggio senza creare un secondo record. Non sono previste modifica ed eliminazione delle categorie.

Esegui `supabase/003_categories.sql` una volta nel SQL Editor prima del deploy di questa versione: crea la tabella con RLS, sostituisce il vecchio elenco fisso nella tabella prodotti con una chiave esterna e mantiene dati e prezzi. Lo script può essere rieseguito e non riattiva Maschere o Portafortuna. Le nuove categorie sono subito selezionabili sui prodotti; nella home viene mostrato il loro nome dal database per i prodotti contrassegnati **In evidenza nella home**. La creazione di una categoria non genera una nuova pagina o una voce di navigazione.

L'admin permette creazione, modifica, eliminazione con conferma, ricerca, pubblicazione/bozza e selezione home. Il codice è immutabile dopo la creazione. Il campo immagine accetta un URL HTTPS oppure un file già presente in `public/assets/img`; non è un caricamento file. Il link acquisto facoltativo preserva gli acquisti esterni Vinted. Senza link il prodotto usa il carrello dimostrativo preesistente: nessun pagamento o ordine è implementato. I prezzi vengono letti dal database e i vecchi carrelli vengono aggiornati al caricamento del catalogo.

## Newsletter Resend

Eseguire anche `supabase/004_newsletter_consent.sql` prima del deploy della versione privacy: conserva la prova di conferma e impedisce che lo stesso link già confermato ripeta l'iscrizione. Prima della pubblicazione completare le verifiche in `PRIVACY_OPERATIONS.md`, compresi identità effettiva del titolare, configurazione fornitori, tempi di conservazione e disiscrizione. Le informative non sostituiscono queste impostazioni operative.

In Resend aggiungi e verifica **domusfour.it**, inserendo i record DNS richiesti nella gestione del dominio. L'indirizzo domusfour44@domusfour.it è il mittente, il dominio da verificare è domusfour.it. Non cambiare i record del servizio di posta esistente senza verificarne lo scopo.

Imposta `RESEND_API_KEY` con permessi per inviare email e gestire contatti, e `RESEND_FROM=Domus Neapolis <domusfour44@domusfour.it>`. Il form richiede consenso e invia un link valido 24 ore; il contatto viene aggiunto soltanto dopo il clic sul pulsante di conferma. L'apertura automatica del link non iscrive l'utente. I destinatari e i Broadcast si gestiscono da Resend; includi la disiscrizione nelle campagne e aggiorna l'informativa privacy con i trattamenti effettivi prima della pubblicazione. Nessuna campagna viene inviata automaticamente.

Il limite richieste è in memoria per processo/IP. Per più istanze o reverse proxy condiviso predisporre rate limiting persistente al gateway (il server non si fida di X-Forwarded-For). Verificare invio, conferma e disiscrizione con un indirizzo di prova prima del lancio. DNS, credenziali e servizi reali non vengono creati da questo repository.

## Autenticazione clienti futura — disattivata

`future-auth/login.html`, `future-auth/registrazione.html` e `future-auth/supabase-auth.js` sono fuori dalla directory pubblica, non hanno collegamenti dal sito e non vengono serviti. Le pagine hanno i campi disabilitati e lo script blocca le chiamate per default. Il modulo contiene le operazioni Supabase signup/signin, ma non viene importato dal sito. In futuro andranno integrati gestione sessione, verifica email, recupero password, logout, redirect autorizzati e pagine account. L'accesso admin attuale è separato dall'autenticazione clienti Supabase.

Riferimenti: https://supabase.com/docs/guides/database/secure-data · https://supabase.com/docs/guides/auth · https://resend.com/docs/api-reference/contacts/create-contact · https://resend.com/docs/dashboard/domains/introduction
