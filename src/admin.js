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
import './stageBadge.js'; // «STAGING · pruebas» when this build uses the test project

let sb =createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
// Sample-data panel (/panel-mv.html?demo=1): dev-preview builds only; in the
// production build this is the constant false and adminDemo.js isn't emitted.
const DEMO = import.meta.env.VITE_MV_PREVIEW === '1' && new URLSearchParams(location.search).has('demo');
let demoFn = null;
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Amounts are TEXT (never JavaScript floats): the server sends '20.0420';
// shown with the language's decimal separator. Received on-chain amounts are
// integer base units, shown with all 6 decimals.
const DEC_SEP = { es: ',', en: '.', de: ',', fr: ',' };
const amt = (text) => (text == null ? '' : String(text).replace('.', DEC_SEP[lang] || '.'));
const usdc = (units) => { const t = String(units ?? ''); if (!/^\d+$/.test(t)) return ''; const p = t.padStart(7, '0'); return p.slice(0, -6).replace(/^0+(?=\d)/, '') + (DEC_SEP[lang] || '.') + p.slice(-6); };

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
    e_could_not_verify_admin: 'No se pudo comprobar el permiso de administración.', e_server_error: 'Error del servidor. Inténtalo de nuevo.', e_demo: 'Vista previa: no se guarda nada.', demoBanner: 'VISTA PREVIA con datos de ejemplo — nada de esto es real y no se guarda nada.',
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
    e_could_not_verify_admin: 'The admin permission could not be checked.', e_server_error: 'Server error. Try again.', e_demo: 'Preview: nothing is saved.', demoBanner: 'PREVIEW with sample data — none of this is real and nothing is saved.',
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
    e_could_not_verify_admin: 'Die Verwaltungsberechtigung konnte nicht geprüft werden.', e_server_error: 'Serverfehler. Versuch es noch einmal.', e_demo: 'Vorschau: Es wird nichts gespeichert.', demoBanner: 'VORSCHAU mit Beispieldaten — nichts davon ist echt und es wird nichts gespeichert.',
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
    e_could_not_verify_admin: 'Impossible de vérifier l’autorisation d’administration.', e_server_error: 'Erreur du serveur. Réessaie.', e_demo: 'Aperçu : rien n’est enregistré.', demoBanner: 'APERÇU avec des données d’exemple — rien de tout cela n’est réel et rien n’est enregistré.',
  },
};
// Texts for Summary, Users, contact, e-mail buttons and CSV export.
const T2 = {
  es: {
    mailFailH: 'Correos fallidos en las últimas 24 h', mailSentH: 'Correos enviados en las últimas 24 h', mailBanner: 'Correos fallidos en las últimas 24 h: {n}. Míralos en Registro.',
    mailListH: 'Envíos de correo (códigos, activaciones, pruebas)', mailListP: 'Cada envío de nuestras funciones. Si falló, ya se reintentó (y se probó Resend si MAIL_PROVIDER lo permite). Un código que no se pudo enviar queda anulado: envía otro.', thKind: 'Tipo', thResult: 'Resultado', thProvider: 'Salida', thAttempts: 'Intentos', thError: 'Error',
    mk_gift_code: 'Código de regalo', mk_activation: 'Activación', mk_test: 'Prueba', mk_signup_email_fixed: 'Correo de registro corregido', resOk: 'enviado', resFail: 'FALLÓ', mailRetried: 'Ojo: hubo que reintentar ({a} intentos, salió por {p}).',
    accountDeletedH: 'Cuenta borrada', accountDeletedP: 'La persona borró su cuenta. Se conservan solo el TXID, el monto, las fechas y el estado (sin correo, nombre ni teléfono). Aprobar registra el pago como recibido: no hay cuenta que activar ni correo que enviar.',
    tabSummary: 'Resumen', tabUsers: 'Usuarios', copyEmail: 'Copiar correo', copied: 'Copiado', writeEmail: 'Escribir',
    contactName: 'Nombre de contacto', contactPhone: 'WhatsApp o teléfono',
    sumAccounts: 'Cuentas en total', sumNew7: 'Altas en los últimos 7 días', sumTrialActive: 'Pruebas activas', sumTrialExpired: 'Pruebas vencidas sin aporte',
    sumFull: 'Con acceso completo', sumGift: 'Accesos por regalo vigentes', sumBlocked: 'Bloqueadas', sumClaims: 'Avisos de aporte', sumUsdc: 'USDC activado en total',
    cl_pendiente: 'Pendientes', cl_en_revision: 'En revisión', cl_rechazado: 'Rechazados', cl_activado: 'Activados', cl_vencido_o_cancelado: 'Vencidos o cancelados',
    us_prueba_activa: 'Prueba activa', us_prueba_vencida: 'Prueba vencida', us_acceso_completo: 'Acceso completo', us_regalo: 'Acceso por regalo', us_bloqueado: 'Bloqueado', us_sin_prueba: 'Sin prueba',
    usSearchPh: 'Buscar por correo o nombre', usAllStates: 'Todos los estados', usSearch: 'Buscar',
    thEmail: 'Correo', thName: 'Nombre visible', thCountry: 'País', thLang: 'Idioma', thState: 'Estado', thSignup: 'Alta', thTrialEnd: 'Fin de la prueba', thUntil: 'Acceso hasta', thContact: 'Contacto',
    openFile: 'Ver ficha', back: '← Volver a la lista', prev: '← Anteriores', next: 'Siguientes →', pageInfo: '{a}–{b} de {n}',
    fileH: 'Ficha de la cuenta', fileNote: 'Solo datos de cuenta y de acceso. Nunca Bitácora, fotos ni publicaciones. Abrir esta ficha queda en el registro.',
    fileClaims: 'Avisos de aporte', fileGifts: 'Códigos de regalo canjeados', none: 'Ninguno.',
    exportCsv: 'Exportar CSV', exporting: 'Preparando el archivo…', exported: 'Descargado: {f} ({n} filas).', exportCut: 'Ojo: el archivo tiene solo las primeras {n} filas (límite por exportación).',
    piiWarn: 'Este archivo contiene datos personales. Guárdalo en un lugar seguro y no lo compartas.', piiGo: 'Exportar', piiCancel: 'Cancelar',
    e_bad_state: 'Estado no válido.', e_bad_tab: 'Pestaña no válida.',
  },
  en: {
    mailFailH: 'Failed e-mails in the last 24 h', mailSentH: 'E-mails sent in the last 24 h', mailBanner: 'Failed e-mails in the last 24 h: {n}. See them in Log.',
    mailListH: 'E-mail sends (codes, activations, tests)', mailListP: 'Every send from our functions. A failure was already retried (and Resend tried if MAIL_PROVIDER allows it). A code that could not be sent is voided: send another one.', thKind: 'Type', thResult: 'Result', thProvider: 'Output', thAttempts: 'Attempts', thError: 'Error',
    mk_gift_code: 'Gift code', mk_activation: 'Activation', mk_test: 'Test', mk_signup_email_fixed: 'Sign-up e-mail corrected', resOk: 'sent', resFail: 'FAILED', mailRetried: 'Note: it needed a retry ({a} attempts, sent via {p}).',
    accountDeletedH: 'Account deleted', accountDeletedP: 'The person deleted their account. Only the TXID, amount, dates and status are kept (no e-mail, name or phone). Approving records the payment as received: there is no account to activate and no e-mail to send.',
    tabSummary: 'Summary', tabUsers: 'Users', copyEmail: 'Copy e-mail', copied: 'Copied', writeEmail: 'Write',
    contactName: 'Contact name', contactPhone: 'WhatsApp or phone',
    sumAccounts: 'Accounts in total', sumNew7: 'Sign-ups in the last 7 days', sumTrialActive: 'Active trials', sumTrialExpired: 'Expired trials without contribution',
    sumFull: 'With full access', sumGift: 'Active gift access', sumBlocked: 'Blocked', sumClaims: 'Contribution claims', sumUsdc: 'Total USDC activated',
    cl_pendiente: 'Pending', cl_en_revision: 'In review', cl_rechazado: 'Rejected', cl_activado: 'Activated', cl_vencido_o_cancelado: 'Expired or canceled',
    us_prueba_activa: 'Active trial', us_prueba_vencida: 'Expired trial', us_acceso_completo: 'Full access', us_regalo: 'Gift access', us_bloqueado: 'Blocked', us_sin_prueba: 'No trial',
    usSearchPh: 'Search by e-mail or name', usAllStates: 'All states', usSearch: 'Search',
    thEmail: 'E-mail', thName: 'Display name', thCountry: 'Country', thLang: 'Language', thState: 'State', thSignup: 'Signed up', thTrialEnd: 'Trial ends', thUntil: 'Access until', thContact: 'Contact',
    openFile: 'Open file', back: '← Back to the list', prev: '← Previous', next: 'Next →', pageInfo: '{a}–{b} of {n}',
    fileH: 'Account file', fileNote: 'Account and access data only. Never Bitácora, photos or posts. Opening this file is recorded in the log.',
    fileClaims: 'Contribution claims', fileGifts: 'Redeemed gift codes', none: 'None.',
    exportCsv: 'Export CSV', exporting: 'Preparing the file…', exported: 'Downloaded: {f} ({n} rows).', exportCut: 'Note: the file has only the first {n} rows (limit per export).',
    piiWarn: 'This file contains personal data. Keep it somewhere safe and don’t share it.', piiGo: 'Export', piiCancel: 'Cancel',
    e_bad_state: 'Invalid state.', e_bad_tab: 'Invalid tab.',
  },
  de: {
    mailFailH: 'Fehlgeschlagene E-Mails (letzte 24 h)', mailSentH: 'Gesendete E-Mails (letzte 24 h)', mailBanner: 'Fehlgeschlagene E-Mails in den letzten 24 h: {n}. Siehe Protokoll.',
    mailListH: 'E-Mail-Versand (Codes, Freischaltungen, Tests)', mailListP: 'Jeder Versand unserer Funktionen. Ein Fehler wurde schon wiederholt (und Resend versucht, wenn MAIL_PROVIDER es erlaubt). Ein Code, der nicht gesendet werden konnte, ist ungültig: Sende einen neuen.', thKind: 'Art', thResult: 'Ergebnis', thProvider: 'Weg', thAttempts: 'Versuche', thError: 'Fehler',
    mk_gift_code: 'Geschenkcode', mk_activation: 'Freischaltung', mk_test: 'Test', mk_signup_email_fixed: 'Registrierungs-E-Mail korrigiert', resOk: 'gesendet', resFail: 'FEHLGESCHLAGEN', mailRetried: 'Hinweis: Es brauchte einen neuen Versuch ({a} Versuche, gesendet über {p}).',
    accountDeletedH: 'Konto gelöscht', accountDeletedP: 'Die Person hat ihr Konto gelöscht. Erhalten bleiben nur TXID, Betrag, Daten und Status (keine E-Mail, kein Name, kein Telefon). Freischalten vermerkt die Zahlung als erhalten: Es gibt kein Konto zum Freischalten und keine E-Mail zum Senden.',
    tabSummary: 'Übersicht', tabUsers: 'Nutzer', copyEmail: 'E-Mail kopieren', copied: 'Kopiert', writeEmail: 'Schreiben',
    contactName: 'Kontaktname', contactPhone: 'WhatsApp oder Telefon',
    sumAccounts: 'Konten insgesamt', sumNew7: 'Neue Konten (letzte 7 Tage)', sumTrialActive: 'Aktive Testphasen', sumTrialExpired: 'Abgelaufene Testphasen ohne Beitrag',
    sumFull: 'Mit Vollzugriff', sumGift: 'Aktiver Geschenkzugang', sumBlocked: 'Gesperrt', sumClaims: 'Beitragsmeldungen', sumUsdc: 'Freigeschaltete USDC insgesamt',
    cl_pendiente: 'Offen', cl_en_revision: 'In Prüfung', cl_rechazado: 'Abgelehnt', cl_activado: 'Freigeschaltet', cl_vencido_o_cancelado: 'Abgelaufen oder storniert',
    us_prueba_activa: 'Testphase aktiv', us_prueba_vencida: 'Testphase abgelaufen', us_acceso_completo: 'Vollzugriff', us_regalo: 'Geschenkzugang', us_bloqueado: 'Gesperrt', us_sin_prueba: 'Ohne Testphase',
    usSearchPh: 'Nach E-Mail oder Name suchen', usAllStates: 'Alle Status', usSearch: 'Suchen',
    thEmail: 'E-Mail', thName: 'Anzeigename', thCountry: 'Land', thLang: 'Sprache', thState: 'Status', thSignup: 'Registriert', thTrialEnd: 'Testphase endet', thUntil: 'Zugang bis', thContact: 'Kontakt',
    openFile: 'Akte öffnen', back: '← Zurück zur Liste', prev: '← Vorherige', next: 'Nächste →', pageInfo: '{a}–{b} von {n}',
    fileH: 'Kontoakte', fileNote: 'Nur Konto- und Zugangsdaten. Nie Anbau-Tagebuch, Fotos oder Beiträge. Das Öffnen dieser Akte wird protokolliert.',
    fileClaims: 'Beitragsmeldungen', fileGifts: 'Eingelöste Geschenkcodes', none: 'Keine.',
    exportCsv: 'CSV exportieren', exporting: 'Datei wird vorbereitet…', exported: 'Heruntergeladen: {f} ({n} Zeilen).', exportCut: 'Achtung: Die Datei enthält nur die ersten {n} Zeilen (Grenze pro Export).',
    piiWarn: 'Diese Datei enthält personenbezogene Daten. Bewahre sie sicher auf und gib sie nicht weiter.', piiGo: 'Exportieren', piiCancel: 'Abbrechen',
    e_bad_state: 'Ungültiger Status.', e_bad_tab: 'Ungültiger Reiter.',
  },
  fr: {
    mailFailH: 'E-mails en échec (dernières 24 h)', mailSentH: 'E-mails envoyés (dernières 24 h)', mailBanner: 'E-mails en échec au cours des dernières 24 h : {n}. Voir le Journal.',
    mailListH: 'Envois d’e-mails (codes, activations, tests)', mailListP: 'Chaque envoi de nos fonctions. Un échec a déjà été réessayé (et Resend tenté si MAIL_PROVIDER le permet). Un code qui n’a pas pu être envoyé est annulé : envoies-en un autre.', thKind: 'Type', thResult: 'Résultat', thProvider: 'Sortie', thAttempts: 'Tentatives', thError: 'Erreur',
    mk_gift_code: 'Code cadeau', mk_activation: 'Activation', mk_test: 'Test', mk_signup_email_fixed: 'E-mail d’inscription corrigé', resOk: 'envoyé', resFail: 'ÉCHEC', mailRetried: 'Attention : il a fallu réessayer ({a} tentatives, envoyé via {p}).',
    accountDeletedH: 'Compte supprimé', accountDeletedP: 'La personne a supprimé son compte. Seuls le TXID, le montant, les dates et le statut sont conservés (ni e-mail, ni nom, ni téléphone). Approuver enregistre le paiement comme reçu : il n’y a ni compte à activer ni e-mail à envoyer.',
    tabSummary: 'Résumé', tabUsers: 'Utilisateurs', copyEmail: 'Copier l’e-mail', copied: 'Copié', writeEmail: 'Écrire',
    contactName: 'Nom de contact', contactPhone: 'WhatsApp ou téléphone',
    sumAccounts: 'Comptes au total', sumNew7: 'Inscriptions des 7 derniers jours', sumTrialActive: 'Essais en cours', sumTrialExpired: 'Essais expirés sans contribution',
    sumFull: 'Avec accès complet', sumGift: 'Accès cadeau en cours', sumBlocked: 'Bloqués', sumClaims: 'Déclarations de contribution', sumUsdc: 'Total d’USDC activés',
    cl_pendiente: 'En attente', cl_en_revision: 'En vérification', cl_rechazado: 'Refusées', cl_activado: 'Activées', cl_vencido_o_cancelado: 'Expirées ou annulées',
    us_prueba_activa: 'Essai en cours', us_prueba_vencida: 'Essai expiré', us_acceso_completo: 'Accès complet', us_regalo: 'Accès cadeau', us_bloqueado: 'Bloqué', us_sin_prueba: 'Sans essai',
    usSearchPh: 'Chercher par e-mail ou nom', usAllStates: 'Tous les états', usSearch: 'Chercher',
    thEmail: 'E-mail', thName: 'Nom affiché', thCountry: 'Pays', thLang: 'Langue', thState: 'État', thSignup: 'Inscription', thTrialEnd: 'Fin de l’essai', thUntil: 'Accès jusqu’au', thContact: 'Contact',
    openFile: 'Voir la fiche', back: '← Retour à la liste', prev: '← Précédents', next: 'Suivants →', pageInfo: '{a}–{b} sur {n}',
    fileH: 'Fiche du compte', fileNote: 'Uniquement les données de compte et d’accès. Jamais le journal de culture, les photos ou les publications. L’ouverture de cette fiche est enregistrée dans le journal.',
    fileClaims: 'Déclarations de contribution', fileGifts: 'Codes cadeaux utilisés', none: 'Aucun.',
    exportCsv: 'Exporter en CSV', exporting: 'Préparation du fichier…', exported: 'Téléchargé : {f} ({n} lignes).', exportCut: 'Attention : le fichier ne contient que les {n} premières lignes (limite par export).',
    piiWarn: 'Ce fichier contient des données personnelles. Garde-le en lieu sûr et ne le partage pas.', piiGo: 'Exporter', piiCancel: 'Annuler',
    e_bad_state: 'État non valide.', e_bad_tab: 'Onglet non valide.',
  },
};
// Late payment marks, reason history and TXID conflicts (20261014120000).
const T3 = {
  es: {
    pendingBanner: 'Avisos sin revisar: {n}', pendingOld: '{m} esperan más de 12 h', pendingGo: 'Ver avisos', waitingLong: 'Esperando hace más de 12 h', mk_txid_notice: 'Aviso de TXID nuevo',
    lateBadge: 'Pago tardío / reserva vencida', lateP: 'El TXID llegó después de que venciera la reserva de 72 h. Nunca se activa solo: revisa y escribe el motivo.',
    conflictBadge: 'Conflicto abierto', conflictP: 'Este aviso está en un conflicto (abajo). No se puede activar hasta resolverlo.',
    historyH: 'Historial de motivos', h_pago_tardio: 'pago tardío', h_comprobacion: 'comprobación en Base', h_envio: 'envío del TXID', h_conflicto: 'conflicto',
    conflictsH: 'Conflictos por resolver ({n})', conflictsP: 'Dos avisos reclaman el mismo pago. Ninguna persona ve el aviso de la otra; a las dos se les dijo solo «lo revisaremos manualmente». Compara fechas y montos en Basescan y elige de quién es el pago. El motivo es obligatorio y queda en el registro.',
    k_mismo_txid: 'Mismo TXID en dos avisos', k_mismo_monto: 'Pago tardío con el mismo monto que otro aviso',
    claimA: 'Aviso nuevo', claimB: 'Aviso con el que choca', winnerBtn: 'El pago es del aviso #{id}', noWinnerBtn: 'Resolver sin elegir (solo revisado)',
    conflictReasonPh: 'Motivo (obligatorio, al menos 10 caracteres)…', e_conflict_open: 'Ese aviso tiene un conflicto abierto: resuélvelo primero (arriba).',
    e_reason_required10: 'Escribe un motivo de al menos 10 caracteres.', resolvedOk: 'Conflicto resuelto.', e_already_resolved: 'Ese conflicto ya estaba resuelto.',
    lateYes: 'tardío', deletedAcc: 'cuenta borrada',
  },
  en: {
    pendingBanner: 'Claims to review: {n}', pendingOld: '{m} waiting more than 12 h', pendingGo: 'See claims', waitingLong: 'Waiting more than 12 h', mk_txid_notice: 'New TXID notice',
    lateBadge: 'Late payment / reservation expired', lateP: 'The TXID arrived after the 72 h reservation had expired. It never activates on its own: check it and write a reason.',
    conflictBadge: 'Open conflict', conflictP: 'This claim is in a conflict (below). It cannot be activated until the conflict is resolved.',
    historyH: 'Reason history', h_pago_tardio: 'late payment', h_comprobacion: 'Base check', h_envio: 'TXID sent', h_conflicto: 'conflict',
    conflictsH: 'Conflicts to resolve ({n})', conflictsP: "Two claims ask for the same payment. Neither person sees the other's claim; both were only told “we’ll review it by hand”. Compare dates and amounts on Basescan and choose whose payment it is. The reason is required and recorded in the log.",
    k_mismo_txid: 'Same TXID on two claims', k_mismo_monto: 'Late payment with the same amount as another claim',
    claimA: 'New claim', claimB: 'Claim it collides with', winnerBtn: 'The payment belongs to claim #{id}', noWinnerBtn: 'Resolve without choosing (reviewed only)',
    conflictReasonPh: 'Reason (required, at least 10 characters)…', e_conflict_open: 'That claim has an open conflict: resolve it first (above).',
    e_reason_required10: 'Write a reason of at least 10 characters.', resolvedOk: 'Conflict resolved.', e_already_resolved: 'That conflict was already resolved.',
    lateYes: 'late', deletedAcc: 'account deleted',
  },
  de: {
    pendingBanner: 'Ungeprüfte Meldungen: {n}', pendingOld: '{m} warten länger als 12 Std.', pendingGo: 'Meldungen ansehen', waitingLong: 'Wartet länger als 12 Std.', mk_txid_notice: 'Hinweis: neue TXID',
    lateBadge: 'Verspätete Zahlung / Reservierung abgelaufen', lateP: 'Die TXID kam, nachdem die 72-h-Reservierung abgelaufen war. Sie wird nie automatisch freigeschaltet: prüfen und Grund angeben.',
    conflictBadge: 'Offener Konflikt', conflictP: 'Diese Meldung steckt in einem Konflikt (unten). Sie kann erst freigeschaltet werden, wenn er gelöst ist.',
    historyH: 'Verlauf der Gründe', h_pago_tardio: 'verspätete Zahlung', h_comprobacion: 'Prüfung in Base', h_envio: 'TXID gesendet', h_conflicto: 'Konflikt',
    conflictsH: 'Zu lösende Konflikte ({n})', conflictsP: 'Zwei Meldungen beanspruchen dieselbe Zahlung. Keine Person sieht die Meldung der anderen; beiden wurde nur „wir prüfen es von Hand“ gesagt. Vergleiche Daten und Beträge auf Basescan und wähle, wem die Zahlung gehört. Der Grund ist Pflicht und wird protokolliert.',
    k_mismo_txid: 'Dieselbe TXID in zwei Meldungen', k_mismo_monto: 'Verspätete Zahlung mit demselben Betrag wie eine andere Meldung',
    claimA: 'Neue Meldung', claimB: 'Meldung, mit der sie kollidiert', winnerBtn: 'Die Zahlung gehört zu Meldung #{id}', noWinnerBtn: 'Ohne Auswahl lösen (nur geprüft)',
    conflictReasonPh: 'Grund (Pflicht, mindestens 10 Zeichen)…', e_conflict_open: 'Diese Meldung hat einen offenen Konflikt: zuerst lösen (oben).',
    e_reason_required10: 'Schreib einen Grund mit mindestens 10 Zeichen.', resolvedOk: 'Konflikt gelöst.', e_already_resolved: 'Dieser Konflikt war schon gelöst.',
    lateYes: 'verspätet', deletedAcc: 'Konto gelöscht',
  },
  fr: {
    pendingBanner: 'Avis à vérifier : {n}', pendingOld: '{m} attendent depuis plus de 12 h', pendingGo: 'Voir les avis', waitingLong: 'En attente depuis plus de 12 h', mk_txid_notice: 'Avis de nouveau TXID',
    lateBadge: 'Paiement tardif / réservation expirée', lateP: 'Le TXID est arrivé après l’expiration de la réservation de 72 h. Il ne s’active jamais tout seul : vérifie et écris un motif.',
    conflictBadge: 'Conflit ouvert', conflictP: 'Cet avis est dans un conflit (ci-dessous). Il ne peut pas être activé avant sa résolution.',
    historyH: 'Historique des motifs', h_pago_tardio: 'paiement tardif', h_comprobacion: 'vérification sur Base', h_envio: 'envoi du TXID', h_conflicto: 'conflit',
    conflictsH: 'Conflits à résoudre ({n})', conflictsP: 'Deux avis réclament le même paiement. Aucune personne ne voit l’avis de l’autre ; on leur a seulement dit « nous le vérifierons à la main ». Compare dates et montants sur Basescan et choisis à qui appartient le paiement. Le motif est obligatoire et enregistré dans le journal.',
    k_mismo_txid: 'Même TXID sur deux avis', k_mismo_monto: 'Paiement tardif avec le même montant qu’un autre avis',
    claimA: 'Nouvel avis', claimB: 'Avis avec lequel il entre en conflit', winnerBtn: 'Le paiement appartient à l’avis #{id}', noWinnerBtn: 'Résoudre sans choisir (seulement vérifié)',
    conflictReasonPh: 'Motif (obligatoire, au moins 10 caractères)…', e_conflict_open: 'Cet avis a un conflit ouvert : résous-le d’abord (ci-dessus).',
    e_reason_required10: 'Écris un motif d’au moins 10 caractères.', resolvedOk: 'Conflit résolu.', e_already_resolved: 'Ce conflit était déjà résolu.',
    lateYes: 'tardif', deletedAcc: 'compte supprimé',
  },
};
// «Cargando…» never stays forever (A2): texts of the way out.
const T4 = {
  es: { stuckH: 'No pudimos cargar esta parte del panel', stuckP: 'La conexión está tardando más de lo normal o algo falló.', stuckRetry: 'Reintentar',
    stuckMail: 'Si sigue pasando, escribe a {mail}.', e_network: 'No hay conexión con el servidor. Inténtalo de nuevo.' },
  en: { stuckH: 'We couldn’t load this part of the panel', stuckP: 'The connection is taking longer than usual or something went wrong.', stuckRetry: 'Try again',
    stuckMail: 'If it keeps happening, write to {mail}.', e_network: 'No connection to the server. Please try again.' },
  de: { stuckH: 'Dieser Teil des Bereichs konnte nicht geladen werden', stuckP: 'Die Verbindung dauert länger als üblich oder etwas ist schiefgelaufen.', stuckRetry: 'Erneut versuchen',
    stuckMail: 'Wenn es weiter passiert, schreib an {mail}.', e_network: 'Keine Verbindung zum Server. Bitte versuche es erneut.' },
  fr: { stuckH: 'Impossible de charger cette partie de l’espace', stuckP: 'La connexion prend plus de temps que d’habitude ou quelque chose a échoué.', stuckRetry: 'Réessayer',
    stuckMail: 'Si ça continue, écris à {mail}.', e_network: 'Pas de connexion avec le serveur. Réessaie.' },
};
for (const l of LANGS) Object.assign(T[l], T2[l], T3[l], T4[l]);
const tr = (k, vars = {}) => Object.entries(vars).reduce((s, [a, b]) => s.split('{' + a + '}').join(String(b)), T[lang][k] ?? T.es[k] ?? k);
const ERR_KEYS = Object.keys(T.es).filter((k) => k.startsWith('e_')).map((k) => k.slice(2));
const errText = (e, detail) => (ERR_KEYS.includes(e) ? tr('e_' + e) : e || 'Error') + (detail ? ` (${detail})` : '');
const rpcErr = (error) => { const m = error?.message || ''; return ERR_KEYS.find((k) => m.includes(k)) || m; };

