// Cloudflare Turnstile captcha for sign-up, sign-in and "resend confirmation
// e-mail", checked by Supabase Auth (Authentication -> Attack Protection).
//
// OFF until the owner provides the Cloudflare keys. While ENABLED is false (or
// SITE_KEY is empty) the app loads nothing from Cloudflare and sends no token.
//
// To turn it on, in this order:
//   1. Cloudflare dashboard -> Turnstile -> add a widget for
//      www.motherverdeny.com, motherverdeny.com, mother-verde.vercel.app.
//   2. Supabase -> Authentication -> Attack Protection -> enable CAPTCHA,
//      provider Turnstile, paste the SECRET key there (never here).
//   3. Here: paste the SITE key (public) and set ENABLED: true. Deploy.
// Doing 2 without 3 blocks every sign-up and sign-in (Supabase would demand a
// token the app doesn't send), so deploy step 3 right after step 2.
export const CAPTCHA = {
  ENABLED: false,
  SITE_KEY: '',
};

export function captchaIsOn() {
  return CAPTCHA.ENABLED === true && typeof CAPTCHA.SITE_KEY === 'string' && CAPTCHA.SITE_KEY.length > 0;
}
