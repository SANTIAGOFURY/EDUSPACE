import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const RETRY_DELAY_MS = 1_000;
const MAX_RETRIES = 5;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads userLookup/{uid} with retries because the Cloud Function may still
 * be writing the doc right after signup/sign-in.
 */
export async function resolveCustomId(uid: string): Promise<string | null> {
  let snap = await getDoc(doc(db, 'userLookup', uid));

  if (!snap.exists()) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await sleep(RETRY_DELAY_MS);
      snap = await getDoc(doc(db, 'userLookup', uid));

      if (snap.exists()) break;
      if (attempt === MAX_RETRIES) return null;
    }
  }

  return (snap.data() as { customId?: string })?.customId ?? null;
}

export async function getUserProfileByCustomId(customId: string) {
  return getDoc(doc(db, 'users', customId));
}