async function fn(name, body) {
  if (demoFn) return demoFn(name, body);
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json().catch(() => ({ error: 'server_error' }));
  } catch (e) { return { error: 'network' }; } // no connection: say so instead of hanging
}

// «Cargando…» never stays forever: if a loading line is still there after
// STUCK_MS (a request that hangs or throws), its box shows «Reintentar»,
// «Cerrar sesión» and hello@ instead.
const STUCK_MS = 12000;
let loadSeq = 0;
function loadingP() {
  const id = ++loadSeq;
  setTimeout(() => { const el = document.querySelector(`[data-mv-loading="${id}"]`); if (el) stuck(el.parentElement); }, STUCK_MS);
  return `<p class="muted" data-mv-loading="${id}">${tr('loading')}</p>`;
}
function stuck(box) {
  box.innerHTML = `<div class="card bad" role="alert" id="mvStuck"><h2>${tr('stuckH')}</h2><p>${tr('stuckP')}</p>
    <div class="row"><button id="stRetry">${tr('stuckRetry')}</button><button class="ghost" id="stOut">${tr('signOut')}</button></div>
    <p class="muted">${tr('stuckMail', { mail: '<a href="mailto:hello@motherverdeny.com">hello@motherverdeny.com</a>' })}</p></div>`;
  box.querySelector('#stRetry').onclick = () => { Promise.resolve().then(() => redraw()).catch(() => stuck(box)); };
  box.querySelector('#stOut').onclick = async () => { try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {} location.href = '/'; };
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
  if (DEMO && !demoFn) {
    const d = await import('./adminDemo.js');
    sb = d.sb; demoFn = d.fn;
    const banner = document.createElement('div');
    banner.style.cssText = 'border:2px dashed #E8A33D;color:#E8A33D;border-radius:8px;padding:8px 12px;margin:0 0 12px;font-weight:600';
    banner.textContent = tr('demoBanner');
    app.before(banner);
  }
  header();
  app.innerHTML = loadingP();
  let session = null, who = null, error = null;
  try {
    ({ data: { session } } = await sb.auth.getSession());
    if (session) ({ data: who, error } = await sb.rpc('admin_whoami'));
  } catch (e) { return stuck(app); }
  if (!session) { app.innerHTML = `<div class="card"><p>${tr('signInFirst')}</p></div>`; return; }
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
let tab = 'summary';
let currentEmail = '';
async function panel(email) {
  currentEmail = email;
  redraw = () => panel(email);
  app.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="muted">${esc(tr('session', { e: email }))}</span>
      <button class="ghost" id="out">${tr('signOut')}</button></div>
    <div class="tabs" id="ptabs">
      <button data-t="summary">${tr('tabSummary')}</button>
      <button data-t="users">${tr('tabUsers')}</button>
      <button data-t="claims">${tr('tabClaims')}</button>
      <button data-t="gifts">${tr('tabGifts')}</button>
      <button data-t="audit">${tr('tabAudit')}</button></div>
    <div id="pendingAlert"></div>
    <div id="mailAlert"></div>
    <div id="view"></div>`;
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); location.href = '/'; };
  app.querySelectorAll('#ptabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; show(); }; });
  show();
}
function show() {
  app.querySelectorAll('#ptabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  mailAlert();
  pendingAlert();
  ({ summary: summaryView, users: usersView, claims: claimsView, gifts: giftsView, audit: auditView })[tab]();
}
const view = () => document.getElementById('view');

// "Avisos sin revisar": above every tab, red part for the ones older than 12 h.
async function pendingAlert() {
  const box = document.getElementById('pendingAlert');
  if (!box) return;
  const { data, error } = await sb.rpc('admin_pending_claims');
  if (error || !data || !data.open) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="card ${data.older_12h ? 'bad' : 'warn'}" id="pendingAlertCard" role="status">
    <b>${esc(tr('pendingBanner', { n: data.open }))}</b>${data.older_12h ? ` · <b data-old="${data.older_12h}">${esc(tr('pendingOld', { m: data.older_12h }))}</b>` : ''}
    ${tab !== 'claims' ? ` <button class="ghost" id="pendingGo">${tr('pendingGo')}</button>` : ''}</div>`;
  document.getElementById('pendingGo')?.addEventListener('click', () => { tab = 'claims'; show(); });
}

// "Correos fallidos en las últimas 24 h": above every tab when there is any.
async function mailAlert() {
  const box = document.getElementById('mailAlert');
  if (!box) return;
  const { data: n, error } = await sb.rpc('admin_mail_failures_24h');
  box.innerHTML = !error && n > 0 ? `<div class="card bad" id="mailAlertCard" role="alert"><b>${esc(tr('mailBanner', { n }))}</b></div>` : '';
}

// ------------------------------------------------------------ claims
const CHECKS = ['tx_found', 'tx_success', 'usdc_contract', 'destination', 'exact_amount', 'after_claim', 'confirmations', 'tx_unused', 'claim_open', 'auto_limit'];
let showAwaiting = false;
let autoMax = 201; // claim_auto_max_usdc, read from the server

async function claimsView() {
  pendingAlert();
  view().innerHTML = `${loadingP()}`;
  const [cfg, list, conf] = await Promise.all([
    fn('support-claims', { action: 'config' }),
    sb.rpc('admin_list_claims', { p_statuses: showAwaiting ? ['awaiting_payment'] : ['submitted', 'manual_review'] }),
    sb.rpc('admin_list_claim_conflicts', { p_include_resolved: false }),
  ]);
  if (list.error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(list.error)))}</div>`; return; }
  if (typeof cfg.auto_max_usdc === 'number') autoMax = cfg.auto_max_usdc;
  view().innerHTML = `
    <div class="card"><p>${cfg.auto_enabled ? tr('autoOn', { max: autoMax }) : tr('autoOff')}</p>${cfg.support_address_set === false ? `<p class="bad">${tr('noAddr')}</p>` : ''}
      <div class="row"><button class="ghost" id="tg">${showAwaiting ? tr('showOpen') : tr('showAwaiting')}</button>
      <button class="ghost" id="rl">${tr('refresh')}</button>
      <button class="ghost" data-export="claims" data-filters='${JSON.stringify({ statuses: showAwaiting ? ['awaiting_payment'] : ['submitted', 'manual_review'] })}'>${tr('exportCsv')}</button></div>
      <p class="msg" id="xm-claims"></p></div>
    ${conflictsBox(conf.data || [])}
    ${list.data.length ? list.data.map(claimCard).join('') : `<p class="muted">${tr('empty')}</p>`}`;
  document.getElementById('tg').onclick = () => { showAwaiting = !showAwaiting; claimsView(); };
  document.getElementById('rl').onclick = claimsView;
  view().querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => claimAction(b.dataset.act, Number(b.dataset.id)); });
  view().querySelectorAll('[data-resolve]').forEach((b) => { b.onclick = () => resolveConflict(Number(b.dataset.resolve), b.dataset.winner ? Number(b.dataset.winner) : null); });
  wireExports();
}

// Two claims asking for the same payment, side by side (admin only).
function conflictsBox(list) {
  if (!list.length) return '';
  const side = (x, label) => x ? `<div class="card" style="flex:1;min-width:240px;margin:0">
      <p class="muted">${label} · #${x.id}</p>
      <p>${x.account_deleted ? `<b class="warn">${tr('deletedAcc')}</b>` : emailCell(x.account_email, true)}</p>
      <p><b class="mono">${esc(amt(x.amount_usdc))} USDC</b> · ${esc(tr('st_' + x.status))}${x.late ? ` · <b class="warn">${tr('lateYes')}</b>` : ''}</p>
      <p class="muted">${tr('reserved')}: ${when(x.created_at)} · ${tr('expires')}: ${when(x.expires_at)} · ${tr('received')}: ${when(x.submitted_at)}</p>
      ${x.tx_hash ? `<p class="mono" style="word-break:break-all">${esc(x.tx_hash)}</p>` : ''}</div>` : '';
  return `<div class="card bad" id="conflictsCard" role="region" aria-labelledby="conflictsH">
    <h2 id="conflictsH">${esc(tr('conflictsH', { n: list.length }))}</h2>
    <p>${tr('conflictsP')}</p>
    ${list.map((k) => `<div class="card" data-conflict="${k.id}">
      <p><b>${tr('k_' + k.kind)}</b>${k.tx_hash ? ` · <a class="mono" href="https://basescan.org/tx/${esc(k.tx_hash)}" target="_blank" rel="noopener noreferrer">${esc(k.tx_hash.slice(0, 18))}…</a>` : ''} · ${when(k.created_at)}</p>
      <div class="row" style="align-items:stretch">${side(k.a, tr('claimA'))}${side(k.b, tr('claimB'))}</div>
      <textarea id="kr${k.id}" maxlength="500" placeholder="${esc(tr('conflictReasonPh'))}"></textarea>
      <div class="row" style="margin-top:6px">
        ${[k.a, k.b].filter(Boolean).map((x) => `<button data-resolve="${k.id}" data-winner="${x.id}">${esc(tr('winnerBtn', { id: x.id }))}</button>`).join('')}
        <button class="ghost" data-resolve="${k.id}" data-winner="">${tr('noWinnerBtn')}</button>
      </div>
      <p class="msg" id="km${k.id}"></p></div>`).join('')}
  </div>`;
}

async function resolveConflict(id, winner) {
  const msg = document.getElementById('km' + id);
  const reason = document.getElementById('kr' + id)?.value.trim() || '';
  if (reason.length < 10) { msg.textContent = tr('e_reason_required10'); return; }
  view().querySelectorAll(`[data-resolve="${id}"]`).forEach((b) => { b.disabled = true; });
  msg.textContent = tr('wait');
  const { error } = await sb.rpc('admin_resolve_claim_conflict', { p_conflict_id: id, p_winner_claim_id: winner, p_reason: reason });
  if (error) {
    const m = String(error.message || '');
    msg.textContent = m.includes('reason_required') ? tr('e_reason_required10') : m.includes('already_resolved') ? tr('e_already_resolved') : errText(rpcErr(error));
    view().querySelectorAll(`[data-resolve="${id}"]`).forEach((b) => { b.disabled = false; });
    return;
  }
  await claimsView();
  const d = document.createElement('div'); d.className = 'card ok'; d.setAttribute('role', 'status'); d.textContent = tr('resolvedOk');
  view().prepend(d);
}

function claimCard(c) {
  const v = c.verification || null;
  const checks = v?.checks ? CHECKS.filter((k) => k in v.checks)
    .map((k) => `<li class="${v.checks[k] ? 'ok' : 'bad'}">${v.checks[k] ? '✓' : '✗'} ${tr('ck_' + k, { max: autoMax })}</li>`).join('') : '';
  const allPass = v?.all_pass === true;
  const open = c.status === 'submitted' || c.status === 'manual_review';
  const extra = [v?.detail?.confirmations != null ? tr('confirmations', { n: v.detail.confirmations }) : '',
    v?.detail?.received_units?.length ? tr('receivedAmt', { a: v.detail.received_units.map(usdc).join(', ') }) : ''].filter(Boolean).join(' · ');
  const waitedLong = (c.status === 'submitted' || c.status === 'manual_review') && Date.now() - new Date(c.submitted_at || c.created_at).getTime() > 12 * 3600000;
  return `<div class="card${waitedLong ? ' bad' : ''}"${waitedLong ? ' data-waiting-long="1" style="border-width:2px"' : ''}>
    ${waitedLong ? `<p><b class="pill bad">${tr('waitingLong')}</b></p>` : ''}
    <div class="row" style="justify-content:space-between"><span>${c.account_deleted ? `<b class="warn" data-deleted="1">${tr('accountDeletedH')}</b>` : emailCell(c.account_email, true)}</span><span class="pill">${esc(tr('st_' + c.status))}</span></div>
    ${c.account_deleted ? `<p class="warn">${tr('accountDeletedP')}</p>` : ''}
    ${c.late ? `<p><b class="pill warn" data-late="1">${tr('lateBadge')}</b></p><p class="warn">${tr('lateP')}</p>` : ''}
    ${c.conflict_open ? `<p><b class="pill bad" data-conflict-open="1">${tr('conflictBadge')}</b></p><p class="bad">${tr('conflictP')}</p>` : ''}
    ${c.contact_name || c.contact_phone ? `<p class="muted">${c.contact_name ? `${tr('contactName')}: <b>${esc(c.contact_name)}</b>` : ''}${c.contact_name && c.contact_phone ? ' · ' : ''}${c.contact_phone ? `${tr('contactPhone')}: <b class="mono">${esc(c.contact_phone)}</b>` : ''}</p>` : ''}
    <p><b class="mono" style="font-size:18px">${esc(amt(c.amount_usdc))} USDC</b> · ${c.flowers} ${c.flowers === 1 ? tr('flower') : tr('flowers')}</p>
    <p class="muted">${tr('reserved')}: ${when(c.created_at)} · ${tr('received')}: ${when(c.submitted_at)} · ${tr('expires')}: ${when(c.expires_at)}</p>
    ${c.tx_hash ? `<p>TXID: <span class="mono">${esc(c.tx_hash)}</span><br><a href="${esc(c.explorer_url)}" target="_blank" rel="noopener noreferrer">${tr('explorer')}</a></p>` : ''}
    ${c.review_reason ? `<p class="warn">${tr('reason')}: ${esc(c.review_reason)}</p>` : ''}
    ${(c.review_history || []).length ? `<details class="history"><summary>${tr('historyH')} (${c.review_history.length})</summary><ol>${c.review_history.map((h) => `<li>${when(h.at)} · ${esc(T[lang]['h_' + h.by] ? tr('h_' + h.by) : h.by)} · <span class="mono">${esc(h.codes)}</span></li>`).join('')}</ol></details>` : ''}
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
    <div class="card"><div class="row" style="justify-content:space-between"><h2>${tr('codesH')}</h2><button class="ghost" data-export="gifts">${tr('exportCsv')}</button></div><p class="msg" id="xm-gifts"></p><div id="gl" class="scroll">${loadingP()}</div></div>`;
  document.getElementById('gs').onclick = async () => {
    const m = document.getElementById('gm'); const email = document.getElementById('ge').value.trim();
    if (!email) { m.textContent = tr('e_bad_email'); return; }
    document.getElementById('gs').disabled = true; m.textContent = tr('sending');
    const r = await fn('admin-send-gift-code', { action: 'send', email });
    document.getElementById('gs').disabled = false;
    m.className = 'msg ' + (r.ok ? 'ok' : 'bad');
    m.textContent = r.ok ? tr('sentTo', { to: r.to, d: when(r.expires_at) }) + (r.attempts > 1 ? ' ' + tr('mailRetried', { a: r.attempts, p: r.provider }) : '') : errText(r.error, r.detail);
    if (r.ok) document.getElementById('ge').value = '';
    loadGifts();
    mailAlert();
  };
  wireExports();
  document.getElementById('gt').onclick = async () => {
    const m = document.getElementById('gtm'); m.textContent = tr('sending');
    const r = await fn('admin-send-gift-code', { action: 'test_email' });
    m.className = 'msg ' + (r.ok ? 'ok' : 'bad');
    m.textContent = r.ok ? tr('testSent', { to: r.to }) + (r.attempts > 1 ? ' ' + tr('mailRetried', { a: r.attempts, p: r.provider }) : '') : errText(r.error, r.detail);
    mailAlert();
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
      <td>${g.used_by_email ? emailCell(g.used_by_email) : ''}${g.used_at ? `<br><span class="muted">${when(g.used_at)}</span>` : ''}</td>
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
  view().innerHTML = `<div class="card scroll">${loadingP()}</div>`;
  const [{ data, error }, mails] = await Promise.all([sb.rpc('admin_list_audit', { p_limit: 300 }), sb.rpc('admin_list_mail_events', { p_limit: 100 })]);
  if (error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(error)))}</div>`; return; }
  const me = mails.data || [];
  view().innerHTML = `<div class="card scroll" id="mailList"><h2>${tr('mailListH')}</h2><p class="muted">${tr('mailListP')}</p>
    ${me.length ? `<table><tr><th>${tr('thWhen')}</th><th>${tr('thKind')}</th><th>${tr('thResult')}</th><th>${tr('thProvider')}</th><th>${tr('thAttempts')}</th><th>${tr('thAccount')}</th><th>${tr('thError')}</th></tr>
    ${me.map((e) => `<tr><td>${when(e.at)}</td><td>${esc(tr('mk_' + e.kind))}</td><td class="${e.ok ? 'ok' : 'bad'}">${tr(e.ok ? 'resOk' : 'resFail')}</td><td>${esc(e.provider || '')}</td><td>${esc(e.attempts)}</td><td>${esc(e.account_email || e.ref || '')}</td><td class="muted">${esc(e.error || '')}</td></tr>`).join('')}</table>` : `<p class="muted">${tr('empty')}</p>`}</div>
    <div class="card scroll"><div class="row" style="justify-content:space-between"><p class="muted">${tr('auditP')}</p><button class="ghost" data-export="audit">${tr('exportCsv')}</button></div><p class="msg" id="xm-audit"></p>
    <table><tr><th>${tr('thWhen')}</th><th>${tr('thWho')}</th><th>${tr('thAction')}</th><th>${tr('thAccount')}</th><th>${tr('thReason')}</th></tr>
    ${data.map((a) => `<tr><td>${when(a.at)}</td><td>${esc(a.actor_label)}</td><td>${esc(a.action)}</td><td>${esc(a.target_email || '')}</td><td>${esc(a.reason || '')}</td></tr>`).join('')}</table></div>`;
  wireExports();
}

