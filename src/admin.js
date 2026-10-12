// Admin panel (/panel-mv.html). Not linked from the app. Being hidden is NOT
// the protection: every action is checked by the server (admin_users + an MFA
// session, aal2) in the database functions and the Edge Functions.
//
// Flow: signed in? -> admin? (admin_whoami) -> MFA: enroll a TOTP app the
// first time, otherwise enter the 6-digit code -> panel (aal2).
// Shows only what's needed to decide: account e-mail, amounts, transaction
// codes, check results, gift-code states, the audit log. No private content.
//
// Language: the one chosen in the app (localStorage 'mv-lang', same browser),
// with its own ES/EN/DE/FR switch; every view is redrawn on change.
import { createClient } from '@supabase/supabase-js';

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usdc = (units) => (Number(units) / 1e6).toFixed(4);

// ------------------------------------------------------------ texts (4 languages)
const LANGS = ['es', 'en', 'de', 'fr'];
const LOCALE = { es: 'es-ES', en: 'en-US', de: 'de-DE', fr: 'fr-FR' };
let lang = (() => { try { const l = localStorage.getItem('mv-lang'); return LANGS.includes(l) ? l : 'es'; } catch (e) { return 'es'; } })();
const when = (iso) => (iso ? new Date(iso).toLocaleString(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' }) : '—');

const T = {
  es: {
    title: 'Mother Verde · Panel de administración', loading: 'Cargando…', wait: 'Un momento…',
    signInFirst: 'Inicia sesión en <a href="/">Mother Verde</a> con tu cuenta de administración y vuelve a esta página.',
    notAdmin: 'Esta cuenta no tiene acceso al panel.', backApp: 'Volver a Mother Verde',
    mfaH: 'Verificación en dos pasos', mfaP: 'Escribe el código de 6 dígitos de tu app de autenticación.', verify: 'Verificar',
    enrollH: 'Activa la verificación en dos pasos (obligatoria)',
    enroll1: 'Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).',
    enroll2: 'Escanea este código QR, o escribe la clave a mano.', enroll3: 'Escribe aquí el código de 6 dígitos que muestra la app.',
    qrAlt: 'Código QR para la app de autenticación', key: 'Clave', activate: 'Activar',
    keepKey: 'Guarda una copia de la clave en un lugar seguro: si pierdes el teléfono, sin ella no podrás entrar al panel.',
    code6: 'El código tiene 6 dígitos.', codeBad: 'Código incorrecto o caducado. Prueba con el siguiente.',
    session: 'Sesión: {e} · verificación en dos pasos ✓', signOut: 'Cerrar sesión',
    tabClaims: 'Avisos de aporte', tabGifts: 'Códigos de regalo', tabAudit: 'Registro',
    autoOn: '<span class="ok">Verificación automática: ACTIVA</span> (solo activa sola si todo coincide exacto y el monto no pasa del tope de {max} USDC: de 1 a 20 flores)',
    autoOff: '<b class="warn">Verificación manual</b> — comprueba cada transferencia (botón «Comprobar en Base» o el enlace al explorador) antes de activar.',
    noAddr: 'Falta el secreto SUPPORT_ADDRESS en la función support-claims: las comprobaciones fallarán.',
    showOpen: 'Ver avisos por decidir', showAwaiting: 'Ver montos reservados sin pagar', refresh: 'Actualizar', empty: 'No hay nada aquí.',
    flower: 'flor', flowers: 'flores', reserved: 'Reservado', received: 'Código recibido', expires: 'Vence',
    explorer: 'Ver en el explorador de Base (Basescan) ↗', reason: 'Motivo', lastCheck: 'Última comprobación',
    confirmations: '{n} confirmaciones', receivedAmt: 'recibido: {a} USDC', notChecked: 'Sin comprobar todavía.',
    check: 'Comprobar en Base', approve: 'Activar acceso completo', approveTip: 'Solo si todas las comprobaciones pasan',
    manualP: 'Activación manual o rechazo (motivo obligatorio, queda en el registro):', reasonPh: 'Motivo…',
    manual: 'Activar manualmente con este motivo', reject: 'Rechazar con este motivo',
    mailNotSent: 'Acceso activado, pero el correo de confirmación NO se pudo enviar ({e}).',
    st_submitted: 'código recibido', st_manual_review: 'revisión manual', st_awaiting_payment: 'esperando pago',
    ck_tx_found: 'La transacción existe en Base', ck_tx_success: 'La transacción se completó', ck_usdc_contract: 'Es USDC (contrato oficial de Circle)',
    ck_destination: 'Llegó a nuestra dirección', ck_exact_amount: 'Monto exacto', ck_after_claim: 'Enviada después de reservar el monto',
    ck_confirmations: 'Confirmaciones suficientes', ck_tx_unused: 'Código no usado en otro aviso', ck_claim_open: 'Aviso vigente y de esa cuenta',
    ck_auto_limit: 'Dentro del tope automático ({max} USDC; si no, «monto_alto»)',
    giftH: 'Enviar un código de regalo (7 días de acceso, válido 7 días)', send: 'Enviar código', sending: 'Enviando…',
    giftLimits: 'Límites: 20 códigos al día en total y 3 por correo. El código solo viaja en el correo: aquí no se puede ver.',
    testBtn: 'Enviar correo de prueba a mi correo', sentTo: 'Enviado a {to}. Caduca: {d}.',
    testSent: 'Correo de prueba enviado a {to}. Revisa también la carpeta de spam.', codesH: 'Códigos', noCodes: 'Todavía no hay códigos.',
    thCreated: 'Creado', thTo: 'Para', thDays: 'Días', thExpires: 'Caduca', thState: 'Estado', thUsedBy: 'Usado por',
    void: 'Anular', voidPh: 'Motivo de la anulación', voidOk: 'Confirmar anulación',
    gs_creado: 'creado', gs_enviado: 'enviado', gs_usado: 'usado', gs_vencido: 'vencido', gs_anulado: 'anulado',
    auditP: 'Solo lectura. Nadie puede editar ni borrar este registro desde la app.',
    thWhen: 'Cuándo', thWho: 'Quién', thAction: 'Acción', thAccount: 'Cuenta', thReason: 'Motivo',
    e_not_allowed: 'No permitido: hace falta una cuenta de administración con verificación en dos pasos.',
    e_reason_required: 'Escribe un motivo (al menos 5 caracteres).', e_not_found: 'No encontrado.',
    e_not_found_or_closed: 'Ese aviso ya está cerrado.', e_claim_closed: 'Ese aviso ya está cerrado.',
    e_bad_email: 'Ese correo no parece válido.', e_blocked_domain: 'Ese dominio de correo está bloqueado (correo desechable).',
    e_daily_limit_20: 'Ya se crearon 20 códigos hoy (límite diario).', e_email_limit_3: 'Ese correo ya recibió 3 códigos (límite).',
    e_email_failed: 'No se pudo enviar el correo. El código quedó ANULADO.', e_not_found_or_not_active: 'Ese código ya no está activo.',
    e_could_not_verify_admin: 'No se pudo comprobar el permiso de administración.', e_server_error: 'Error del servidor. Inténtalo de nuevo.',
  },
  en: {
    title: 'Mother Verde · Admin panel', loading: 'Loading…', wait: 'One moment…',
    signInFirst: 'Sign in to <a href="/">Mother Verde</a> with your admin account and come back to this page.',
    notAdmin: 'This account has no access to the panel.', backApp: 'Back to Mother Verde',
    mfaH: 'Two-step verification', mfaP: 'Enter the 6-digit code from your authenticator app.', verify: 'Verify',
    enrollH: 'Turn on two-step verification (required)',
    enroll1: 'Open your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).',
    enroll2: 'Scan this QR code, or type the key by hand.', enroll3: 'Enter the 6-digit code the app shows.',
    qrAlt: 'QR code for the authenticator app', key: 'Key', activate: 'Turn on',
    keepKey: 'Keep a copy of the key somewhere safe: if you lose your phone, you can’t get into the panel without it.',
    code6: 'The code has 6 digits.', codeBad: 'Wrong or expired code. Try the next one.',
    session: 'Session: {e} · two-step verification ✓', signOut: 'Sign out',
    tabClaims: 'Contribution claims', tabGifts: 'Gift codes', tabAudit: 'Audit log',
    autoOn: '<span class="ok">Automatic verification: ON</span> (activates on its own only if everything matches exactly and the amount is within the {max} USDC cap: 1 to 20 flowers)',
    autoOff: '<b class="warn">Manual verification</b> — check each transfer (the “Check on Base” button or the explorer link) before activating.',
    noAddr: 'The SUPPORT_ADDRESS secret is missing in the support-claims function: checks will fail.',
    showOpen: 'Show claims to decide', showAwaiting: 'Show reserved amounts not paid yet', refresh: 'Refresh', empty: 'Nothing here.',
    flower: 'flower', flowers: 'flowers', reserved: 'Reserved', received: 'Code received', expires: 'Expires',
    explorer: 'View in the Base explorer (Basescan) ↗', reason: 'Reason', lastCheck: 'Last check',
    confirmations: '{n} confirmations', receivedAmt: 'received: {a} USDC', notChecked: 'Not checked yet.',
    check: 'Check on Base', approve: 'Activate full access', approveTip: 'Only if every check passes',
    manualP: 'Manual activation or rejection (reason required, recorded in the log):', reasonPh: 'Reason…',
    manual: 'Activate manually with this reason', reject: 'Reject with this reason',
    mailNotSent: 'Access activated, but the confirmation e-mail could NOT be sent ({e}).',
    st_submitted: 'code received', st_manual_review: 'manual review', st_awaiting_payment: 'awaiting payment',
    ck_tx_found: 'The transaction exists on Base', ck_tx_success: 'The transaction succeeded', ck_usdc_contract: 'It is USDC (Circle’s official contract)',
    ck_destination: 'It reached our address', ck_exact_amount: 'Exact amount', ck_after_claim: 'Sent after the amount was reserved',
    ck_confirmations: 'Enough confirmations', ck_tx_unused: 'Code not used by another claim', ck_claim_open: 'Claim still open and from that account',
    ck_auto_limit: 'Within the automatic cap ({max} USDC; otherwise “monto_alto”)',
    giftH: 'Send a gift code (7 days of access, valid for 7 days)', send: 'Send code', sending: 'Sending…',
    giftLimits: 'Limits: 20 codes a day in total and 3 per e-mail address. The code only travels in the e-mail: it can’t be seen here.',
    testBtn: 'Send a test e-mail to my address', sentTo: 'Sent to {to}. Expires: {d}.',
    testSent: 'Test e-mail sent to {to}. Check the spam folder too.', codesH: 'Codes', noCodes: 'No codes yet.',
    thCreated: 'Created', thTo: 'To', thDays: 'Days', thExpires: 'Expires', thState: 'State', thUsedBy: 'Used by',
    void: 'Void', voidPh: 'Reason for voiding', voidOk: 'Confirm void',
    gs_creado: 'created', gs_enviado: 'sent', gs_usado: 'used', gs_vencido: 'expired', gs_anulado: 'voided',
    auditP: 'Read-only. Nobody can edit or delete this log from the app.',
    thWhen: 'When', thWho: 'Who', thAction: 'Action', thAccount: 'Account', thReason: 'Reason',
    e_not_allowed: 'Not allowed: this needs an admin account with two-step verification.',
    e_reason_required: 'Write a reason (at least 5 characters).', e_not_found: 'Not found.',
    e_not_found_or_closed: 'That claim is already closed.', e_claim_closed: 'That claim is already closed.',
    e_bad_email: 'That e-mail address doesn’t look valid.', e_blocked_domain: 'That e-mail domain is blocked (disposable e-mail).',
    e_daily_limit_20: '20 codes were already created today (daily limit).', e_email_limit_3: 'That address already got 3 codes (limit).',
    e_email_failed: 'The e-mail could not be sent. The code was VOIDED.', e_not_found_or_not_active: 'That code is no longer active.',
    e_could_not_verify_admin: 'The admin permission could not be checked.', e_server_error: 'Server error. Try again.',
  },
  de: {
    title: 'Mother Verde · Verwaltungsbereich', loading: 'Wird geladen…', wait: 'Einen Moment…',
    signInFirst: 'Melde dich bei <a href="/">Mother Verde</a> mit deinem Verwaltungskonto an und komm auf diese Seite zurück.',
    notAdmin: 'Dieses Konto hat keinen Zugang zum Verwaltungsbereich.', backApp: 'Zurück zu Mother Verde',
    mfaH: 'Zwei-Faktor-Bestätigung', mfaP: 'Gib den 6-stelligen Code aus deiner Authenticator-App ein.', verify: 'Bestätigen',
    enrollH: 'Zwei-Faktor-Bestätigung einschalten (Pflicht)',
    enroll1: 'Öffne deine Authenticator-App (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).',
    enroll2: 'Scanne diesen QR-Code oder gib den Schlüssel von Hand ein.', enroll3: 'Gib den 6-stelligen Code ein, den die App anzeigt.',
    qrAlt: 'QR-Code für die Authenticator-App', key: 'Schlüssel', activate: 'Einschalten',
    keepKey: 'Bewahre eine Kopie des Schlüssels sicher auf: Wenn du dein Telefon verlierst, kommst du ohne ihn nicht in den Verwaltungsbereich.',
    code6: 'Der Code hat 6 Ziffern.', codeBad: 'Falscher oder abgelaufener Code. Versuch den nächsten.',
    session: 'Sitzung: {e} · Zwei-Faktor-Bestätigung ✓', signOut: 'Abmelden',
    tabClaims: 'Beitragsmeldungen', tabGifts: 'Geschenkcodes', tabAudit: 'Protokoll',
    autoOn: '<span class="ok">Automatische Prüfung: AN</span> (schaltet nur selbst frei, wenn alles genau passt und der Betrag die Grenze von {max} USDC nicht überschreitet: 1 bis 20 Blüten)',
    autoOff: '<b class="warn">Manuelle Prüfung</b> — prüfe jede Überweisung (Button „Auf Base prüfen“ oder Link zum Explorer), bevor du freischaltest.',
    noAddr: 'In der Funktion support-claims fehlt das Secret SUPPORT_ADDRESS: Die Prüfungen werden fehlschlagen.',
    showOpen: 'Offene Meldungen anzeigen', showAwaiting: 'Reservierte, unbezahlte Beträge anzeigen', refresh: 'Aktualisieren', empty: 'Hier ist nichts.',
    flower: 'Blüte', flowers: 'Blüten', reserved: 'Reserviert', received: 'Code erhalten', expires: 'Läuft ab',
    explorer: 'Im Base-Explorer ansehen (Basescan) ↗', reason: 'Grund', lastCheck: 'Letzte Prüfung',
    confirmations: '{n} Bestätigungen', receivedAmt: 'erhalten: {a} USDC', notChecked: 'Noch nicht geprüft.',
    check: 'Auf Base prüfen', approve: 'Vollzugriff freischalten', approveTip: 'Nur wenn alle Prüfungen bestanden sind',
    manualP: 'Manuelle Freischaltung oder Ablehnung (Grund Pflicht, wird protokolliert):', reasonPh: 'Grund…',
    manual: 'Mit diesem Grund manuell freischalten', reject: 'Mit diesem Grund ablehnen',
    mailNotSent: 'Zugang freigeschaltet, aber die Bestätigungs-E-Mail konnte NICHT gesendet werden ({e}).',
    st_submitted: 'Code erhalten', st_manual_review: 'manuelle Prüfung', st_awaiting_payment: 'wartet auf Zahlung',
    ck_tx_found: 'Die Transaktion existiert auf Base', ck_tx_success: 'Die Transaktion war erfolgreich', ck_usdc_contract: 'Es ist USDC (offizieller Vertrag von Circle)',
    ck_destination: 'Sie kam an unserer Adresse an', ck_exact_amount: 'Genauer Betrag', ck_after_claim: 'Nach der Reservierung gesendet',
    ck_confirmations: 'Genug Bestätigungen', ck_tx_unused: 'Code in keiner anderen Meldung verwendet', ck_claim_open: 'Meldung offen und von diesem Konto',
    ck_auto_limit: 'Innerhalb der automatischen Grenze ({max} USDC; sonst „monto_alto“)',
    giftH: 'Geschenkcode senden (7 Tage Zugang, 7 Tage gültig)', send: 'Code senden', sending: 'Wird gesendet…',
    giftLimits: 'Grenzen: insgesamt 20 Codes pro Tag und 3 pro E-Mail-Adresse. Der Code steht nur in der E-Mail: Hier ist er nicht sichtbar.',
    testBtn: 'Test-E-Mail an meine Adresse senden', sentTo: 'Gesendet an {to}. Läuft ab: {d}.',
    testSent: 'Test-E-Mail an {to} gesendet. Sieh auch im Spam-Ordner nach.', codesH: 'Codes', noCodes: 'Noch keine Codes.',
    thCreated: 'Erstellt', thTo: 'An', thDays: 'Tage', thExpires: 'Läuft ab', thState: 'Status', thUsedBy: 'Verwendet von',
    void: 'Ungültig machen', voidPh: 'Grund für die Ungültigkeit', voidOk: 'Ungültigkeit bestätigen',
    gs_creado: 'erstellt', gs_enviado: 'gesendet', gs_usado: 'verwendet', gs_vencido: 'abgelaufen', gs_anulado: 'ungültig',
    auditP: 'Nur lesen. Niemand kann dieses Protokoll in der App ändern oder löschen.',
    thWhen: 'Wann', thWho: 'Wer', thAction: 'Aktion', thAccount: 'Konto', thReason: 'Grund',
    e_not_allowed: 'Nicht erlaubt: Dafür braucht es ein Verwaltungskonto mit Zwei-Faktor-Bestätigung.',
    e_reason_required: 'Schreib einen Grund (mindestens 5 Zeichen).', e_not_found: 'Nicht gefunden.',
    e_not_found_or_closed: 'Diese Meldung ist schon abgeschlossen.', e_claim_closed: 'Diese Meldung ist schon abgeschlossen.',
    e_bad_email: 'Diese E-Mail-Adresse scheint ungültig.', e_blocked_domain: 'Diese E-Mail-Domain ist gesperrt (Wegwerf-E-Mail).',
    e_daily_limit_20: 'Heute wurden schon 20 Codes erstellt (Tagesgrenze).', e_email_limit_3: 'Diese Adresse hat schon 3 Codes erhalten (Grenze).',
    e_email_failed: 'Die E-Mail konnte nicht gesendet werden. Der Code wurde UNGÜLTIG gemacht.', e_not_found_or_not_active: 'Dieser Code ist nicht mehr aktiv.',
    e_could_not_verify_admin: 'Die Verwaltungsberechtigung konnte nicht geprüft werden.', e_server_error: 'Serverfehler. Versuch es noch einmal.',
  },
  fr: {
    title: 'Mother Verde · Espace d’administration', loading: 'Chargement…', wait: 'Un instant…',
    signInFirst: 'Connecte-toi à <a href="/">Mother Verde</a> avec ton compte d’administration et reviens sur cette page.',
    notAdmin: 'Ce compte n’a pas accès à l’espace d’administration.', backApp: 'Retour à Mother Verde',
    mfaH: 'Vérification en deux étapes', mfaP: 'Saisis le code à 6 chiffres de ton application d’authentification.', verify: 'Vérifier',
    enrollH: 'Active la vérification en deux étapes (obligatoire)',
    enroll1: 'Ouvre ton application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).',
    enroll2: 'Scanne ce code QR, ou saisis la clé à la main.', enroll3: 'Saisis le code à 6 chiffres affiché par l’application.',
    qrAlt: 'Code QR pour l’application d’authentification', key: 'Clé', activate: 'Activer',
    keepKey: 'Garde une copie de la clé en lieu sûr : si tu perds ton téléphone, tu ne pourras pas entrer dans l’espace sans elle.',
    code6: 'Le code a 6 chiffres.', codeBad: 'Code incorrect ou expiré. Essaie le suivant.',
    session: 'Session : {e} · vérification en deux étapes ✓', signOut: 'Se déconnecter',
    tabClaims: 'Déclarations de contribution', tabGifts: 'Codes cadeaux', tabAudit: 'Journal',
    autoOn: '<span class="ok">Vérification automatique : ACTIVE</span> (n’active seule que si tout correspond exactement et que le montant ne dépasse pas le plafond de {max} USDC : de 1 à 20 fleurs)',
    autoOff: '<b class="warn">Vérification manuelle</b> — vérifie chaque transfert (bouton « Vérifier sur Base » ou lien vers l’explorateur) avant d’activer.',
    noAddr: 'Le secret SUPPORT_ADDRESS manque dans la fonction support-claims : les vérifications échoueront.',
    showOpen: 'Voir les déclarations à traiter', showAwaiting: 'Voir les montants réservés non payés', refresh: 'Actualiser', empty: 'Rien ici.',
    flower: 'fleur', flowers: 'fleurs', reserved: 'Réservé', received: 'Code reçu', expires: 'Expire',
    explorer: 'Voir dans l’explorateur Base (Basescan) ↗', reason: 'Motif', lastCheck: 'Dernière vérification',
    confirmations: '{n} confirmations', receivedAmt: 'reçu : {a} USDC', notChecked: 'Pas encore vérifié.',
    check: 'Vérifier sur Base', approve: 'Activer l’accès complet', approveTip: 'Seulement si toutes les vérifications passent',
    manualP: 'Activation manuelle ou refus (motif obligatoire, enregistré dans le journal) :', reasonPh: 'Motif…',
    manual: 'Activer manuellement avec ce motif', reject: 'Refuser avec ce motif',
    mailNotSent: 'Accès activé, mais l’e-mail de confirmation n’a PAS pu être envoyé ({e}).',
    st_submitted: 'code reçu', st_manual_review: 'vérification manuelle', st_awaiting_payment: 'en attente de paiement',
    ck_tx_found: 'La transaction existe sur Base', ck_tx_success: 'La transaction a abouti', ck_usdc_contract: 'C’est de l’USDC (contrat officiel de Circle)',
    ck_destination: 'Elle est arrivée à notre adresse', ck_exact_amount: 'Montant exact', ck_after_claim: 'Envoyée après la réservation du montant',
    ck_confirmations: 'Confirmations suffisantes', ck_tx_unused: 'Code non utilisé dans une autre déclaration', ck_claim_open: 'Déclaration ouverte et de ce compte',
    ck_auto_limit: 'Sous le plafond automatique ({max} USDC ; sinon « monto_alto »)',
    giftH: 'Envoyer un code cadeau (7 jours d’accès, valable 7 jours)', send: 'Envoyer le code', sending: 'Envoi…',
    giftLimits: 'Limites : 20 codes par jour au total et 3 par adresse e-mail. Le code ne voyage que dans l’e-mail : il n’est pas visible ici.',
    testBtn: 'Envoyer un e-mail de test à mon adresse', sentTo: 'Envoyé à {to}. Expire : {d}.',
    testSent: 'E-mail de test envoyé à {to}. Vérifie aussi les spams.', codesH: 'Codes', noCodes: 'Pas encore de codes.',
    thCreated: 'Créé', thTo: 'Pour', thDays: 'Jours', thExpires: 'Expire', thState: 'État', thUsedBy: 'Utilisé par',
    void: 'Annuler', voidPh: 'Motif de l’annulation', voidOk: 'Confirmer l’annulation',
    gs_creado: 'créé', gs_enviado: 'envoyé', gs_usado: 'utilisé', gs_vencido: 'expiré', gs_anulado: 'annulé',
    auditP: 'Lecture seule. Personne ne peut modifier ni supprimer ce journal depuis l’app.',
    thWhen: 'Quand', thWho: 'Qui', thAction: 'Action', thAccount: 'Compte', thReason: 'Motif',
    e_not_allowed: 'Non autorisé : il faut un compte d’administration avec vérification en deux étapes.',
    e_reason_required: 'Écris un motif (au moins 5 caractères).', e_not_found: 'Introuvable.',
    e_not_found_or_closed: 'Cette déclaration est déjà close.', e_claim_closed: 'Cette déclaration est déjà close.',
    e_bad_email: 'Cette adresse e-mail ne semble pas valide.', e_blocked_domain: 'Ce domaine e-mail est bloqué (e-mail jetable).',
    e_daily_limit_20: '20 codes ont déjà été créés aujourd’hui (limite quotidienne).', e_email_limit_3: 'Cette adresse a déjà reçu 3 codes (limite).',
    e_email_failed: 'L’e-mail n’a pas pu être envoyé. Le code a été ANNULÉ.', e_not_found_or_not_active: 'Ce code n’est plus actif.',
    e_could_not_verify_admin: 'Impossible de vérifier l’autorisation d’administration.', e_server_error: 'Erreur du serveur. Réessaie.',
  },
};
const tr = (k, vars = {}) => Object.entries(vars).reduce((s, [a, b]) => s.split('{' + a + '}').join(String(b)), T[lang][k] ?? T.es[k] ?? k);
const ERR_KEYS = Object.keys(T.es).filter((k) => k.startsWith('e_')).map((k) => k.slice(2));
const errText = (e, detail) => (ERR_KEYS.includes(e) ? tr('e_' + e) : e || 'Error') + (detail ? ` (${detail})` : '');
const rpcErr = (error) => { const m = error?.message || ''; return ERR_KEYS.find((k) => m.includes(k)) || m; };

async function fn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'server_error' }));
}

