const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function newsletterConfirmationEmail(confirmationUrl) {
  const url = new URL(confirmationUrl);
  const link = escapeHtml(url.href);
  const home = escapeHtml(url.origin);
  const privacy = escapeHtml(new URL('/privacy.html#newsletter', url).href);
  return {
    subject: 'Conferma la tua iscrizione · DomusFour',
    text: `Un ultimo passo per entrare nel mondo DomusFour.\n\nHai chiesto di ricevere le nostre novità e offerte. Per completare l’iscrizione, apri il link e premi il pulsante di conferma nella pagina:\n\n${url.href}\n\nIl link è valido per 24 ore.\n\nSe non hai richiesto questa email, puoi ignorarla: senza conferma non verrai iscritto. Dopo l’iscrizione potrai disiscriverti in qualsiasi momento.\n\nA presto,\nDomusFour\n\nInformativa privacy: ${new URL('/privacy.html#newsletter', url).href}`,
    html: `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Conferma iscrizione · DomusFour</title></head>
<body style="margin:0;padding:0;background-color:#fbf9f4;color:#171512;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">Un ultimo passo per ricevere novità e offerte da DomusFour. Conferma entro 24 ore.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbf9f4" style="width:100%;background-color:#fbf9f4;"><tr><td align="center" style="padding:36px 16px;">
    <!--[if mso]><table role="presentation" width="580" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;">
      <tr><td style="padding:0 16px 26px;text-align:center;font-family:Arial,Helvetica,sans-serif;"><a href="${home}" style="display:inline-block;text-decoration:none;color:#171512;"><strong style="display:block;font-size:27px;line-height:30px;letter-spacing:-1px;">DOMUS</strong><span style="display:block;padding-top:5px;color:#8a6212;font-size:10px;line-height:16px;letter-spacing:5px;">FOUR</span></a></td></tr>
      <tr><td bgcolor="#ffffff" style="padding:38px 28px 32px;border:1px solid #e4dfd4;border-radius:14px;background-color:#ffffff;">
        <h1 style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:1.2;font-weight:700;letter-spacing:-.7px;text-align:center;color:#171512;">Un ultimo passo.</h1>
        <p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.7;text-align:center;color:#5c5547;">Le novità di DomusFour,<br>direttamente nella tua casella.</p>
        <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;text-align:center;color:#5c5547;">Per completare l’iscrizione, apri il link qui sotto<br>e conferma la tua scelta nella pagina.</p>
        <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:340px;"><tr><td align="center" bgcolor="#171512" style="border-radius:8px;background-color:#171512;mso-padding-alt:17px 24px;"><a href="${link}" style="display:block;padding:17px 24px;border:1px solid #171512;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;text-align:center;text-decoration:none;color:#f4efe3;">Conferma iscrizione</a></td></tr></table>
        <p style="margin:18px 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;text-align:center;color:#756b5b;">Il link è valido per 24 ore.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e4dfd4;padding-top:22px;">
          <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;text-align:center;color:#5c5547;">Non hai richiesto questa email? Puoi ignorarla:<br>senza conferma non verrai iscritto.</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;text-align:center;color:#5c5547;">Se il pulsante non funziona, <a href="${link}" style="color:#8a6212;text-decoration:underline;">apri il link di conferma</a>.</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:24px 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.9;text-align:center;color:#756b5b;">DomusFour · Via Giacomo Puccini 9, Succivo<br>Dopo l’iscrizione puoi disiscriverti in qualsiasi momento.<br><a href="${privacy}" style="color:#8a6212;text-decoration:underline;">Informativa privacy</a> &nbsp;·&nbsp; <a href="${home}" style="color:#8a6212;text-decoration:underline;">Visita il sito</a></td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr></table>
</body></html>`
  };
}
