// Generates the Supabase Auth templates (*.html) and SUBJECTS.md in this folder.
// Run from the repo root:  node supabase/email-templates/_generate.cjs
const fs = require('fs');
const OUT = __dirname + '/';
fs.mkdirSync(OUT, { recursive: true });

const IGNORE = {
  es: 'Si no fuiste tú, puedes ignorar este correo: no cambiará nada.',
  en: "If this wasn't you, you can ignore this e-mail: nothing will change.",
  de: 'Falls du das nicht warst, kannst du diese E-Mail ignorieren: Es ändert sich nichts.',
  fr: "Si ce n'était pas toi, tu peux ignorer cet e-mail : rien ne changera.",
};
const ALERT = {
  es: 'Si no fuiste tú, cambia tu contraseña ahora y escríbenos a hello@motherverdeny.com.',
  en: "If this wasn't you, change your password now and write to us at hello@motherverdeny.com.",
  de: 'Falls du das nicht warst, ändere jetzt dein Passwort und schreib uns an hello@motherverdeny.com.',
  fr: "Si ce n'était pas toi, change ton mot de passe maintenant et écris-nous à hello@motherverdeny.com.",
};
const LINK_FALLBACK = {
  es: 'Si el botón no funciona, copia este enlace en tu navegador:',
  en: "If the button doesn't work, copy this link into your browser:",
  de: 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
  fr: 'Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :',
};
const LANGS = ['es', 'en', 'de', 'fr'];