// ------------------------------------------------------------ language switch
let redraw = () => {};
function header() {
  document.documentElement.lang = lang;
  document.title = tr('title');
  const h1 = document.querySelector('main h1');
  if (h1) h1.textContent = tr('title');
  let sw = document.getElementById('plang');
  if (!sw) {
    sw = document.createElement('div');
    sw.id = 'plang'; sw.className = 'tabs'; sw.setAttribute('aria-label', 'Language');
    sw.innerHTML = LANGS.map((l) => `<button type="button" data-plang="${l}">${l.toUpperCase()}</button>`).join('');
    h1.after(sw);
    sw.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        lang = b.dataset.plang;
        try { localStorage.setItem('mv-lang', lang); } catch (e) {}
        header(); redraw();
      };
    });
  }
  sw.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.plang === lang));
}

// ------------------------------------------------------------ gatekeeping
async function start() {
  redraw = start;
  header();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { app.innerHTML = `<div class="card"><p>${tr('signInFirst')}</p></div>`; return; }
  const { data: who, error } = await sb.rpc('admin_whoami');
  if (error || !who?.admin) {
    app.innerHTML = `<div class="card"><p>${tr('notAdmin')}</p><p class="muted"><a href="/">${tr('backApp')}</a></p></div>`;
    return;
  }
  if (who.aal !== 'aal2') return mfaStep();
  return panel(session.user.email);
}

