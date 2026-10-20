/**
 * Makes a random unique ID like "3f9a1c0b7e2d4a5f6b8c9d0e".
 * (We don't use crypto.randomUUID() because it only works on https,
 * and we also want to test the app on the phone over plain http.)
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
