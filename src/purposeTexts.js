// Purpose of the contribution, the welcome story and related texts (Bertha's
// approved texts, 2026-11-03, verbatim; she uses tú / du / tu, like the rest
// of the platform). One place for the lawyer and the accountant to read.
// tools/apply-purpose-texts.mjs copies them into public/main.js (translations),
// and the support-claims function has its own copy of the e-mail lines.
// Rules: no «donación» except in «No es una donación»; NO degree or title is
// ever named (no «bachillerato», «bachelor», «B.Tech.», program name; Bertha,
// 2026-11-04): the no-degree-text test fails if one appears.

// SUNY sentence — PROVISIONAL (Bertha will set the final wording). THE ONLY
// PLACE to change it: edit these 4 lines, run `node tools/apply-purpose-texts.mjs`
// (copies it to public/main.js and to the support-claims e-mails), then
// redeploy the support-claims function (paste in the Supabase dashboard).
export const SUNY_ACCEPTED = {
  es: 'SUNY Morrisville me abrió otra vez sus puertas para seguir aprendiendo y creciendo en mi vida profesional.',
  en: 'SUNY Morrisville opened its doors to me once again so I can keep learning and growing in my professional life.',
  de: 'Die SUNY Morrisville hat mir ihre Türen noch einmal geöffnet, damit ich weiter lernen und in meinem Berufsleben wachsen kann.',
  fr: 'SUNY Morrisville m’a de nouveau ouvert ses portes pour que je continue d’apprendre et de grandir dans ma vie professionnelle.',
};
const S = SUNY_ACCEPTED;

// «Tu aporte único de apoyo me ayuda a seguir estudiando.» — Bertha's own
// sentence, ONE place: the «Antes de aportar» box (dsProp1) and the three
// contribution e-mails («aviso recibido», «acceso activo», «aporte manual
// confirmado», copied into support-claims by tools/apply-purpose-texts.mjs).
export const SUPPORT_HELPS = {
  es: 'Tu aporte único de apoyo me ayuda a seguir estudiando.',
  en: 'Your one-time support contribution helps me keep studying.',
  de: 'Dein einmaliger Unterstützungsbeitrag hilft mir, weiter zu studieren.',
  fr: 'Ta contribution unique de soutien m’aide à continuer d’étudier.',
};
const H = SUPPORT_HELPS;

