const TO_EMAIL = 'hello@motherverdeny.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limits (independent review): the whole request at most 10 KB, each field
// its own maximum (the form has the same maxlength), at most 5 sends per IP
// every 10 minutes. The counter lives in this server instance's memory:
// Vercel may run several instances, so it stops simple floods, not a
// determined attacker. The form falls back to a mailto link on any error.
const MAX_BODY = 10 * 1024;
const MAX = { nombre: 100, empresa: 150, correo: 254, mensaje: 3000, lang: 5 };
const WINDOW_MS = 10 * 60 * 1000, PER_WINDOW = 5;
const hits = new Map(); // ip -> [timestamps]
function limited(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_WINDOW) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}
export const _test = { hits, MAX, MAX_BODY, PER_WINDOW };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const declared = Number(req.headers?.['content-length'] || 0);
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (declared > MAX_BODY || Buffer.byteLength(raw) > MAX_BODY) {
    res.status(413).json({ error: 'too large' });
    return;
  }
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) {
    res.status(429).json({ error: 'too many requests' });
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

  const badField = Object.entries(MAX).some(([k, m]) => body[k] != null && body[k] !== '' && (typeof body[k] !== 'string' || body[k].length > m));
  if (badField || !nombre || !correo || !mensaje || !EMAIL_RE.test(correo)) {
    res.status(400).json({ error: 'invalid input' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  // No email provider yet: say so plainly. The form then offers a mailto link
  // to TO_EMAIL instead of losing the message (see main.js, adInquiryForm).
  if (!apiKey) {
    res.status(503).json({ error: 'email service not configured', fallback: 'mailto' });
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
