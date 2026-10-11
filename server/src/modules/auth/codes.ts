type CodeEntry = { code: string; expiresAt: number };

const store = new Map<string, CodeEntry>();
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateCode(): string {
  return String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
}

export function storeCode(phone: string, code: string): void {
  store.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS });
}

export function verifyCode(phone: string, code: string): boolean {
  const entry = store.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return false;
  }
  if (entry.code !== code) return false;
  store.delete(phone);
  return true;
}