let enrollment = null; // keep the same QR/key if the language changes mid-enrollment
async function mfaStep() {
  redraw = mfaStep;
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) { app.innerHTML = `<div class="card bad">${esc(error.message)}</div>`; return; }
  const verified = (data.totp || []).find((f) => f.status === 'verified');
  if (verified) {
    app.innerHTML = `<div class="card"><h2>${tr('mfaH')}</h2><p>${tr('mfaP')}</p>
      <div class="row"><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="max-width:160px">
      <button id="go">${tr('verify')}</button></div><p class="msg" id="msg"></p></div>`;
    document.getElementById('go').onclick = () => verify(verified.id);
    return;
  }
  if (!enrollment || !(data.all || []).some((f) => f.id === enrollment.id)) {
    // First time: remove half-finished enrollments, then enroll a TOTP app.
    for (const f of data.all || []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const en = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Mother Verde admin' });
    if (en.error) { app.innerHTML = `<div class="card bad">${esc(en.error.message)}</div>`; return; }
    enrollment = en.data;
  }
  app.innerHTML = `<div class="card"><h2>${tr('enrollH')}</h2>
    <ol><li>${tr('enroll1')}</li><li>${tr('enroll2')}</li><li>${tr('enroll3')}</li></ol>
    <div class="qr"><img alt="${esc(tr('qrAlt'))}" src="${esc(enrollment.totp.qr_code)}"></div>
    <p class="muted">${tr('key')}: <span class="mono">${esc(enrollment.totp.secret)}</span></p>
    <div class="row"><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="max-width:160px">
    <button id="go">${tr('activate')}</button></div><p class="msg" id="msg"></p>
    <p class="muted">${tr('keepKey')}</p></div>`;
  document.getElementById('go').onclick = () => verify(enrollment.id);
}

