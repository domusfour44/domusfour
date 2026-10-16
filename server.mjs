import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public")); // cartella con index.html e asset

app.post("/api/contatti", async (req, res) => {
  const data = req.body;

  const testo = [
    "Nuovo messaggio dal sito",
    `Nome: ${data.nome ?? ""}`,
    `Email: ${data.email ?? ""}`,
    `Motivo: ${data.motivo ?? ""}`,
    `Telefono: ${data.numero ?? ""}`,
    `Messaggio: ${data.messaggio ?? ""}`,
  ].join("\n");

  const risposta = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: testo,
      }),
    }
  );

  if (!risposta.ok) {
    console.error("Errore Telegram:", risposta.status, await risposta.text());
    return res.status(500).json({ ok: false });
  }

  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server su http://localhost:${PORT}`));