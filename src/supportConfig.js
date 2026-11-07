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
  MAX_FLOWERS: 20, // 200 USDC; the database accepts 1–20 (support_claims)
  // Hours shown to the person ONLY while a claim waits for the NORMAL check
  // (status 'submitted'), always worded "hasta {h} horas" (approved text,
  // 15-10-2026). A claim in MANUAL review (late payment, conflict, different
  // amount…) never shows a number of hours: only "lo revisaremos manualmente y
  // te escribiremos". This is not a timer: nothing in the code enforces it.
  NORMAL_REVIEW_HOURS: 24,
};

// Who receives the contribution and what it is for: src/purposeTexts.js
// (dsProp1-6 and dsPropWallet, Bertha's first-person box, 2026-11-04).

// Basic sanity check used by the page before showing anything payable.
export function supportAddressIsValid(addr = SUPPORT.ADDRESS) {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}