// ------------------------------------------------------------ e-mail: copy / write
// The panel never sends free-form or bulk e-mail: "Escribir" opens your own
// mail program (mailto) with the subject "Mother Verde".
function emailCell(email, bold = false) {
  if (!email) return '';
  const e = esc(email);
  return `<span class="mono"${bold ? ' style="font-weight:700"' : ''}>${e}</span> <button type="button" class="ghost mini" data-copy="${e}">${tr('copyEmail')}</button> <a class="mini-link" href="mailto:${encodeURIComponent(email)}?subject=Mother%20Verde">${tr('writeEmail')}</a>`;
}
document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-copy]');
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) {}
  const old = b.textContent; b.textContent = tr('copied'); setTimeout(() => { b.textContent = old; }, 1500);
});

// ------------------------------------------------------------ CSV export (server function: admin + MFA, logged)
function wireExports() {
  view().querySelectorAll('[data-export]').forEach((b) => {
    b.onclick = () => {
      const tabName = b.dataset.export;
      const filters = b.dataset.filters ? JSON.parse(b.dataset.filters) : (tabName === 'users' ? usersFilters() : {});
      if (tabName === 'users') return confirmPii(() => doExport(tabName, filters));
      doExport(tabName, filters);
    };
  });
}
function confirmPii(go) {
  const m = document.getElementById('xm-users');
  m.innerHTML = `<span class="warn">${tr('piiWarn')}</span> <button type="button" id="piiGo">${tr('piiGo')}</button> <button type="button" class="ghost" id="piiNo">${tr('piiCancel')}</button>`;
  document.getElementById('piiGo').onclick = () => { m.textContent = ''; go(); };
  document.getElementById('piiNo').onclick = () => { m.textContent = ''; };
}
async function doExport(tabName, filters) {
  const m = document.getElementById('xm-' + tabName);
  if (m) m.textContent = tr('exporting');
  const { data, error } = await sb.rpc('admin_export_csv', { p_tab: tabName, p_filters: filters });
  if (error) { if (m) m.textContent = errText(rpcErr(error)); return; }
  const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = data.filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  if (m) m.textContent = tr('exported', { f: data.filename, n: data.rows }) + (data.truncated ? ' ' + tr('exportCut', { n: data.rows }) : '');
}