const T = {
  'confirm-signup': {
    name: 'Confirm signup', url: '{{ .ConfirmationURL }}',
    subject: 'Confirma tu correo · Confirm your e-mail',
    es: ['Confirma tu correo', ['Gracias por crear tu cuenta en Mother Verde. Pulsa el botón para confirmar tu correo. Tus 24 horas de acceso completo empiezan en ese momento.'], 'Confirmar mi correo', ['Si este correo llegó a la carpeta de spam o correo no deseado, márcalo como «no es spam» para recibir bien los próximos.', IGNORE.es]],
    en: ['Confirm your e-mail', ['Thanks for creating your Mother Verde account. Press the button to confirm your e-mail. Your 24 hours of full access start at that moment.'], 'Confirm my e-mail', ['If this e-mail landed in your spam or junk folder, mark it as "not spam" so the next ones arrive properly.', IGNORE.en]],
    de: ['Bestätige deine E-Mail', ['Danke, dass du ein Konto bei Mother Verde erstellt hast. Drücke den Button, um deine E-Mail-Adresse zu bestätigen. Deine 24 Stunden Vollzugriff beginnen in diesem Moment.'], 'E-Mail bestätigen', ['Falls diese E-Mail im Spam- oder Junk-Ordner gelandet ist, markiere sie als „kein Spam“, damit die nächsten richtig ankommen.', IGNORE.de]],
    fr: ['Confirme ton e-mail', ["Merci d'avoir créé ton compte Mother Verde. Appuie sur le bouton pour confirmer ton adresse e-mail. Tes 24 heures d'accès complet commencent à ce moment-là."], 'Confirmer mon e-mail', ['Si cet e-mail est arrivé dans tes spams ou courriers indésirables, marque-le comme « non spam » pour bien recevoir les prochains.', IGNORE.fr]],
  },
  'invite-user': {
    name: 'Invite user', url: '{{ .ConfirmationURL }}',
    subject: 'Te invitaron a Mother Verde · You are invited',
    es: ['Te invitaron a Mother Verde', ['Alguien del equipo de Mother Verde te invitó a crear una cuenta. Pulsa el botón para aceptar la invitación y elegir tu contraseña.'], 'Aceptar la invitación', [IGNORE.es]],
    en: ['You are invited to Mother Verde', ['Someone from the Mother Verde team invited you to create an account. Press the button to accept and choose your password.'], 'Accept the invitation', [IGNORE.en]],
    de: ['Du bist zu Mother Verde eingeladen', ['Jemand aus dem Mother-Verde-Team hat dich eingeladen, ein Konto zu erstellen. Drücke den Button, um die Einladung anzunehmen und dein Passwort zu wählen.'], 'Einladung annehmen', [IGNORE.de]],
    fr: ['Tu es invité·e sur Mother Verde', ["Quelqu'un de l'équipe Mother Verde t'a invité·e à créer un compte. Appuie sur le bouton pour accepter et choisir ton mot de passe."], "Accepter l'invitation", [IGNORE.fr]],
  },
  'magic-link': {
    name: 'Magic link', url: '{{ .ConfirmationURL }}',
    subject: 'Tu enlace para entrar · Your sign-in link',
    es: ['Tu enlace para entrar', ['Pulsa el botón para entrar en tu cuenta de Mother Verde. El enlace sirve una sola vez y caduca pronto.'], 'Entrar en Mother Verde', [IGNORE.es]],
    en: ['Your sign-in link', ['Press the button to sign in to your Mother Verde account. The link works once and expires soon.'], 'Sign in to Mother Verde', [IGNORE.en]],
    de: ['Dein Anmeldelink', ['Drücke den Button, um dich bei deinem Mother-Verde-Konto anzumelden. Der Link funktioniert nur einmal und läuft bald ab.'], 'Bei Mother Verde anmelden', [IGNORE.de]],
    fr: ['Ton lien de connexion', ['Appuie sur le bouton pour te connecter à ton compte Mother Verde. Le lien ne sert qu’une fois et expire bientôt.'], 'Me connecter à Mother Verde', [IGNORE.fr]],
  },
  'change-email': {
    name: 'Change email address', url: '{{ .ConfirmationURL }}',
    subject: 'Confirma tu nuevo correo · Confirm your new e-mail',
    es: ['Confirma el cambio de correo', ['Pediste cambiar el correo de tu cuenta de Mother Verde de <b>{{ .Email }}</b> a <b>{{ .NewEmail }}</b>. Pulsa el botón para confirmarlo.'], 'Confirmar el cambio', [IGNORE.es]],
    en: ['Confirm your e-mail change', ['You asked to change your Mother Verde account e-mail from <b>{{ .Email }}</b> to <b>{{ .NewEmail }}</b>. Press the button to confirm.'], 'Confirm the change', [IGNORE.en]],
    de: ['Bestätige die Änderung deiner E-Mail', ['Du hast beantragt, die E-Mail deines Mother-Verde-Kontos von <b>{{ .Email }}</b> auf <b>{{ .NewEmail }}</b> zu ändern. Drücke den Button, um das zu bestätigen.'], 'Änderung bestätigen', [IGNORE.de]],
    fr: ["Confirme le changement d'e-mail", ["Tu as demandé à changer l'e-mail de ton compte Mother Verde de <b>{{ .Email }}</b> à <b>{{ .NewEmail }}</b>. Appuie sur le bouton pour confirmer."], 'Confirmer le changement', [IGNORE.fr]],
  },
  'reset-password': {
    name: 'Reset password', url: '{{ .ConfirmationURL }}',
    subject: 'Cambia tu contraseña · Reset your password',
    es: ['Cambia tu contraseña', ['Recibimos una solicitud para cambiar la contraseña de tu cuenta de Mother Verde. Pulsa el botón para elegir una nueva. El enlace caduca pronto.'], 'Elegir una nueva contraseña', [IGNORE.es]],
    en: ['Reset your password', ['We received a request to reset the password of your Mother Verde account. Press the button to choose a new one. The link expires soon.'], 'Choose a new password', [IGNORE.en]],
    de: ['Setze dein Passwort zurück', ['Wir haben eine Anfrage erhalten, das Passwort deines Mother-Verde-Kontos zurückzusetzen. Drücke den Button, um ein neues zu wählen. Der Link läuft bald ab.'], 'Neues Passwort wählen', [IGNORE.de]],
    fr: ['Réinitialise ton mot de passe', ['Nous avons reçu une demande de réinitialisation du mot de passe de ton compte Mother Verde. Appuie sur le bouton pour en choisir un nouveau. Le lien expire bientôt.'], 'Choisir un nouveau mot de passe', [IGNORE.fr]],
  },
  'reauthentication': {
    name: 'Reauthentication', code: '{{ .Token }}',
    subject: 'Tu código de verificación · Your verification code',
    es: ['Tu código de verificación', ['Para confirmar que eres tú, escribe este código en Mother Verde:'], null, [IGNORE.es]],
    en: ['Your verification code', ["To confirm it's you, enter this code in Mother Verde:"], null, [IGNORE.en]],
    de: ['Dein Bestätigungscode', ['Um zu bestätigen, dass du es bist, gib diesen Code bei Mother Verde ein:'], null, [IGNORE.de]],
    fr: ['Ton code de vérification', ["Pour confirmer que c'est bien toi, saisis ce code dans Mother Verde :"], null, [IGNORE.fr]],
  },
  'security-password-changed': {
    name: 'Security notification · Password changed',
    subject: 'Tu contraseña cambió · Your password was changed',
    es: ['Tu contraseña cambió', ['La contraseña de tu cuenta de Mother Verde (<b>{{ .Email }}</b>) se acaba de cambiar.'], null, [ALERT.es]],
    en: ['Your password was changed', ['The password of your Mother Verde account (<b>{{ .Email }}</b>) was just changed.'], null, [ALERT.en]],
    de: ['Dein Passwort wurde geändert', ['Das Passwort deines Mother-Verde-Kontos (<b>{{ .Email }}</b>) wurde gerade geändert.'], null, [ALERT.de]],
    fr: ['Ton mot de passe a changé', ['Le mot de passe de ton compte Mother Verde (<b>{{ .Email }}</b>) vient d’être modifié.'], null, [ALERT.fr]],
  },
  'security-email-changed': {
    name: 'Security notification · Email address changed',
    subject: 'El correo de tu cuenta cambió · Your account e-mail changed',
    es: ['El correo de tu cuenta cambió', ['El correo de tu cuenta de Mother Verde cambió de <b>{{ .OldEmail }}</b> a <b>{{ .Email }}</b>.'], null, [ALERT.es]],
    en: ['Your account e-mail changed', ['Your Mother Verde account e-mail changed from <b>{{ .OldEmail }}</b> to <b>{{ .Email }}</b>.'], null, [ALERT.en]],
    de: ['Deine Konto-E-Mail wurde geändert', ['Die E-Mail deines Mother-Verde-Kontos wurde von <b>{{ .OldEmail }}</b> auf <b>{{ .Email }}</b> geändert.'], null, [ALERT.de]],
    fr: ["L'e-mail de ton compte a changé", ["L'e-mail de ton compte Mother Verde est passé de <b>{{ .OldEmail }}</b> à <b>{{ .Email }}</b>."], null, [ALERT.fr]],
  },
  'security-phone-changed': {
    name: 'Security notification · Phone number changed',
    subject: 'Tu teléfono cambió · Your phone number changed',
    es: ['Tu teléfono cambió', ['El teléfono de tu cuenta de Mother Verde cambió de <b>{{ .OldPhone }}</b> a <b>{{ .Phone }}</b>.'], null, [ALERT.es]],
    en: ['Your phone number changed', ['Your Mother Verde account phone number changed from <b>{{ .OldPhone }}</b> to <b>{{ .Phone }}</b>.'], null, [ALERT.en]],
    de: ['Deine Telefonnummer wurde geändert', ['Die Telefonnummer deines Mother-Verde-Kontos wurde von <b>{{ .OldPhone }}</b> auf <b>{{ .Phone }}</b> geändert.'], null, [ALERT.de]],
    fr: ['Ton numéro a changé', ['Le numéro de téléphone de ton compte Mother Verde est passé de <b>{{ .OldPhone }}</b> à <b>{{ .Phone }}</b>.'], null, [ALERT.fr]],
  },
  'security-identity-linked': {
    name: 'Security notification · Sign-in method linked',
    subject: 'Nuevo método de inicio de sesión · New sign-in method',
    es: ['Nuevo método de inicio de sesión', ['Se vinculó <b>{{ .Provider }}</b> a tu cuenta de Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.es]],
    en: ['New sign-in method', ['<b>{{ .Provider }}</b> was linked to your Mother Verde account (<b>{{ .Email }}</b>).'], null, [ALERT.en]],
    de: ['Neue Anmeldemethode', ['<b>{{ .Provider }}</b> wurde mit deinem Mother-Verde-Konto (<b>{{ .Email }}</b>) verknüpft.'], null, [ALERT.de]],
    fr: ['Nouvelle méthode de connexion', ['<b>{{ .Provider }}</b> a été associé à ton compte Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.fr]],
  },
  'security-identity-unlinked': {
    name: 'Security notification · Sign-in method removed',
    subject: 'Método de inicio de sesión eliminado · Sign-in method removed',
    es: ['Método de inicio de sesión eliminado', ['Se quitó <b>{{ .Provider }}</b> de tu cuenta de Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.es]],
    en: ['Sign-in method removed', ['<b>{{ .Provider }}</b> was removed from your Mother Verde account (<b>{{ .Email }}</b>).'], null, [ALERT.en]],
    de: ['Anmeldemethode entfernt', ['<b>{{ .Provider }}</b> wurde von deinem Mother-Verde-Konto (<b>{{ .Email }}</b>) entfernt.'], null, [ALERT.de]],
    fr: ['Méthode de connexion supprimée', ['<b>{{ .Provider }}</b> a été retiré de ton compte Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.fr]],
  },
  'security-mfa-added': {
    name: 'Security notification · Verification method added (MFA enrolled)',
    subject: 'Nueva verificación en dos pasos · Two-step verification added',
    es: ['Nueva verificación en dos pasos', ['Se añadió un método de verificación (<b>{{ .FactorType }}</b>) a tu cuenta de Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.es]],
    en: ['Two-step verification added', ['A verification method (<b>{{ .FactorType }}</b>) was added to your Mother Verde account (<b>{{ .Email }}</b>).'], null, [ALERT.en]],
    de: ['Zwei-Faktor-Methode hinzugefügt', ['Deinem Mother-Verde-Konto (<b>{{ .Email }}</b>) wurde eine Bestätigungsmethode (<b>{{ .FactorType }}</b>) hinzugefügt.'], null, [ALERT.de]],
    fr: ['Vérification en deux étapes ajoutée', ['Une méthode de vérification (<b>{{ .FactorType }}</b>) a été ajoutée à ton compte Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.fr]],
  },
  'security-mfa-removed': {
    name: 'Security notification · Verification method removed (MFA unenrolled)',
    subject: 'Verificación en dos pasos eliminada · Two-step verification removed',
    es: ['Verificación en dos pasos eliminada', ['Se quitó un método de verificación (<b>{{ .FactorType }}</b>) de tu cuenta de Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.es]],
    en: ['Two-step verification removed', ['A verification method (<b>{{ .FactorType }}</b>) was removed from your Mother Verde account (<b>{{ .Email }}</b>).'], null, [ALERT.en]],
    de: ['Zwei-Faktor-Methode entfernt', ['Von deinem Mother-Verde-Konto (<b>{{ .Email }}</b>) wurde eine Bestätigungsmethode (<b>{{ .FactorType }}</b>) entfernt.'], null, [ALERT.de]],
    fr: ['Vérification en deux étapes supprimée', ['Une méthode de vérification (<b>{{ .FactorType }}</b>) a été retirée de ton compte Mother Verde (<b>{{ .Email }}</b>).'], null, [ALERT.fr]],
  },
};

function html(key, t) {
  const sections = LANGS.map((l, i) => {
    const [title, ps, btn, after] = t[l];
    return `
<tr><td lang="${l}" style="padding:${i ? '28px' : '8px'} 24px 8px 24px;${i ? 'border-top:1px solid #e3e8e2;' : ''}">
  <h2 style="margin:0 0 12px 0;font-size:19px;line-height:1.3;color:#1f3d2b;font-family:Georgia,serif;">${title}</h2>
${ps.map((p) => `  <p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;color:#2b2b2b;">${p}</p>`).join('\n')}
${t.code ? `  <p style="margin:16px 0;text-align:center;"><span style="display:inline-block;padding:12px 18px;background:#f1f6ef;border:1px solid #c9dbc4;border-radius:8px;font-family:Consolas,Menlo,monospace;font-size:24px;letter-spacing:4px;color:#1f3d2b;">${t.code}</span></p>` : ''}
${btn ? `  <p style="margin:18px 0;text-align:center;"><a href="${t.url}" style="display:inline-block;padding:13px 24px;background:#2f6b45;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${btn}</a></p>
` : ''}
${after.map((p) => `  <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#555555;">${p}</p>`).join('\n')}
</td></tr>`;
  }).join('');
  // One "copy this link" block at the end (4 languages, the link once):
  // fewer links per e-mail than one per language.
  const fallback = t.url ? `
<tr><td style="padding:16px 24px 4px 24px;border-top:1px solid #e3e8e2;font-size:12px;line-height:1.5;color:#6b6b6b;">${LANGS.map((l) => `<span lang="${l}">${LINK_FALLBACK[l]}</span>`).join('<br>')}<br><a href="${t.url}" style="color:#2f6b45;word-break:break-all;">${t.url}</a></td></tr>` : '';
  return `<!-- Mother Verde · Supabase Auth template: ${t.name}
     Paste in Supabase -> Authentication -> Emails -> ${t.name}.
     Subject: see SUBJECTS.md. Generated by _generate.cjs: edit that file, not this one. -->
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Mother Verde</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:24px 24px 8px 24px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#2f6b45;">Mother Verde</td></tr>${sections}${fallback}
<tr><td style="padding:20px 24px 24px 24px;font-size:12px;line-height:1.5;color:#6b6b6b;border-top:1px solid #e3e8e2;">Mother Verde · hello@motherverdeny.com</td></tr>
</table></td></tr></table>
</body></html>
`;
}

let md = `# Mother Verde — Supabase Auth e-mail templates

Paste each file in **Supabase → Authentication → Emails** (tab *Templates* for the
first six, *Security notifications* for the rest; turn each notification **on**).
Paste the **Subject** below into the subject field and the whole \`.html\` file
(including the first comment line, harmless) into the body.

All templates: Spanish first, then English, German, French; inline styles only;
no images, no external fonts, no link shorteners; no prices and no payment
processors. One button per language and the "copy this link" text once at the
end (fewer links per e-mail). Light colours declared (color-scheme) so dark-mode
clients don't turn them unreadable.

Subjects: short, Spanish · English only (the body has the four languages; the
sender name already says Mother Verde). No capitals-only words, no "!".

Plain-text version: the Supabase dashboard only takes an HTML body (there is no
separate plain-text field), so every template is simple HTML that reads well in
text-only mail clients, and the link is also shown as text.
The e-mails sent by our own functions (gift code, activation, test) do include a
plain-text part and Reply-To hello@motherverdeny.com.

| File | Supabase template | Subject | Variables used |
|---|---|---|---|
`;
for (const [key, t] of Object.entries(T)) {
  const h = html(key, t);
  fs.writeFileSync(OUT + key + '.html', h);
  const vars = [...new Set(h.match(/\{\{ \.[A-Za-z]+ \}\}/g) || [])].join(', ');
  md += `| \`${key}.html\` | ${t.name} | ${t.subject} | ${vars} |\n`;
}
md += `
## Supabase settings to check at the same time

- **Authentication → URL Configuration → Site URL**: \`https://www.motherverdeny.com\`
  (the links in these e-mails are built from it).
- **Redirect URLs**: the production domain only (plus \`http://localhost:5173/**\` for development, if you use it).
- **SMTP Settings**: Hostinger, sender e-mail \`hello@motherverdeny.com\`, **sender name \`Mother Verde\`**
  (the same sender as our functions; replies go to hello@ because that is the From).
- **Rate limits → e-mails per hour**: with custom SMTP it can be raised; 30/hour is a safe start.
`;
fs.writeFileSync(OUT + 'SUBJECTS.md', md);
console.log(Object.keys(T).length, 'templates');
