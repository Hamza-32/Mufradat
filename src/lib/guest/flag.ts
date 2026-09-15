const FLAG = 'mufradat.guest.hasData';

/**
 * A one-byte answer to "is there guest progress on this device?", kept in
 * localStorage so the shell can decide without loading IndexedDB.
 *
 * Without it, every page on every device would pull Dexie into the first load
 * just to discover there is nothing to migrate. With it, the migration module
 * is an async chunk that most sessions never fetch.
 */
export function markGuestData(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FLAG, '1');
  } catch {
    // Private mode with storage denied: the migration still works, it is only
    // the shortcut that is unavailable.
  }
}

export function hasGuestDataFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

export function clearGuestDataFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FLAG);
  } catch {
    /* nothing to clear */
  }
}
