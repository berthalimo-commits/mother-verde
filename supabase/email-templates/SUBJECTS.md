# Mother Verde — Supabase Auth e-mail templates

Paste each file in **Supabase → Authentication → Emails** (tab *Templates* for the
first six, *Security notifications* for the rest; turn each notification **on**).
Paste the **Subject** below into the subject field and the whole `.html` file
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
| `confirm-signup.html` | Confirm signup | Confirma tu correo · Confirm your e-mail | {{ .ConfirmationURL }} |
| `invite-user.html` | Invite user | Te invitaron a Mother Verde · You are invited | {{ .ConfirmationURL }} |
| `magic-link.html` | Magic link | Tu enlace para entrar · Your sign-in link | {{ .ConfirmationURL }} |
| `change-email.html` | Change email address | Confirma tu nuevo correo · Confirm your new e-mail | {{ .Email }}, {{ .NewEmail }}, {{ .ConfirmationURL }} |
| `reset-password.html` | Reset password | Cambia tu contraseña · Reset your password | {{ .ConfirmationURL }} |
| `reauthentication.html` | Reauthentication | Tu código de verificación · Your verification code | {{ .Token }} |
| `security-password-changed.html` | Security notification · Password changed | Tu contraseña cambió · Your password was changed | {{ .Email }} |
| `security-email-changed.html` | Security notification · Email address changed | El correo de tu cuenta cambió · Your account e-mail changed | {{ .OldEmail }}, {{ .Email }} |
| `security-phone-changed.html` | Security notification · Phone number changed | Tu teléfono cambió · Your phone number changed | {{ .OldPhone }}, {{ .Phone }} |
| `security-identity-linked.html` | Security notification · Sign-in method linked | Nuevo método de inicio de sesión · New sign-in method | {{ .Provider }}, {{ .Email }} |
| `security-identity-unlinked.html` | Security notification · Sign-in method removed | Método de inicio de sesión eliminado · Sign-in method removed | {{ .Provider }}, {{ .Email }} |
| `security-mfa-added.html` | Security notification · Verification method added (MFA enrolled) | Nueva verificación en dos pasos · Two-step verification added | {{ .FactorType }}, {{ .Email }} |
| `security-mfa-removed.html` | Security notification · Verification method removed (MFA unenrolled) | Verificación en dos pasos eliminada · Two-step verification removed | {{ .FactorType }}, {{ .Email }} |

## Supabase settings to check at the same time

- **Authentication → URL Configuration → Site URL**: `https://www.motherverdeny.com`
  (the links in these e-mails are built from it).
- **Redirect URLs**: the production domain only (plus `http://localhost:5173/**` for development, if you use it).
- **SMTP Settings**: Hostinger, sender e-mail `hello@motherverdeny.com`, **sender name `Mother Verde`**
  (the same sender as our functions; replies go to hello@ because that is the From).
- **Rate limits → e-mails per hour**: with custom SMTP it can be raised; 30/hour is a safe start.