export const PURPOSE_TEXTS = {
  // ---------------------------------------------------------- welcome story
  storyDialog: { es: 'Nuestra historia', en: 'Our story', de: 'Unsere Geschichte', fr: 'Notre histoire' },
  storyNext: { es: 'Continuar', en: 'Continue', de: 'Weiter', fr: 'Continuer' },
  storySkip: { es: 'Saltar e ir a la plataforma', en: 'Skip and go to the platform', de: 'Überspringen und zur Plattform', fr: 'Passer et aller à la plateforme' },
  storyEnter: { es: 'Entrar a la plataforma', en: 'Enter the platform', de: 'Zur Plattform', fr: 'Entrer sur la plateforme' },
  storyBack: { es: 'Atrás', en: 'Back', de: 'Zurück', fr: 'Retour' },
  storyStep: { es: 'Pantalla {n} de {total}', en: 'Screen {n} of {total}', de: 'Bildschirm {n} von {total}', fr: 'Écran {n} sur {total}' },
  storyPhotoSoon: { es: 'Foto próximamente', en: 'Photo coming soon', de: 'Foto folgt', fr: 'Photo à venir' },
  story1H: { es: 'Bienvenida', en: 'Welcome', de: 'Willkommen', fr: 'Bienvenue' },
  story1P: {
    es: '<p>Gracias por entrar a Mother Verde.</p><p>Esta es una plataforma única: aprendes sobre el cannabis con ciencia, con ética y en tu idioma. Encontrarás lecciones respaldadas por fuentes reales, herramientas prácticas, información para que te informes antes de viajar y una comunidad donde todos se entienden, aunque hablen idiomas distintos.</p><p><b>Solo para mayores de edad.</b></p><p>Antes de empezar, quiero contarte quién está detrás y por qué nació.</p>',
    en: '<p>Thank you for coming to Mother Verde.</p><p>This is a one-of-a-kind platform where you learn about cannabis with science, with ethics and in your own language. You’ll find lessons backed by real sources, practical tools, information to help you prepare before you travel, and a community where everyone understands each other, even when they speak different languages.</p><p><b>For adults only.</b></p><p>Before you start, I’d like to tell you who is behind it and why it was born.</p>',
    de: '<p>Danke, dass du bei Mother Verde bist.</p><p>Dies ist eine einzigartige Plattform: Du lernst über Cannabis mit Wissenschaft, mit Ethik und in deiner Sprache. Du findest Lektionen mit echten Quellen, praktische Werkzeuge, Informationen, damit du dich vor einer Reise informieren kannst, und eine Community, in der sich alle verstehen, auch wenn sie unterschiedliche Sprachen sprechen.</p><p><b>Nur für Erwachsene.</b></p><p>Bevor es losgeht, möchte ich dir erzählen, wer dahintersteckt und warum es entstanden ist.</p>',
    fr: '<p>Merci d’être sur Mother Verde.</p><p>Cette plateforme est unique : tu apprends le cannabis avec la science, avec éthique et dans ta langue. Tu y trouveras des leçons appuyées sur de vraies sources, des outils pratiques, des informations pour te renseigner avant de voyager et une communauté où tout le monde se comprend, même en parlant des langues différentes.</p><p><b>Réservé aux adultes.</b></p><p>Avant de commencer, je veux te raconter qui est derrière et pourquoi elle est née.</p>',
  },
  story2H: { es: 'Quién está detrás', en: 'Who is behind it', de: 'Wer dahintersteckt', fr: 'Qui est derrière' },
  // photo alt texts (proposed 2026-11-03, waiting for Bertha's «APRUEBO»;
  // field photos 02, 03, 08 are hemp (< 0.3 % THC, confirmed by Bertha): «cáñamo», never «cannabis»)
  // photo alt texts: screen n = storyAltn (Bertha, 2026-11-03; photos per screen in src/storyPhotos.js)
  storyAlt1: { es: 'Bertha sonríe junto a las hojas de una planta de cannabis.', en: 'Bertha smiles next to the leaves of a cannabis plant.', de: 'Bertha lächelt neben den Blättern einer Cannabispflanze.', fr: 'Bertha sourit à côté des feuilles d’une plante de cannabis.' },
  storyAlt2: { es: 'Bertha, con una capucha tejida andina, mira de cerca las flores de una planta de cannabis.', en: 'Bertha, wearing an Andean woven hood, looks closely at the flowers of a cannabis plant.', de: 'Bertha, mit einer gewebten Kapuze im Andenstil, betrachtet die Blüten einer Cannabispflanze aus der Nähe.', fr: 'Bertha, coiffée d’une capuche tissée andine, observe de près les fleurs d’une plante de cannabis.' },
  storyAlt3: { es: 'Bertha, con una camiseta del Perú y una manguera en la mano, en un campo de cáñamo.', en: 'Bertha, wearing a Peru T-shirt and holding a hose, in a hemp field.', de: 'Bertha, in einem Peru-T-Shirt und mit einem Schlauch in der Hand, auf einem Hanffeld.', fr: 'Bertha, en t-shirt du Pérou et un tuyau à la main, dans un champ de chanvre.' },
  storyAlt4: { es: 'Bertha, con toga y birrete verdes, sonríe con su diploma de SUNY Morrisville.', en: 'Bertha, in a green gown and cap, smiles with her SUNY Morrisville diploma.', de: 'Bertha, in grünem Talar und Absolventenhut, lächelt mit ihrem Diplom der SUNY Morrisville.', fr: 'Bertha, en toge et toque vertes, sourit avec son diplôme de SUNY Morrisville.' },
  storyAlt5: { es: 'Plantas de cannabis creciendo en un sistema hidropónico dentro de una carpa de cultivo.', en: 'Cannabis plants growing in a hydroponic system inside a grow tent.', de: 'Cannabispflanzen wachsen in einem Hydrokultursystem in einem Growzelt.', fr: 'Des plants de cannabis poussent dans un système hydroponique à l’intérieur d’une tente de culture.' },
  storyAlt6: { es: 'Bertha abraza una planta de cáñamo muy alta en un campo.', en: 'Bertha hugs a very tall hemp plant in a field.', de: 'Bertha umarmt auf einem Feld eine sehr hohe Hanfpflanze.', fr: 'Bertha enlace un très grand plant de chanvre dans un champ.' },
  story2P: {
    es: '<p>Soy Bertha Limo, peruana, de una familia de agrónomos y químicos farmacéuticos.</p><p>Desde muy pequeña quise unir esos dos mundos: la planta y la ciencia que la entiende. Siento que es un regalo que recibí de mi linaje.</p>',
    en: '<p>I’m Bertha Limo, Peruvian, from a family of agronomists and pharmaceutical chemists.</p><p>Ever since I was very young I wanted to combine those two worlds: the plant and the science that understands it. I feel it’s a gift I received from my lineage.</p>',
    de: '<p>Ich bin Bertha Limo, Peruanerin, aus einer Familie von Agronomen und pharmazeutischen Chemikern.</p><p>Schon als kleines Kind wollte ich diese beiden Welten verbinden: die Pflanze und die Wissenschaft, die sie versteht. Ich sehe es als Geschenk meiner Herkunft.</p>',
    fr: '<p>Je suis Bertha Limo, péruvienne, issue d’une famille d’agronomes et de chimistes pharmaciens.</p><p>Toute petite, je voulais réunir ces deux mondes : la plante et la science qui la comprend. Je le vois comme un cadeau reçu de ma lignée.</p>',
  },
  story3H: { es: 'Un sueño hecho realidad', en: 'A dream come true', de: 'Ein wahr gewordener Traum', fr: 'Un rêve devenu réalité' },
  story3P: {
    es: '<p>A los 40 años cumplí uno de mis sueños: viajar a Estados Unidos para estudiar plantas, en especial el cannabis. No fue fácil. Pasé por el choque de cultura, el idioma, la comida y una inversión enorme. Y valió la pena.</p><p>No solo recibí una educación de mucha calidad. También me nutrí de su gente y de su cultura, que al final me hicieron sentir como en casa.</p>',
    en: '<p>At 40, I fulfilled one of my dreams: traveling to the United States to study plants, especially cannabis. It wasn’t easy. I went through culture shock, a new language, different food and a huge investment. And it was worth it.</p><p>I didn’t only receive a high-quality education. I was also nourished by its people and its culture, which in the end made me feel at home.</p>',
    de: '<p>Mit 40 habe ich mir einen Traum erfüllt: in die USA zu reisen, um Pflanzen zu studieren, vor allem Cannabis. Es war nicht leicht. Ich erlebte den Kulturschock, eine neue Sprache, fremdes Essen und eine enorme Investition. Und es hat sich gelohnt.</p><p>Ich habe nicht nur eine hochwertige Ausbildung erhalten. Ich habe auch viel von den Menschen und ihrer Kultur mitgenommen, die mir am Ende das Gefühl gaben, zu Hause zu sein.</p>',
    fr: '<p>À 40 ans, j’ai réalisé l’un de mes rêves : voyager aux États-Unis pour étudier les plantes, en particulier le cannabis. Ce n’était pas facile. J’ai traversé le choc culturel, une nouvelle langue, une nourriture différente et un investissement énorme. Et cela en valait la peine.</p><p>Je n’ai pas seulement reçu une éducation de grande qualité. Je me suis aussi nourrie de ses gens et de sa culture, qui, au final, m’ont fait me sentir chez moi.</p>',
  },
  story4H: { es: 'Mi reto de hoy', en: 'My challenge today', de: 'Meine Herausforderung heute', fr: 'Mon défi d’aujourd’hui' },
  story4P: {
    es: '<p>Hoy estoy ante un gran reto. ' + S.es + ' Volver a esa casa de estudios me emociona muchísimo.</p><p>Esta vez necesito tu ayuda. Por eso nació esta plataforma: para darte algo valioso a cambio de tu colaboración.</p><p>La primera vez, puedes explorar gratis durante 24 horas. Si te sirve y quieres apoyarme, ahí estará la opción.</p>',
    en: '<p>Today I face a big challenge. ' + S.en + ' Going back to that home of learning moves me deeply.</p><p>This time I need your help. That is why this platform was born: to give you something valuable in return for your collaboration.</p><p>The first time, you can explore for free for 24 hours. If it helps you and you’d like to support me, the option will be there.</p>',
    de: '<p>Heute stehe ich vor einer großen Herausforderung. ' + S.de + ' Die Rückkehr an diese Hochschule bewegt mich sehr.</p><p>Diesmal brauche ich deine Hilfe. Deshalb ist diese Plattform entstanden: um dir als Dank für deine Unterstützung etwas Wertvolles zu geben.</p><p>Beim ersten Mal kannst du 24 Stunden lang kostenlos erkunden. Wenn es dir nützt und du mich unterstützen möchtest, ist die Möglichkeit da.</p>',
    fr: '<p>Aujourd’hui, je fais face à un grand défi. ' + S.fr + ' Retourner dans cette maison d’études m’émeut profondément.</p><p>Cette fois, j’ai besoin de ton aide. C’est pour cela que cette plateforme est née : pour te donner quelque chose de précieux en retour de ta collaboration.</p><p>La première fois, tu peux explorer gratuitement pendant 24 heures. Si cela t’est utile et que tu veux me soutenir, l’option sera là.</p>',
  },
  story5H: { es: 'Lo que encontrarás aquí', en: 'What you’ll find here', de: 'Das findest du hier', fr: 'Ce que tu trouveras ici' },
  story5Calc: { es: 'Calculadoras para VPD, DLI, dosis, EC ↔ PPM, luz y más (17 en total).', en: 'Calculators for VPD, DLI, dosing, EC ↔ PPM, light and more (17 in total).', de: 'Rechner für VPD, DLI, Dosierung, EC ↔ PPM, Licht und mehr (17 insgesamt).', fr: 'Des calculateurs pour le VPD, le DLI, le dosage, EC ↔ PPM, la lumière et plus (17 au total).' },
  story5Viaje: { es: 'Información para viajar: ¿es legal donde viajas?, ¿a dónde acudir si necesitas ayuda? y qué países son estrictamente ilegales. Información orientativa; las leyes cambian. No es asesoría legal.', en: 'Travel information: is it legal where you’re going? Where to turn if you need help? And which countries are strictly illegal. Guidance only; laws change. This is not legal advice.', de: 'Reiseinformationen: Ist es dort legal, wohin du reist? Wohin kannst du dich wenden, wenn du Hilfe brauchst? Und welche Länder sind strikt illegal. Orientierende Information; Gesetze ändern sich. Keine Rechtsberatung.', fr: 'Informations pour voyager : est-ce légal là où tu voyages ? Où t’adresser si tu as besoin d’aide ? Et quels pays sont strictement illégaux. Information indicative ; les lois changent. Ce n’est pas un conseil juridique.' },
  story5Juego: { es: 'Un juego que te enseña a cultivar paso a paso, con lecciones basadas en ciencia.', en: 'A game that teaches you to grow step by step, with science-based lessons.', de: 'Ein Spiel, das dir Schritt für Schritt den Anbau beibringt, mit wissenschaftlich fundierten Lektionen.', fr: 'Un jeu qui t’apprend à cultiver pas à pas, avec des leçons fondées sur la science.' },
  story5Comunidad: { es: 'Una comunidad sin barreras de idioma: escribes en el tuyo y quien habla otro idioma te lee en el suyo, automáticamente.', en: 'A community without language barriers: you write in yours, and someone who speaks another language reads you in theirs, automatically.', de: 'Eine Community ohne Sprachbarrieren: Du schreibst in deiner Sprache, und wer eine andere spricht, liest dich automatisch in seiner.', fr: 'Une communauté sans barrière de langue : tu écris dans la tienne, et la personne qui en parle une autre te lit automatiquement dans la sienne.' },
  story6H: { es: 'Gracias', en: 'Thank you', de: 'Danke', fr: 'Merci' },
  story6P: {
    es: '<p>Tu aporte único de apoyo me ayuda a estudiar, y lo que aprendo lo comparto contigo y con mi comunidad, porque una de mis pasiones es enseñar con ética y responsabilidad.</p><p>Desde el Perú, y ahora con el mundo, quiero compartir lo que aprendo. Lo que estudie lo traeré aquí, en lecciones más sólidas y mejor conocimiento compartido.</p><p>Gracias por ser parte de esto desde el principio.</p>',
    en: '<p>Your one-time support contribution helps me study, and what I learn I share with you and my community, because one of my passions is teaching with ethics and responsibility.</p><p>From Peru, and now with the world, I want to share what I learn. What I study I will bring here, in stronger lessons and better shared knowledge.</p><p>Thank you for being part of this from the beginning.</p>',
    de: '<p>Dein einmaliger Unterstützungsbeitrag hilft mir beim Studieren, und was ich lerne, teile ich mit dir und meiner Gemeinschaft, denn eine meiner Leidenschaften ist es, mit Ethik und Verantwortung zu lehren.</p><p>Von Peru aus, und jetzt mit der Welt, möchte ich teilen, was ich lerne. Was ich studiere, bringe ich hierher: in solidere Lektionen und besser geteiltes Wissen.</p><p>Danke, dass du von Anfang an dabei bist.</p>',
    fr: '<p>Ta contribution unique de soutien m’aide à étudier, et ce que j’apprends, je le partage avec toi et ma communauté, car l’une de mes passions est d’enseigner avec éthique et responsabilité.</p><p>Depuis le Pérou, et maintenant avec le monde, je veux partager ce que j’apprends. Ce que j’étudierai, je le rapporterai ici : des leçons plus solides et un savoir mieux partagé.</p><p>Merci de faire partie de cela dès le début.</p>',
  },
  storyIndependent: { es: 'Mother Verde es un proyecto independiente. No está afiliado ni respaldado por SUNY Morrisville.', en: 'Mother Verde is an independent project. It is not affiliated with or endorsed by SUNY Morrisville.', de: 'Mother Verde ist ein unabhängiges Projekt. Es ist nicht mit der SUNY Morrisville verbunden und wird nicht von ihr unterstützt.', fr: 'Mother Verde est un projet indépendant. Il n’est ni affilié ni approuvé par SUNY Morrisville.' },
  navHistoria: { es: 'Nuestra historia', en: 'Our story', de: 'Unsere Geschichte', fr: 'Notre histoire' },

  // ---------------------------------------------------------- contribution
  dsAvisoCorto: {
    es: 'Tu aporte único de apoyo me ayuda a estudiar. ' + S.es + ' Lo que aprenda lo compartiré contigo y con mi comunidad. A cambio tienes acceso completo a la plataforma. Mother Verde no está afiliado ni respaldado por SUNY Morrisville.',
    en: 'Your one-time support contribution helps me study. ' + S.en + ' What I learn I will share with you and my community. In return you get full access to the platform. Mother Verde is not affiliated with or endorsed by SUNY Morrisville.',
    de: 'Dein einmaliger Unterstützungsbeitrag hilft mir beim Studieren. ' + S.de + ' Was ich lerne, teile ich mit dir und meiner Gemeinschaft. Dafür erhältst du vollen Zugang zur Plattform. Mother Verde ist nicht mit der SUNY Morrisville verbunden und wird nicht von ihr unterstützt.',
    fr: 'Ta contribution unique de soutien m’aide à étudier. ' + S.fr + ' Ce que j’apprends, je le partage avec toi et ma communauté. En échange, tu as un accès complet à la plateforme. Mother Verde n’est ni affilié ni approuvé par SUNY Morrisville.',
  },
  dsPropH3: { es: 'Antes de aportar: para qué es tu aporte', en: 'Before you contribute: what your contribution is for', de: 'Bevor du beiträgst: wofür dein Beitrag gedacht ist', fr: 'Avant de contribuer : à quoi sert ta contribution' },
  // «Antes de aportar» box: ONE voice — Bertha, in the first person, speaking
  // to the reader as tú/you/du/tu (Bertha, 2026-11-04). Point 3 stays neutral.
  dsProp1: {
    es: 'Soy Bertha Limo, fundadora de Mother Verde. ' + H.es + ' ' + S.es,
    en: 'I am Bertha Limo, founder of Mother Verde. ' + H.en + ' ' + S.en,
    de: 'Ich bin Bertha Limo, Gründerin von Mother Verde. ' + H.de + ' ' + S.de,
    fr: 'Je suis Bertha Limo, fondatrice de Mother Verde. ' + H.fr + ' ' + S.fr,
  },
  dsProp2: { es: 'A cambio, te doy acceso completo a la plataforma.', en: 'In return, I give you full access to the platform.', de: 'Dafür gebe ich dir vollen Zugang zur Plattform.', fr: 'En échange, je te donne un accès complet à la plateforme.' },
  dsProp3: { es: 'Es un aporte voluntario y único. No es una donación ni es deducible de impuestos.', en: 'It is a voluntary, one-time contribution. It is not a donation and is not tax-deductible.', de: 'Es ist ein freiwilliger, einmaliger Beitrag. Er ist keine Spende und nicht steuerlich absetzbar.', fr: 'C’est une contribution volontaire et unique. Ce n’est pas un don et elle n’est pas déductible des impôts.' },
  dsProp4: { es: 'Lo que aprendo lo comparto con mi comunidad y con quienes aprenden aquí.', en: 'What I learn I share with my community and with those who learn here.', de: 'Was ich lerne, teile ich mit meiner Gemeinschaft und mit allen, die hier lernen.', fr: 'Ce que j’apprends, je le partage avec ma communauté et avec celles et ceux qui apprennent ici.' },
  dsProp5: { es: 'Mother Verde es mi proyecto independiente: no está afiliado ni respaldado por SUNY Morrisville.', en: 'Mother Verde is my independent project: it is not affiliated with or endorsed by SUNY Morrisville.', de: 'Mother Verde ist mein unabhängiges Projekt: Es ist nicht mit der SUNY Morrisville verbunden und wird nicht von ihr unterstützt.', fr: 'Mother Verde est mon projet indépendant : il n’est ni affilié ni approuvé par SUNY Morrisville.' },
  dsProp6: { es: 'Te explico las condiciones completas en los {terms}.', en: 'I explain the full conditions in the {terms}.', de: 'Alle Bedingungen erkläre ich dir in den {terms}.', fr: 'Je t’explique les conditions complètes dans les {terms}.' },
  dsPropWallet: { es: 'Tu aporte llega a mi billetera personal de cripto, en la red Base.', en: 'Your contribution goes to my personal crypto wallet, on the Base network.', de: 'Dein Beitrag geht an meine persönliche Krypto-Wallet, im Base-Netzwerk.', fr: 'Ta contribution arrive dans mon portefeuille crypto personnel, sur le réseau Base.' },
  dsPropTerms: { es: 'Términos y Condiciones', en: 'Terms and Conditions', de: 'Nutzungsbedingungen', fr: 'Conditions générales' },
  dsPropCheck: { es: 'Entiendo el propósito de mi aporte y estoy de acuerdo.', en: 'I understand the purpose of my contribution and I agree.', de: 'Ich verstehe den Zweck meines Beitrags und bin einverstanden.', fr: 'Je comprends l’objet de ma contribution et je suis d’accord.' },
  dsPropFalta: { es: 'Marca la casilla para continuar.', en: 'Tick the box to continue.', de: 'Kreuze das Kästchen an, um fortzufahren.', fr: 'Coche la case pour continuer.' },

  // ---------------------------------------------------------- other screens
  eduSunyFundadora: { es: 'La fundadora estudia en esta institución.', en: 'The founder studies at this institution.', de: 'Die Gründerin studiert an dieser Hochschule.', fr: 'La fondatrice étudie dans cet établissement.' },
  pvPurposeAdd: { es: 'Si marcas la casilla de propósito antes de aportar, guardamos que la aceptaste y cuándo, junto a tu aviso de aporte.', en: 'If you tick the purpose box before contributing, we store that you accepted it and when, together with your contribution notice.', de: 'Wenn du vor deinem Beitrag das Kästchen zum Zweck ankreuzt, speichern wir, dass du zugestimmt hast und wann, zusammen mit deiner Beitragsmeldung.', fr: 'Si tu coches la case sur l’objet avant de contribuer, nous enregistrons que tu l’as acceptée et quand, avec ton avis de contribution.' },
  authErrAccountExists: { es: 'Ya tienes cuenta: entra o recupera tu contraseña.', en: 'You already have an account: sign in or recover your password.', de: 'Du hast schon ein Konto: Melde dich an oder stelle dein Passwort wieder her.', fr: 'Tu as déjà un compte : connecte-toi ou récupère ton mot de passe.' },
  authExistsLogin: { es: 'Entrar', en: 'Sign in', de: 'Anmelden', fr: 'Se connecter' },
  authExistsForgot: { es: 'Olvidé mi contraseña', en: 'I forgot my password', de: 'Passwort vergessen', fr: 'Mot de passe oublié' },
  acctBtnIn: { es: 'Tu cuenta y tu perfil', en: 'Your account and profile', de: 'Dein Konto und Profil', fr: 'Ton compte et ton profil' },
  acctBtnOut: { es: 'Entrar o crear cuenta', en: 'Sign in or create an account', de: 'Anmelden oder Konto erstellen', fr: 'Se connecter ou créer un compte' },
  acctMenuCuenta: { es: 'Mi cuenta (correo, acceso, código de regalo)', en: 'My account (e-mail, access, gift code)', de: 'Mein Konto (E-Mail, Zugang, Geschenkcode)', fr: 'Mon compte (e-mail, accès, code cadeau)' },
  acctMenuPerfil: { es: 'Mi perfil en la Comunidad', en: 'My Community profile', de: 'Mein Community-Profil', fr: 'Mon profil dans la Communauté' },
  acctMenuSalir: { es: 'Cerrar sesión', en: 'Sign out', de: 'Abmelden', fr: 'Se déconnecter' },
  navCuenta: { es: 'Mi cuenta', en: 'My account', de: 'Mein Konto', fr: 'Mon compte' },
};