async function verify(factorId) {
  const code = document.getElementById('code').value.trim();
  const msg = document.getElementById('msg');
  if (!/^\d{6}$/.test(code)) { msg.textContent = tr('code6'); return; }
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) { msg.textContent = tr('codeBad'); return; }
  enrollment = null;
  start();
}

// ------------------------------------------------------------ panel
let tab = 'claims';
async function panel(email) {
  redraw = () => panel(email);
  app.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="muted">${esc(tr('session', { e: email }))}</span>
      <button class="ghost" id="out">${tr('signOut')}</button></div>
    <div class="tabs" id="ptabs">
      <button data-t="claims">${tr('tabClaims')}</button>
      <button data-t="gifts">${tr('tabGifts')}</button>
      <button data-t="audit">${tr('tabAudit')}</button></div>
    <div id="view"></div>`;
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); location.href = '/'; };
  app.querySelectorAll('#ptabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; show(); }; });
  show();
}
function show() {
  app.querySelectorAll('#ptabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  ({ claims: claimsView, gifts: giftsView, audit: auditView })[tab]();
}
const view = () => document.getElementById('view');

// ------------------------------------------------------------ claims
const CHECKS = ['tx_found', 'tx_success', 'usdc_contract', 'destination', 'exact_amount', 'after_claim', 'confirmations', 'tx_unused', 'claim_open', 'auto_limit'];
let showAwaiting = false;
let autoMax = 201; // claim_auto_max_usdc, read from the server

async function claimsView() {
  view().innerHTML = `<p class="muted">${tr('loading')}</p>`;
  const [cfg, list] = await Promise.all([
    fn('support-claims', { action: 'config' }),
    sb.rpc('admin_list_claims', { p_statuses: showAwaiting ? ['awaiting_payment'] : ['submitted', 'manual_review'] }),
  ]);
  if (list.error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(list.error)))}</div>`; return; }
  if (typeof cfg.auto_max_usdc === 'number') autoMax = cfg.auto_max_usdc;
  view().innerHTML = `
    <div class="card"><p>${cfg.auto_enabled ? tr('autoOn', { max: autoMax }) : tr('autoOff')}</p>${cfg.support_address_set === false ? `<p class="bad">${tr('noAddr')}</p>` : ''}
      <div class="row"><button class="ghost" id="tg">${showAwaiting ? tr('showOpen') : tr('showAwaiting')}</button>
      <button class="ghost" id="rl">${tr('refresh')}</button></div></div>
    ${list.data.length ? list.data.map(claimCard).join('') : `<p class="muted">${tr('empty')}</p>`}`;
  document.getElementById('tg').onclick = () => { showAwaiting = !showAwaiting; claimsView(); };
  document.getElementById('rl').onclick = claimsView;
  view().querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => claimAction(b.dataset.act, Number(b.dataset.id)); });
}

