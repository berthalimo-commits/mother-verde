// ===========================================================================
// THE single place for the one-time support contribution's payment data and
// for the "who receives it / what it is for" text. Nothing else in the app
// may hard-code an address, network or price.
//
// If ADDRESS is empty or malformed, the Desbloquear page shows "Próximamente"
// and no address, QR or form (see src/desbloquear.js). Never put an example
// or made-up address here.
//
// Before changing ADDRESS: confirm it in the owner's personal crypto wallet, then
// re-check length (42), the first 5 and the last 4 characters.
// ===========================================================================

export const SUPPORT = {
  // Owner's personal-wallet USDC address on Base (added 2026-10-10, dev only
  // until the owner confirms a $5 test payment arrived).
  ADDRESS: '0x63bbacca9add146c93d5e3e4f77eb053809792d0',
  NETWORK: 'Base',
  CURRENCY: 'USDC',
  // One flower = this many USDC. One flower unlocks full access; more is extra, voluntary support.
  FLOWER_USDC: 10,
  MAX_FLOWERS: 10,
  // Promise shown on the page for the manual verification.
  VERIFY_MAX_HOURS: 48,
};

// Who receives the contribution and what it is for. Final Spanish text
// given by the owner on 2026-10-10 (verbatim); EN/DE/FR translate it.
// No doctor/clinic names, no links, no laws, nothing about growing,
// products or prices (owner's rules). Pending accountant/lawyer review —
// edit only here.
export const SUPPORT_RECIPIENT_TEXT = {
  es: "Tu aporte llega a la billetera personal de cripto de Bertha Limo, fundadora de Mother Verde, en la red Base. Lo recaudado se destinará a crear Canna Wasi, una asociación de pacientes de cannabis medicinal en Urubamba, Cusco (Valle Sagrado, Perú), que Bertha funda junto a su hermano César. Wasi significa «casa» en quechua: la casa donde la planta vuelve a tener un hogar y donde cada paciente encuentra el suyo. Canna Wasi se está constituyendo como asociación civil sin fines de lucro: el trámite notarial ya está en marcha, pero el camino es largo. Las siguientes etapas (licencias, infraestructura y otros trámites) necesitan recursos, y tu aporte ayuda a cubrirlas. Ya contamos con un médico especialista en cannabis medicinal para acompañar a los futuros asociados aquí en Peru. Gracias por tu apoyo",
  en: "Your contribution goes to the personal crypto wallet of Bertha Limo, founder of Mother Verde, on the Base network. The funds raised will go toward creating Canna Wasi, an association of medical cannabis patients in Urubamba, Cusco (Sacred Valley, Peru), which Bertha is founding together with her brother César. Wasi means “house” in Quechua: the house where the plant has a home again and where every patient finds theirs. Canna Wasi is being established as a non-profit civil association: the notarial process is already underway, but the road is long. The next stages (licenses, infrastructure and other procedures) need resources, and your contribution helps cover them. We already have a physician specialized in medical cannabis to accompany future members here in Peru. Thank you for your support",
  de: "Dein Beitrag geht an die persönliche Krypto-Wallet von Bertha Limo, Gründerin von Mother Verde, im Base-Netzwerk. Die gesammelten Mittel sind für die Gründung von Canna Wasi bestimmt, einer Vereinigung von Patientinnen und Patienten mit medizinischem Cannabis in Urubamba, Cusco (Heiliges Tal, Peru), die Bertha zusammen mit ihrem Bruder César gründet. Wasi bedeutet auf Quechua „Haus“: das Haus, in dem die Pflanze wieder ein Zuhause hat und in dem jede Patientin und jeder Patient das eigene findet. Canna Wasi wird gerade als zivile Vereinigung ohne Gewinnzweck gegründet: Das notarielle Verfahren läuft bereits, aber der Weg ist lang. Die nächsten Schritte (Lizenzen, Infrastruktur und weitere Formalitäten) brauchen Mittel, und dein Beitrag hilft, sie zu decken. Wir haben bereits einen auf medizinisches Cannabis spezialisierten Arzt, der die künftigen Mitglieder hier in Peru begleitet. Danke für deine Unterstützung",
  fr: "Ta contribution arrive dans le portefeuille crypto personnel de Bertha Limo, fondatrice de Mother Verde, sur le réseau Base. Les fonds collectés serviront à créer Canna Wasi, une association de patients de cannabis médical à Urubamba, Cusco (Vallée sacrée, Pérou), que Bertha fonde avec son frère César. Wasi signifie « maison » en quechua : la maison où la plante retrouve un foyer et où chaque patient trouve le sien. Canna Wasi est en cours de constitution en association civile à but non lucratif : la démarche notariale est déjà en cours, mais le chemin est long. Les prochaines étapes (licences, infrastructure et autres démarches) ont besoin de ressources, et ta contribution aide à les couvrir. Nous avons déjà un médecin spécialiste du cannabis médical pour accompagner les futurs membres ici au Pérou. Merci pour ton soutien",
};

// Basic sanity check used by the page before showing anything payable.
export function supportAddressIsValid(addr = SUPPORT.ADDRESS) {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}
