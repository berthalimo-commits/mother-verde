const TO_EMAIL = 'hello@motherverdeny.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { honeypot, nombre, empresa, correo, mensaje, lang } = body;

  if (honeypot) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!nombre || !correo || !mensaje || !EMAIL_RE.test(correo)) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'email service not configured' });
    return;
  }

  const safe = (s) => String(s || '').replace(/[<>]/g, '');
  const html = `
    <h2>Nueva solicitud de espacio publicitario</h2>
    <p><b>Nombre:</b> ${safe(nombre)}</p>
    <p><b>Empresa:</b> ${safe(empresa) || '—'}</p>
    <p><b>Correo:</b> ${safe(correo)}</p>
    <p><b>Idioma de la app:</b> ${safe(lang) || '—'}</p>
    <p><b>Mensaje:</b></p>
    <p>${safe(mensaje).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Mother Verde <onboarding@resend.dev>',
        to: [TO_EMAIL],
        reply_to: correo,
        subject: `Nueva solicitud de anuncio — ${nombre}`,
        html
      })
    });
    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error', resendRes.status, errText);
      res.status(502).json({ error: 'email send failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('ad-inquiry error', err);
    res.status(500).json({ error: 'internal error' });
  }
};
