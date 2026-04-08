import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import {
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

export interface UserProfile {
  uid:             string;
  customId:        string;
  email:           string;
  firstName:       string;
  lastName:        string;
  role:            'student' | 'teacher';
  profileComplete: boolean;
  createdAt?:      Date | null;
}

interface AuthContextValue {
  user:           User | null;
  profile:        UserProfile | null;
  loading:        boolean;
  profileLoading: boolean;
  isTeacher:      boolean;
  isStudent:      boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, loading: true,
  profileLoading: false, isTeacher: false, isStudent: false,
});

const RETRY_DELAY_MS = 1_000;
const MAX_RETRIES    = 5;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,           setUser]           = useState<User | null>(null);
  const [profile,        setProfile]        = useState<UserProfile | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setProfileLoading(false);
        setLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        // ── Step 1: resolve customId, retrying until the cloud function writes it ──
        let lookupSnap = await getDoc(doc(db, 'userLookup', firebaseUser.uid));

        if (!lookupSnap.exists()) {
          for (let i = 1; i <= MAX_RETRIES; i++) {
            await sleep(RETRY_DELAY_MS);
            lookupSnap = await getDoc(doc(db, 'userLookup', firebaseUser.uid));
            if (lookupSnap.exists()) break;
            if (i === MAX_RETRIES) {
              console.warn('[AuthContext] userLookup not found after retries:', firebaseUser.uid);
              setProfile(null);
              setProfileLoading(false);
              setLoading(false);
              return;
            }
          }
        }

        const { customId } = lookupSnap.data() as { customId: string };
        const userDocRef   = doc(db, 'users', customId);

        // ── Step 2: wait for the users doc to exist before subscribing ──────────
        // The cloud function writes userLookup and users in the same batch, but
        // Firestore propagation can still race. A brief retry avoids a 403 on
        // the onSnapshot call when the doc doesn't exist yet.
        let userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          for (let i = 1; i <= MAX_RETRIES; i++) {
            await sleep(RETRY_DELAY_MS);
            userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) break;
            if (i === MAX_RETRIES) {
              console.warn('[AuthContext] users doc not found after retries:', customId);
              setProfile(null);
              setProfileLoading(false);
              setLoading(false);
              return;
            }
          }
        }

        // ── Step 3: subscribe live so profile updates (e.g. after completeProfile) ──
        // reflect instantly without a page refresh.
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snap) => {
            if (!snap.exists()) {
              setProfile(null);
              setProfileLoading(false);
              setLoading(false);
              return;
            }

            const d = snap.data();
            setProfile({
              uid:             firebaseUser.uid,
              customId,
              email:           d.email          ?? firebaseUser.email ?? '',
              firstName:       d.firstName       ?? '',
              lastName:        d.lastName        ?? '',
              role:            d.role            ?? 'student',
              profileComplete: d.profileComplete ?? false,
              createdAt:       d.createdAt?.toDate?.() ?? null,
            });
            setProfileLoading(false);
            setLoading(false);
          },
          (err) => {
            console.error('[AuthContext] profile snapshot error:', err);
            setProfile(null);
            setProfileLoading(false);
            setLoading(false);
          },
        );
      } catch (err) {
        console.error('[AuthContext] Failed to load user profile:', err);
        setProfile(null);
        setProfileLoading(false);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, profile, loading, profileLoading,
    isTeacher: profile?.role === 'teacher',
    isStudent: profile?.role === 'student',
  }), [user, profile, loading, profileLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth()    { return useContext(AuthContext); }
export function useProfile() { return useContext(AuthContext).profile; }

export function useAuthLoading() {
  const { loading, profileLoading } = useContext(AuthContext);
  return loading || profileLoading;
}

export function useRequiredAuth() {
  const { user, profile } = useContext(AuthContext);
  if (import.meta.env.DEV && (!user || !profile)) {
    throw new Error('[useRequiredAuth] No signed-in user — wrap in a protected route.');
  }
  return { user: user!, profile: profile! };
}