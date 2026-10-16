export async function onRequestPost({ request, env }) {
  const datiForm = await request.json();

  const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = env.TELEGRAM_CHAT_ID;

  const motivi = {
    statua: "Informazioni su una statua",
    pezzo: "Pezzo personalizzato",
    ingrosso: "Ordine all'ingrosso",
    altro: "Altro"
  };

  const MESSAGGIO = [
    "Nuovo messaggio dal sito",
    `Nome: ${datiForm.nome ?? ""}`,
    `Email: ${datiForm.email ?? ""}`,
    `Di cosa hai bisogno: ${motivi[datiForm.motivo] ?? "Altro"}`,
    `Telefono: ${datiForm.numero ?? ""}`,
    `Messaggio: ${datiForm.messaggio ?? ""}`
  ].join("\n");

  const payload = JSON.stringify({
    chat_id: CHAT_ID,
    text: MESSAGGIO
  });

  const risposta = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }
  );

  const risultato = await risposta.json();

  if (!risposta.ok || !risultato.ok) {
    console.error("Errore Telegram:", risultato.description);
    return Response.json({ ok: false }, { status: 502 });
  }

  return Response.json({ ok: true });
}