import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Plus, Trash2, Loader2, AlertCircle, CheckCircle2,
  Users, Upload, X, Search, ChevronDown, UserPlus,
} from 'lucide-react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthorizedStudent {
  email:        string;
  addedBy:      string;
  addedByEmail: string;
  role:         'student';
  createdAt:    Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (e: string) => EMAIL_RE.test(e.trim().toLowerCase());
const parseEmails  = (raw: string): string[] =>
  raw.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentManager() {
  const { user } = useAuth();

  // ── List ──
  const [students,    setStudents] = useState<AuthorizedStudent[]>([]);
  const [loadingList, setLoading]  = useState(true);
  const [search,      setSearch]   = useState('');

  // ── Add single ──
  const [singleEmail, setSingle]    = useState('');
  const [singleError, setSingleErr] = useState('');
  const [addingOne,   setAddingOne] = useState(false);

  // ── Bulk ──
  const [showBulk,   setShowBulk]   = useState(false);
  const [bulkRaw,    setBulkRaw]    = useState('');
  const [bulkResult, setBulkResult] = useState<{ ok: string[]; skipped: string[]; dup: string[] } | null>(null);
  const [addingBulk, setAddingBulk] = useState(false);

  // ── Delete ──
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Realtime listener scoped to this teacher ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'authorizedUsers'),
      where('addedBy', '==', user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: AuthorizedStudent[] = snap.docs.map((d) => ({
        email:        d.id,
        addedBy:      d.data().addedBy,
        addedByEmail: d.data().addedByEmail,
        role:         'student',
        createdAt:    d.data().createdAt?.toDate?.() ?? null,
      }));
      rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      setStudents(rows);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // ── Add single ────────────────────────────────────────────────────────────
  const handleAddOne = async () => {
    setSingleErr('');
    const email = singleEmail.trim().toLowerCase();
    if (!email)               return setSingleErr('Please enter an email address.');
    if (!isValidEmail(email)) return setSingleErr('Please enter a valid email address.');
    if (students.some((s) => s.email === email))
      return setSingleErr('This email is already in your list.');

    setAddingOne(true);
    try {
      await setDoc(doc(db, 'authorizedUsers', email), {
        addedBy:      user!.uid,
        addedByEmail: user!.email ?? '',
        role:         'student',
        createdAt:    serverTimestamp(),
      });
      setSingle('');
    } catch {
      setSingleErr('Failed to add student. Please try again.');
    } finally {
      setAddingOne(false);
    }
  };

  // ── Bulk import ───────────────────────────────────────────────────────────
  const handleBulk = async () => {
    setBulkResult(null);
    const all     = parseEmails(bulkRaw);
    const valid   = all.filter(isValidEmail);
    const invalid = all.filter((e) => !isValidEmail(e));
    const newOnes = valid.filter((e) => !students.some((s) => s.email === e));
    const dups    = valid.filter((e) =>  students.some((s) => s.email === e));

    if (!newOnes.length) {
      setBulkResult({ ok: [], skipped: invalid, dup: dups });
      return;
    }

    setAddingBulk(true);
    try {
      await Promise.all(
        newOnes.map((email) =>
          setDoc(doc(db, 'authorizedUsers', email), {
            addedBy:      user!.uid,
            addedByEmail: user!.email ?? '',
            role:         'student',
            createdAt:    serverTimestamp(),
          }),
        ),
      );
      setBulkResult({ ok: newOnes, skipped: invalid, dup: dups });
      setBulkRaw('');
    } catch {
      setBulkResult({ ok: [], skipped: [...invalid, ...newOnes], dup: dups });
    } finally {
      setAddingBulk(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (email: string) => {
    setDeletingId(email);
    try {
      await deleteDoc(doc(db, 'authorizedUsers', email));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = students.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase()),
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-xl font-semibold text-surface-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Student Manager
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Authorize student emails so they can register on the platform.
          </p>
        </div>

        {/* Count badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)]
                        bg-primary-50 border border-primary-100">
          <Users size={14} className="text-primary-600" />
          <span className="text-sm font-semibold text-primary-700">{students.length}</span>
          <span className="text-xs text-primary-500">
            student{students.length !== 1 ? 's' : ''} authorized
          </span>
        </div>
      </div>

      {/* ── Add card ── */}
      <div className="bg-white border border-surface-100 rounded-[var(--radius-lg)] p-5 space-y-4">

        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Add students
          </h2>
          <button
            onClick={() => { setShowBulk((v) => !v); setBulkResult(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border
                        text-xs font-medium transition-all duration-150 cursor-pointer
                        ${showBulk
                          ? 'border-primary-300 bg-primary-50 text-primary-700'
                          : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'}`}
          >
            <Upload size={12} />
            Bulk import
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${showBulk ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Single add row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
            />
            <input
              type="email"
              value={singleEmail}
              onChange={(e) => { setSingle(e.target.value); setSingleErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOne()}
              placeholder="student@example.com"
              className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-[var(--radius-md)] border bg-white
                          placeholder:text-surface-300 text-surface-900
                          focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                          transition-all duration-150
                          ${singleError ? 'border-error-400' : 'border-surface-200 hover:border-surface-300'}`}
            />
          </div>
          <button
            onClick={handleAddOne}
            disabled={addingOne}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--radius-md)]
                       bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium
                       disabled:opacity-60 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
          >
            {addingOne ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>

        {/* Inline error */}
        <AnimatePresence>
          {singleError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 text-xs text-error-600"
            >
              <AlertCircle size={13} />
              {singleError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Bulk panel */}
        <AnimatePresence>
          {showBulk && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border border-surface-200 rounded-[var(--radius-md)] p-4 space-y-3 bg-surface-50">
                <p className="text-xs text-surface-500">
                  Paste emails separated by commas, semicolons, or new lines.
                </p>
                <textarea
                  ref={textareaRef}
                  value={bulkRaw}
                  onChange={(e) => { setBulkRaw(e.target.value); setBulkResult(null); }}
                  rows={4}
                  placeholder={'alice@school.com\nbob@school.com, carol@school.com'}
                  className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-md)] border border-surface-200
                             bg-white placeholder:text-surface-300 text-surface-900 resize-none
                             focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                             transition-all duration-150"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={handleBulk}
                    disabled={addingBulk || !bulkRaw.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)]
                               bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium
                               disabled:opacity-60 transition-all duration-150 cursor-pointer shadow-sm"
                  >
                    {addingBulk
                      ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                      : <><Upload size={14} /> Import all</>}
                  </button>

                  {bulkResult && (
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      {bulkResult.ok.length > 0 && (
                        <span className="flex items-center gap-1 text-success-600">
                          <CheckCircle2 size={13} /> {bulkResult.ok.length} added
                        </span>
                      )}
                      {bulkResult.dup.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertCircle size={13} /> {bulkResult.dup.length} already existed
                        </span>
                      )}
                      {bulkResult.skipped.length > 0 && (
                        <span className="flex items-center gap-1 text-error-600">
                          <X size={13} /> {bulkResult.skipped.length} invalid
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Student list card ── */}
      <div className="bg-white border border-surface-100 rounded-[var(--radius-lg)] overflow-hidden">

        {/* List header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-100">
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
            Authorized students
          </h2>
          {students.length > 0 && (
            <div className="relative w-48 sm:w-64">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-[var(--radius-md)] border border-surface-200
                           bg-white placeholder:text-surface-300 text-surface-900
                           focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                           transition-all duration-150"
              />
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingList ? (
          <div className="flex items-center justify-center py-16 text-surface-400">
            <Loader2 size={22} className="animate-spin" />
          </div>

        /* Empty state */
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center">
              <UserPlus size={20} className="text-surface-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-surface-600">
                {search ? 'No students match your search' : 'No students authorized yet'}
              </p>
              <p className="text-xs text-surface-400 mt-1">
                {search
                  ? 'Try a different search term.'
                  : 'Add a student email above to get started.'}
              </p>
            </div>
          </div>

        /* List rows */
        ) : (
          <div className="divide-y divide-surface-50">
            <AnimatePresence initial={false}>
              {filtered.map((s) => (
                <motion.div
                  key={s.email}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.16 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors">
                    {/* Avatar initial */}
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary-600">
                        {s.email[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Email + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{s.email}</p>
                      {s.createdAt && (
                        <p className="text-[11px] text-surface-400 mt-0.5">
                          Added{' '}
                          {s.createdAt.toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>

                    {/* Badge */}
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5
                                     rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      student
                    </span>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(s.email)}
                      disabled={deletingId === s.email}
                      aria-label={`Remove ${s.email}`}
                      className="shrink-0 p-1.5 rounded-[var(--radius-md)] text-surface-400
                                 hover:text-error-500 hover:bg-error-50 transition-all duration-150
                                 disabled:opacity-40 cursor-pointer"
                    >
                      {deletingId === s.email
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}