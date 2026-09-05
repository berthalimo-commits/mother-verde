# Day-2 trial reminder — email (DESIGNED ONLY, not wired)

**Status:** not sending. No transactional email provider is connected yet.
Domain + `hello@motherverdeny.com` live on Hostinger; DNS (SPF/DKIM) will be set
up there when we wire sending. Until then, the in-app banner
(`#trialReminderBanner`, shown in the last 24h of the trial) is the channel.

**Trigger:** `api/subscription-cron.js`, step 1 — profile is `trialing`,
`cancel_at_period_end = false`, `trial_ends_at` within 24h, `trial_reminder_sent_at`
is null. After "sending", stamp `trial_reminder_sent_at`.

**Channel recommendation:** email is the right primary channel long-term (it
reaches the user off-app, which is what a pre-charge reminder is for, and it's
the norm regulators expect). Cheapest path that matches what's already here:
Resend (already used by `api/ad-inquiry.js`) with the Hostinger domain verified.
Runner-up: a push notification via the existing PWA manifest — free, but only
reaches users who installed the PWA and granted permission, so it can't be the
only reminder. Plan: ship email as primary; add PWA push later as a bonus.

**From:** `Mother Verde <hello@motherverdeny.com>`
**Subject / body per language below. Placeholders:**
`{charge_date}` = formatted `trial_ends_at` (date + time),
`{price}` = `$7.10`, `{manage_url}` = `https://mother-verde.vercel.app/` (deep
link to Cuenta → Suscripción once routing supports it).

---

## ES
**Asunto:** Tu prueba gratis de Mother Verde termina mañana

Hola,

Tu prueba gratis de 3 días termina el **{charge_date}**.

Si no cancelas antes, ese día se cobrará automáticamente **{price}/mes** a tu
tarjeta, y seguirá renovándose cada mes hasta que canceles.

- **¿Quieres seguir con Premium?** No tienes que hacer nada. El cobro es automático.
- **¿No quieres continuar?** Cancela en un clic desde **Cuenta → Suscripción**.
  Si cancelas antes del {charge_date}, no se te cobra nada.

Gestionar mi suscripción: {manage_url}

— El equipo de Mother Verde

---

## EN
**Subject:** Your Mother Verde free trial ends tomorrow

Hi,

Your 3-day free trial ends on **{charge_date}**.

Unless you cancel first, **{price}/month** will automatically be charged to your
card that day, and it will keep renewing each month until you cancel.

- **Want to keep Premium?** Do nothing — billing is automatic.
- **Don't want to continue?** Cancel in one click from **Account → Subscription**.
  Cancel before {charge_date} and you're not charged.

Manage my subscription: {manage_url}

— The Mother Verde team

---

## DE
**Betreff:** Deine kostenlose Testphase bei Mother Verde endet morgen

Hallo,

Deine 3-tägige kostenlose Testphase endet am **{charge_date}**.

Sofern du nicht vorher kündigst, werden an diesem Tag automatisch
**{price}/Monat** von deiner Karte abgebucht, und es verlängert sich jeden Monat,
bis du kündigst.

- **Premium behalten?** Nichts tun — die Abrechnung läuft automatisch.
- **Nicht fortfahren?** Kündige mit einem Klick über **Konto → Abo**.
  Kündige vor dem {charge_date} und es wird nichts berechnet.

Mein Abo verwalten: {manage_url}

— Das Mother-Verde-Team

---

## FR
**Objet :** Ton essai gratuit Mother Verde se termine demain

Bonjour,

Ton essai gratuit de 3 jours se termine le **{charge_date}**.

Sauf si tu annules avant, **{price}/mois** seront automatiquement débités de ta
carte ce jour-là, et l'abonnement se renouvellera chaque mois jusqu'à ce que tu
annules.

- **Envie de garder Premium ?** Ne fais rien — la facturation est automatique.
- **Tu ne veux pas continuer ?** Annule en un clic depuis **Compte → Abonnement**.
  Annule avant le {charge_date} et rien ne t'est facturé.

Gérer mon abonnement : {manage_url}

— L'équipe Mother Verde