function claimCard(c) {
  const v = c.verification || null;
  const checks = v?.checks ? CHECKS.filter((k) => k in v.checks)
    .map((k) => `<li class="${v.checks[k] ? 'ok' : 'bad'}">${v.checks[k] ? '✓' : '✗'} ${tr('ck_' + k, { max: autoMax })}</li>`).join('') : '';
  const allPass = v?.all_pass === true;
  const open = c.status === 'submitted' || c.status === 'manual_review';
  const extra = [v?.detail?.confirmations != null ? tr('confirmations', { n: v.detail.confirmations }) : '',
    v?.detail?.received_units?.length ? tr('receivedAmt', { a: v.detail.received_units.map(usdc).join(', ') }) : ''].filter(Boolean).join(' · ');
  return `<div class="card">
    <div class="row" style="justify-content:space-between"><b>${esc(c.account_email)}</b><span class="pill">${esc(tr('st_' + c.status))}</span></div>
    <p><b class="mono" style="font-size:18px">${esc(Number(c.amount_usdc).toFixed(4))} USDC</b> · ${c.flowers} ${c.flowers === 1 ? tr('flower') : tr('flowers')}</p>
    <p class="muted">${tr('reserved')}: ${when(c.created_at)} · ${tr('received')}: ${when(c.submitted_at)} · ${tr('expires')}: ${when(c.expires_at)}</p>
    ${c.tx_hash ? `<p>TXID: <span class="mono">${esc(c.tx_hash)}</span><br><a href="${esc(c.explorer_url)}" target="_blank" rel="noopener noreferrer">${tr('explorer')}</a></p>` : ''}
    ${c.review_reason ? `<p class="warn">${tr('reason')}: ${esc(c.review_reason)}</p>` : ''}
    ${v ? `<p class="muted">${tr('lastCheck')}: ${when(v.checked_at)}${extra ? ' · ' + extra : ''}</p><ul class="checks">${checks}</ul>` : `<p class="muted">${tr('notChecked')}</p>`}
    ${open ? `
      <div class="row">
        <button data-act="check" data-id="${c.id}">${tr('check')}</button>
        <button data-act="approve" data-id="${c.id}" ${allPass ? '' : `disabled title="${esc(tr('approveTip'))}"`}>${tr('approve')}</button>
      </div>
      <p class="muted" style="margin-top:10px">${tr('manualP')}</p>
      <textarea id="r${c.id}" maxlength="500" placeholder="${esc(tr('reasonPh'))}"></textarea>
      <div class="row" style="margin-top:6px">
        <button class="ghost" data-act="manual" data-id="${c.id}">${tr('manual')}</button>
        <button class="danger" data-act="reject" data-id="${c.id}">${tr('reject')}</button>
      </div>
      <p class="msg" id="m${c.id}"></p>` : ''}
  </div>`;
}

