# Mother Verde — Supabase Auth e-mail templates

Paste each file in **Supabase → Authentication → Emails** (tab *Templates* for the
first six, *Security notifications* for the rest; turn each notification **on**).
Paste the **Subject** below into the subject field and the whole `.html` file
(including the first comment line, harmless) into the body.

All templates: Spanish first, then English, German, French; inline styles only;
no external images or fonts; no prices, subscriptions or payment processors.

Plain-text version: the Supabase dashboard only takes an HTML body (there is no
separate plain-text field), so every template is simple HTML that reads well in
text-only mail clients, and every button also shows its link as text.
The e-mails sent by our own functions (gift code, activation, test) do include a
plain-text part.

| File | Supabase template | Subject | Variables used |
|---|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirma tu correo · Confirm your e-mail · Bestätige deine E-Mail · Confirme ton e-mail — Mother Verde | {{ .ConfirmationURL }} |
| `invite-user.html` | Invite user | Te invitaron a Mother Verde · You are invited · Du bist eingeladen · Tu es invité·e — Mother Verde | {{ .ConfirmationURL }} |
| `magic-link.html` | Magic link | Tu enlace para entrar · Your sign-in link · Dein Anmeldelink · Ton lien de connexion — Mother Verde | {{ .ConfirmationURL }} |
| `change-email.html` | Change email address | Confirma tu nuevo correo · Confirm your new e-mail · Bestätige deine neue E-Mail · Confirme ton nouvel e-mail — Mother Verde | {{ .Email }}, {{ .NewEmail }}, {{ .ConfirmationURL }} |
| `reset-password.html` | Reset password | Cambia tu contraseña · Reset your password · Passwort zurücksetzen · Réinitialise ton mot de passe — Mother Verde | {{ .ConfirmationURL }} |
| `reauthentication.html` | Reauthentication | Tu código de verificación · Your verification code · Dein Bestätigungscode · Ton code de vérification — Mother Verde | {{ .Token }} |
| `security-password-changed.html` | Security notification · Password changed | Tu contraseña cambió · Your password was changed · Dein Passwort wurde geändert · Ton mot de passe a changé — Mother Verde | {{ .Email }} |
| `security-email-changed.html` | Security notification · Email address changed | El correo de tu cuenta cambió · Your account e-mail changed · Deine Konto-E-Mail wurde geändert · L’e-mail de ton compte a changé — Mother Verde | {{ .OldEmail }}, {{ .Email }} |
| `security-phone-changed.html` | Security notification · Phone number changed | Tu teléfono cambió · Your phone number changed · Deine Telefonnummer wurde geändert · Ton numéro a changé — Mother Verde | {{ .OldPhone }}, {{ .Phone }} |
| `security-identity-linked.html` | Security notification · Sign-in method linked | Nuevo método de inicio de sesión · New sign-in method · Neue Anmeldemethode · Nouvelle méthode de connexion — Mother Verde | {{ .Provider }}, {{ .Email }} |
| `security-identity-unlinked.html` | Security notification · Sign-in method removed | Método de inicio de sesión eliminado · Sign-in method removed · Anmeldemethode entfernt · Méthode de connexion supprimée — Mother Verde | {{ .Provider }}, {{ .Email }} |
| `security-mfa-added.html` | Security notification · Verification method added (MFA enrolled) | Nueva verificación en dos pasos · Two-step verification added · Zwei-Faktor-Methode hinzugefügt · Vérification en deux étapes ajoutée — Mother Verde | {{ .FactorType }}, {{ .Email }} |
| `security-mfa-removed.html` | Security notification · Verification method removed (MFA unenrolled) | Verificación en dos pasos eliminada · Two-step verification removed · Zwei-Faktor-Methode entfernt · Vérification en deux étapes supprimée — Mother Verde | {{ .FactorType }}, {{ .Email }} |

## Supabase settings to check at the same time

- **Authentication → URL Configuration → Site URL**: `https://www.motherverdeny.com`
  (the links in these e-mails are built from it).
- **Redirect URLs**: the production domain only (plus `http://localhost:5173/**` for development, if you use it).
- **SMTP Settings**: already set by the owner (Hostinger, hello@motherverdeny.com).
- **Rate limits → e-mails per hour**: with custom SMTP it can be raised; 30/hour is a safe start.
