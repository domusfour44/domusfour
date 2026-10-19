module.exports = async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).json({ ok: false });
  }

  const datiForm = request.body || {};
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return response.status(500).json({ ok: false });
  }

  const motivi = {
    statua: "Informazioni su una statua",
    pezzo: "Pezzo personalizzato",
    ingrosso: "Ordine all'ingrosso",
    altro: "Altro"
  };

  const messaggio = [
    "Nuovo messaggio dal sito",
    `Nome: ${datiForm.nome ?? ""}`,
    `Email: ${datiForm.email ?? ""}`,
    `Di cosa hai bisogno: ${motivi[datiForm.motivo] ?? "Altro"}`,
    `Telefono: ${datiForm.numero ?? ""}`,
    `Messaggio: ${datiForm.messaggio ?? ""}`
  ].join("\n");

  try {
    const risposta = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: messaggio })
      }
    );

    const risultato = await risposta.json();

    if (!risposta.ok || !risultato.ok) {
      console.error("Errore Telegram:", risultato.description);
      return response.status(502).json({ ok: false });
    }

    return response.status(200).json({ ok: true });
  } catch (errore) {
    console.error("Errore durante l'invio a Telegram:", errore);
    return response.status(502).json({ ok: false });
  }
};