// ------------------------------------------------------------ summary
async function summaryView() {
  view().innerHTML = `${loadingP()}`;
  const { data: s, error } = await sb.rpc('admin_summary');
  if (error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(error)))}</div>`; return; }
  const st = s.states || {}, cl = s.claims || {};
  const box = (label, n) => `<div class="card stat"><div class="muted">${label}</div><div class="big">${esc(n ?? 0)}</div></div>`;
  const mf = Number(s.mail_failed_24h || 0);
  view().innerHTML = `<div class="stats">
      <div class="card stat" id="sumMailFailed"><div class="muted">${tr('mailFailH')}</div><div class="big ${mf ? 'bad' : 'ok'}">${esc(mf)}</div></div>${box(tr('mailSentH'), s.mail_sent_24h)}
      ${box(tr('sumAccounts'), s.accounts)}${box(tr('sumNew7'), s.new_7d)}${box(tr('sumTrialActive'), st.prueba_activa)}
      ${box(tr('sumTrialExpired'), st.prueba_vencida)}${box(tr('sumFull'), st.acceso_completo)}${box(tr('sumGift'), st.regalo)}${box(tr('sumBlocked'), st.bloqueado)}
    </div>
    <div class="card"><h2>${tr('sumClaims')}</h2><div class="stats">
      ${['pendiente', 'en_revision', 'rechazado', 'activado', 'vencido_o_cancelado'].map((k) => box(tr('cl_' + k), cl[k])).join('')}
    </div><p>${tr('sumUsdc')}: <b class="mono">${esc(amt(s.usdc_activated || '0.0000'))} USDC</b></p></div>`;
}

// ------------------------------------------------------------ users (read-only)
const PAGE = 50;
const US = { search: '', state: '', offset: 0 };
const USER_STATES = ['prueba_activa', 'prueba_vencida', 'acceso_completo', 'regalo', 'bloqueado', 'sin_prueba'];
const usersFilters = () => ({ search: US.search, state: US.state });
async function usersView() {
  view().innerHTML = `<div class="card">
      <div class="row"><input id="usQ" placeholder="${esc(tr('usSearchPh'))}" value="${esc(US.search)}" style="max-width:280px">
        <select id="usS">${['', ...USER_STATES].map((v) => `<option value="${v}"${v === US.state ? ' selected' : ''}>${v ? tr('us_' + v) : tr('usAllStates')}</option>`).join('')}</select>
        <button id="usGo">${tr('usSearch')}</button>
        <button class="ghost" data-export="users">${tr('exportCsv')}</button></div>
      <p class="msg" id="xm-users"></p></div>
    <div class="card scroll" id="usList">${loadingP()}</div>`;
  const go = () => { US.search = document.getElementById('usQ').value.trim(); US.state = document.getElementById('usS').value; US.offset = 0; loadUsers(); };
  document.getElementById('usGo').onclick = go;
  document.getElementById('usQ').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  wireExports();
  loadUsers();
}
async function loadUsers() {
  const box = document.getElementById('usList');
  const { data, error } = await sb.rpc('admin_list_users', { p_search: US.search || null, p_state: US.state || null, p_limit: PAGE, p_offset: US.offset });
  if (error) { box.innerHTML = `<p class="bad">${esc(errText(rpcErr(error)))}</p>`; return; }
  const total = data.length ? Number(data[0].total) : 0;
  const d = (x) => (x ? new Date(x).toLocaleDateString(LOCALE[lang]) : '—');
  box.innerHTML = !data.length ? `<p class="muted">${tr('empty')}</p>` : `
    <table><tr><th>${tr('thEmail')}</th><th>${tr('thName')}</th><th>${tr('thCountry')}</th><th>${tr('thLang')}</th><th>${tr('thState')}</th><th>${tr('thSignup')}</th><th>${tr('thTrialEnd')}</th><th>${tr('thUntil')}</th><th>${tr('thContact')}</th><th></th></tr>
    ${data.map((u) => `<tr><td>${emailCell(u.email)}</td><td>${esc(u.display_name || '')}</td><td>${esc(u.country || '')}</td><td>${esc((u.lang || '').toUpperCase())}</td>
      <td>${esc(tr('us_' + u.state))}</td><td>${d(u.created_at)}</td><td>${d(u.trial_ends_at)}</td><td>${d(u.access_until)}</td>
      <td>${esc(u.contact_name || '')}${u.contact_phone ? `<br><span class="mono">${esc(u.contact_phone)}</span>` : ''}</td>
      <td><button type="button" class="ghost mini" data-file="${esc(u.user_id)}">${tr('openFile')}</button></td></tr>`).join('')}</table>
    <div class="row" style="margin-top:10px">
      <button class="ghost" id="usPrev" ${US.offset === 0 ? 'disabled' : ''}>${tr('prev')}</button>
      <span class="muted">${tr('pageInfo', { a: US.offset + 1, b: US.offset + data.length, n: total })}</span>
      <button class="ghost" id="usNext" ${US.offset + data.length >= total ? 'disabled' : ''}>${tr('next')}</button></div>`;
  document.getElementById('usPrev')?.addEventListener('click', () => { US.offset = Math.max(0, US.offset - PAGE); loadUsers(); });
  document.getElementById('usNext')?.addEventListener('click', () => { US.offset += PAGE; loadUsers(); });
  box.querySelectorAll('[data-file]').forEach((b) => { b.onclick = () => userFile(b.dataset.file); });
}
// One account's file — opening it is logged by the server (user_viewed).
async function userFile(id) {
  redraw = () => userFile(id);
  view().innerHTML = `${loadingP()}`;
  const { data: u, error } = await sb.rpc('admin_get_user', { p_user_id: id });
  if (error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(error)))}</div>`; return; }
  const d = (x) => (x ? when(x) : '—');
  view().innerHTML = `<button class="ghost" id="usBack">${tr('back')}</button>
    <div class="card" style="margin-top:10px"><h2>${tr('fileH')}</h2><p class="muted">${tr('fileNote')}</p>
      <table>
        <tr><th>${tr('thEmail')}</th><td>${emailCell(u.email, true)}</td></tr>
        <tr><th>${tr('thName')}</th><td>${esc(u.display_name || '—')}</td></tr>
        <tr><th>${tr('thCountry')}</th><td>${esc(u.country || '—')}</td></tr>
        <tr><th>${tr('thLang')}</th><td>${esc((u.lang || '').toUpperCase())}</td></tr>
        <tr><th>${tr('thState')}</th><td>${esc(tr('us_' + u.state))}</td></tr>
        <tr><th>${tr('thSignup')}</th><td>${d(u.created_at)}</td></tr>
        <tr><th>${tr('thTrialEnd')}</th><td>${d(u.trial_ends_at)}</td></tr>
        <tr><th>${tr('thUntil')}</th><td>${d(u.access_until)}</td></tr>
        <tr><th>${tr('contactName')}</th><td>${esc(u.contact_name || '—')}</td></tr>
        <tr><th>${tr('contactPhone')}</th><td class="mono">${esc(u.contact_phone || '—')}</td></tr>
      </table></div>
    <div class="card"><h2>${tr('fileClaims')}</h2>${(u.claims || []).length ? `<table>${u.claims.map((c) => `<tr><td>#${c.id}</td><td>${esc(tr('st_' + c.status) || c.status)}</td><td class="mono">${esc(amt(c.amount_usdc))} USDC</td><td>${d(c.created_at)}</td><td class="mono">${esc(c.tx_hash || '')}</td><td>${esc(c.review_reason || '')}</td></tr>`).join('')}</table>` : `<p class="muted">${tr('none')}</p>`}</div>
    <div class="card"><h2>${tr('fileGifts')}</h2>${(u.gift_codes || []).length ? `<table>${u.gift_codes.map((g) => `<tr><td>#${g.id}</td><td>${g.days} d</td><td>${d(g.used_at)}</td></tr>`).join('')}</table>` : `<p class="muted">${tr('none')}</p>`}</div>`;
  document.getElementById('usBack').onclick = () => { redraw = () => panel(currentEmail); usersView(); };
}

start();
