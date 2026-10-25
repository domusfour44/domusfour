# Verifiche del titolare prima della pubblicazione

Le informative descrivono il codice, non certificano la configurazione degli account esterni. Dati forniti dal titolare: DomusFour, Via Giacomo Puccini 9, Succivo. Contatto utilizzato: domusfour44@domusfour.it, già indicato come casella del dominio. Se DomusFour è soltanto un marchio, sostituirlo con il nome completo della persona o la ragione sociale che è effettivamente titolare del trattamento; verificare anche l'indirizzo e il funzionamento della casella.

## Database e newsletter

- Eseguire `supabase/004_newsletter_consent.sql` nel SQL Editor prima del deploy. La conferma registra email, momento della richiesta, data della conferma generata dal database, versione dell'informativa e sincronizzazione Resend. Non viene registrato l'IP. Gli invii precedenti a questa versione non acquistano retroattivamente una prova di consenso.
- In Resend disattivare open/click tracking se attivi: il sito non li implementa ma non può modificare le impostazioni dell'account. Inviare le campagne con Broadcast e link funzionante di disiscrizione, non con un normale invio transazionale privo di opt-out. Fare una prova su un proprio indirizzo prima di inviare campagne reali.
- Le richieste di revoca via email vanno eseguite tempestivamente in Resend impostando `unsubscribed=true`; non ricreare manualmente un contatto dopo l'opposizione. Il riuso di un link già confermato e sincronizzato non lo iscrive di nuovo.
- Il titolare deve limitare la conservazione e cancellare periodicamente richieste non più necessarie, contatti e prove secondo finalità e obblighi applicabili. Non è installato un automatismo di cancellazione. Conservare soltanto le prove e le informazioni di soppressione strettamente necessarie; verificare eventuali backup dei fornitori.

## Servizi e contratti

- Verificare i ruoli e i contratti/DPA applicabili a Vercel, Render, Supabase, Resend, Telegram e al fornitore della posta. Controllare regioni effettive, subfornitori, trasferimenti fuori SEE e garanzie (decisione di adeguatezza o clausole e misure appropriate); completare la documentazione di conseguenza. Non dichiarare automaticamente che tutti i dati restano nell'UE.
- Definire e applicare i tempi effettivi di conservazione dei log, della corrispondenza e delle prove, limitando l'accesso agli account. Se il trattamento tramite Telegram non è adeguato ai dati e ai contratti disponibili, sostituirlo prima di raccogliere messaggi. La chat del bot non deve essere considerata un canale per dati sensibili.
- Richieste di accesso/cancellazione: verificare l'identità in modo proporzionato, poi intervenire sui ticket Supabase, Telegram, posta, Resend e registro consensi. Rispondere nei termini GDPR, normalmente un mese, gestendo eventuali proroghe nei casi previsti.

## Dominio pubblicato

- Font, icone e Bootstrap sono locali, con licenze in `public/vendor`. Evitare di reinserire kit o CDN esterne. Anche le foto remote del catalogo comportano richieste al loro host: preferire foto servite dal sito.
- Dopo il deploy, verificare nel browser richieste e memoria prima dell'accesso, dopo cambio tema e dopo login/logout. `dn_admin` è un cookie tecnico con Max-Age di 8 ore; `dn_theme` e `dn_cart` sono memoria locale. Controllare anche gli eventuali cookie aggiunti dall'hosting.
- Non è stato aggiunto un banner superfluo per i soli strumenti tecnici. Prima di aggiungere analytics o marketing, introdurre il blocco preventivo, una scelta di rifiuto altrettanto accessibile e revoca del consenso, aggiornando le informative.

Fonti: GDPR artt. 5, 6, 7, 12, 13 e 44–49 su https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita · Linee guida del Garante https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876

## Ticket assistenza

Eseguire `supabase/005_contact_tickets.sql`. I messaggi sono ora conservati in `contact_tickets`, non solo su Telegram, e copiati nella ricevuta email al cliente. Includere questi archivi nelle richieste di accesso/cancellazione e nella revisione della conservazione. Chiudere un ticket non ne cancella i dati. Le ricevute sono comunicazioni di servizio, senza marketing o iscrizione automatica alla newsletter.