async function claimAction(act, id) {
  const msg = document.getElementById('m' + id);
  const reason = document.getElementById('r' + id)?.value.trim() || '';
  if ((act === 'manual' || act === 'reject') && reason.length < 5) { msg.textContent = tr('e_reason_required'); return; }
  view().querySelectorAll(`[data-id="${id}"]`).forEach((b) => { b.disabled = true; });
  msg.textContent = tr('wait');
  const body = { claim_id: id };
  if (act === 'check') body.action = 'admin_check';
  if (act === 'approve') body.action = 'admin_approve';
  if (act === 'manual') { body.action = 'admin_approve'; body.reason = reason; }
  if (act === 'reject') { body.action = 'admin_reject'; body.reason = reason; }
  const r = await fn('support-claims', body);
  if (r.error) { msg.textContent = errText(r.error); setTimeout(claimsView, 2500); return; }
  await claimsView();
  if (body.action === 'admin_approve' && r.email_sent === false) {
    const d = document.createElement('div');
    d.className = 'card warn'; d.textContent = tr('mailNotSent', { e: r.email_error || 'error' });
    view().prepend(d);
  }
}

// ------------------------------------------------------------ gift codes
async function giftsView() {
  view().innerHTML = `
    <div class="card"><h2>${tr('giftH')}</h2>
      <div class="row"><input id="ge" type="email" placeholder="correo@example.com" maxlength="254" style="max-width:340px">
      <button id="gs">${tr('send')}</button></div>
      <p class="msg" id="gm"></p>
      <p class="muted">${tr('giftLimits')}</p>
      <div class="row"><button class="ghost" id="gt">${tr('testBtn')}</button></div>
      <p class="msg" id="gtm"></p></div>
    <div class="card"><h2>${tr('codesH')}</h2><div id="gl" class="scroll"><p class="muted">${tr('loading')}</p></div></div>`;
  document.getElementById('gs').onclick = async () => {
    const m = document.getElementById('gm'); const email = document.getElementById('ge').value.trim();
    if (!email) { m.textContent = tr('e_bad_email'); return; }
    document.getElementById('gs').disabled = true; m.textContent = tr('sending');
    const r = await fn('admin-send-gift-code', { action: 'send', email });
    document.getElementById('gs').disabled = false;
    m.className = 'msg ' + (r.ok ? 'ok' : 'bad');
    m.textContent = r.ok ? tr('sentTo', { to: r.to, d: when(r.expires_at) }) : errText(r.error, r.detail);
    if (r.ok) document.getElementById('ge').value = '';
    loadGifts();
  };
  document.getElementById('gt').onclick = async () => {
    const m = document.getElementById('gtm'); m.textContent = tr('sending');
    const r = await fn('admin-send-gift-code', { action: 'test_email' });
    m.className = 'msg ' + (r.ok ? 'ok' : 'bad');
    m.textContent = r.ok ? tr('testSent', { to: r.to }) : errText(r.error, r.detail);
  };
  loadGifts();
}
const GSTATE = { creado: '', enviado: 'ok', usado: 'muted', vencido: 'muted', anulado: 'bad' };
async function loadGifts() {
  const { data, error } = await sb.rpc('admin_list_gift_codes', { p_limit: 200 });
  const box = document.getElementById('gl');
  if (!box) return;
  if (error) { box.innerHTML = `<p class="bad">${esc(errText(rpcErr(error)))}</p>`; return; }
  if (!data.length) { box.innerHTML = `<p class="muted">${tr('noCodes')}</p>`; return; }
  box.innerHTML = `<table><tr><th>${tr('thCreated')}</th><th>${tr('thTo')}</th><th>${tr('thDays')}</th><th>${tr('thExpires')}</th><th>${tr('thState')}</th><th>${tr('thUsedBy')}</th><th></th></tr>
    ${data.map((g) => `<tr><td>${when(g.created_at)}<br><span class="muted">${esc(g.created_label)}</span></td>
      <td>${esc(g.sent_to_email || '—')}</td><td>${g.days}</td><td>${when(g.expires_at)}</td>
      <td class="${GSTATE[g.state] || ''}" data-state="${esc(g.state)}">${esc(tr('gs_' + g.state))}${g.revoked_reason ? `<br><span class="muted">${esc(g.revoked_reason)}</span>` : ''}</td>
      <td>${esc(g.used_by_email || '')}${g.used_at ? `<br><span class="muted">${when(g.used_at)}</span>` : ''}</td>
      <td>${g.state === 'enviado' || g.state === 'creado' ? `<button class="ghost" data-void="${g.id}">${tr('void')}</button>` : ''}</td></tr>
      <tr id="vr${g.id}" hidden><td colspan="7"><div class="row"><input id="vi${g.id}" placeholder="${esc(tr('voidPh'))}" maxlength="300" style="max-width:420px">
        <button class="danger" data-voidok="${g.id}">${tr('voidOk')}</button><span class="msg" id="vm${g.id}"></span></div></td></tr>`).join('')}</table>`;
  box.querySelectorAll('[data-void]').forEach((b) => { b.onclick = () => { document.getElementById('vr' + b.dataset.void).hidden = false; }; });
  box.querySelectorAll('[data-voidok]').forEach((b) => {
    b.onclick = async () => {
      const id = Number(b.dataset.voidok); const reason = document.getElementById('vi' + id).value.trim();
      const m = document.getElementById('vm' + id);
      if (reason.length < 5) { m.textContent = tr('e_reason_required'); return; }
      const { error: e } = await sb.rpc('admin_revoke_gift_code', { p_id: id, p_reason: reason });
      if (e) { m.textContent = errText(rpcErr(e)); return; }
      loadGifts();
    };
  });
}

// ------------------------------------------------------------ audit log
async function auditView() {
  view().innerHTML = `<div class="card scroll"><p class="muted">${tr('loading')}</p></div>`;
  const { data, error } = await sb.rpc('admin_list_audit', { p_limit: 300 });
  if (error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(error)))}</div>`; return; }
  view().innerHTML = `<div class="card scroll"><p class="muted">${tr('auditP')}</p>
    <table><tr><th>${tr('thWhen')}</th><th>${tr('thWho')}</th><th>${tr('thAction')}</th><th>${tr('thAccount')}</th><th>${tr('thReason')}</th></tr>
    ${data.map((a) => `<tr><td>${when(a.at)}</td><td>${esc(a.actor_label)}</td><td>${esc(a.action)}</td><td>${esc(a.target_email || '')}</td><td>${esc(a.reason || '')}</td></tr>`).join('')}</table></div>`;
}

start();
