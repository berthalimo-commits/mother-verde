// ===========================================================================
// THE single place for the one-time support contribution's payment data and
// for the "who receives it / what it is for" text. Nothing else in the app
// may hard-code an address, network or price.
//
// If ADDRESS is empty or malformed, the Desbloquear page shows "Próximamente"
// and no address, QR or form (see src/desbloquear.js). Never put an example
// or made-up address here.
//
// Before changing ADDRESS: confirm it in the owner's Coinbase account, then
// re-check length (42), the first 5 and the last 4 characters.
// ===========================================================================

export const SUPPORT = {
  // Owner's Coinbase USDC deposit address on Base (added 2026-10-10, dev only
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

// Who receives the contribution and what it is for. Text approved by the
// owner on 2026-10-10 (Spanish); EN/DE/FR are translations of it. Pending
// review by an accountant / lawyer — edit only here.
export const SUPPORT_RECIPIENT_TEXT = {
  es: 'Tu aporte llega a una cuenta personal de Bertha Limo, fundadora de Mother Verde, en Coinbase. Lo recaudado se destinará a la creación de Canna Wasi, una asociación de pacientes de cannabis medicinal que se está formando en el Valle Sagrado (Perú). Canna Wasi aún no está constituida.',
  en: 'Your contribution goes to a personal Coinbase account of Bertha Limo, founder of Mother Verde. The funds raised will go toward creating Canna Wasi, an association of medical cannabis patients being formed in the Sacred Valley (Peru). Canna Wasi is not yet legally established.',
  de: 'Dein Beitrag geht auf ein persönliches Coinbase-Konto von Bertha Limo, Gründerin von Mother Verde. Die gesammelten Mittel sind für die Gründung von Canna Wasi bestimmt, einer Vereinigung von Patientinnen und Patienten mit medizinischem Cannabis, die im Heiligen Tal (Peru) entsteht. Canna Wasi ist noch nicht offiziell gegründet.',
  fr: 'Ta contribution arrive sur un compte Coinbase personnel de Bertha Limo, fondatrice de Mother Verde. Les fonds collectés serviront à créer Canna Wasi, une association de patients de cannabis médical en cours de formation dans la Vallée sacrée (Pérou). Canna Wasi n’est pas encore constituée.',
};

// Basic sanity check used by the page before showing anything payable.
export function supportAddressIsValid(addr = SUPPORT.ADDRESS) {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}
