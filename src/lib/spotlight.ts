import { supabase } from './supabaseClient';
import { compressImageToTarget } from './imageCompression';

// Weekend Spotlight: one pupil per class is drawn each weekend, gets two
// tasks, shares an answer (words and/or a photo) and the class rates it.
// Everything goes through database functions (patch_45) -- the tables
// themselves are closed, so a pupil can't read raw ratings or change
// someone else's answer.

export interface SpotlightEntry {
  id: string;
  position: number;
  prompt: string;
  kind: string | null;
  needs_photo: boolean;
  submitted: boolean;
  submitted_at: string | null;
  hidden: boolean;
  response_text: string | null;
  image_path: string | null;
  avg: number | null;
  count: number;
  my_stars: number | null;
}

export interface SpotlightRound {
  id: string;
  class_name: string;
  weekend_date: string;      // the Saturday, YYYY-MM-DD
  term: string;
  session: string;
  submit_until: string;
  rate_until: string;
  phase: 'open' | 'rating' | 'closed';
  student: { id: string; name: string; avatar_url: string | null };
  is_me: boolean;
  entries: SpotlightEntry[];
  raters_total: number;
  raters_missing: number;
  pending_raters: string[];  // names; only filled in for the class teacher / admins
}

export interface SpotlightCurrent {
  round: SpotlightRound | null;
  is_weekend: boolean;
  this_weekend: string;
  tasks_available: number;
  is_staff: boolean;
}

export interface LeaderRow {
  id: string;
  name: string;
  avatar_url: string | null;
  streak: number;
  best_streak: number;
  spotlighted: number;
  avg_received: number | null;
  ratings_given: number;
  is_me: boolean;
}

export interface MemoryLaneData {
  terms: { term: string; session: string; rounds: number; first: string; last: string }[];
  term: string | null;
  session: string;
  rounds: SpotlightRound[];
}

export type TaskKind = 'show_and_tell' | 'fun' | 'learn' | 'reflect' | 'creative';
export type TaskBand = 'early' | 'lower' | 'upper';

export interface SpotlightTask {
  id: string;
  prompt: string;
  kind: TaskKind;
  bands: TaskBand[];
  needs_photo: boolean;
  active: boolean;
}

export const KIND_LABEL: Record<string, string> = {
  show_and_tell: 'Show & Tell',
  fun: 'Just for fun',
  learn: 'Learn something',
  reflect: 'My week',
  creative: 'Be creative',
};
export const KIND_EMOJI: Record<string, string> = {
  show_and_tell: '📸',
  fun: '🎉',
  learn: '🔬',
  reflect: '💬',
  creative: '🎨',
};
export const BAND_LABEL: Record<TaskBand, string> = {
  early: 'Daycare – Pre-Grade',
  lower: 'Grade 1–2',
  upper: 'Grade 3–5',
};

// A database error becomes something a child (or a parent) can read.
function friendly(message: string): string {
  const blocked = message.match(/BLOCKED_CONTENT:(.+)/);
  if (blocked) {
    const term = blocked[1].trim();
    return /^[ -~]+$/.test(term)
      ? `The word "${term}" isn't allowed in our school chat. Please use kind words.`
      : "That emoji isn't allowed in our school chat. Please choose a kind one.";
  }
  return message;
}

export async function getCurrent(className: string, force = false): Promise<{ data?: SpotlightCurrent; error?: string }> {
  const { data, error } = await supabase.rpc('spotlight_current', { p_class: className, p_force: force });
  if (error) return { error: friendly(error.message) };
  return { data: data as SpotlightCurrent };
}

export async function getLeaderboard(className: string): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('spotlight_leaderboard', { p_class: className });
  if (error) { console.error('spotlight_leaderboard failed', error); return []; }
  return (data ?? []) as LeaderRow[];
}

export async function getMemoryLane(className: string, term?: string, session?: string): Promise<{ data?: MemoryLaneData; error?: string }> {
  const { data, error } = await supabase.rpc('spotlight_memory_lane', {
    p_class: className, p_term: term ?? null, p_session: session ?? null,
  });
  if (error) return { error: friendly(error.message) };
  return { data: data as MemoryLaneData };
}

export async function submitEntry(entryId: string, text: string, imagePath?: string | null): Promise<string | null> {
  const { error } = await supabase.rpc('spotlight_submit', { p_entry: entryId, p_text: text, p_image_path: imagePath ?? null });
  return error ? friendly(error.message) : null;
}

export async function rateEntry(entryId: string, stars: number): Promise<string | null> {
  const { error } = await supabase.rpc('spotlight_rate', { p_entry: entryId, p_stars: stars });
  return error ? friendly(error.message) : null;
}

export async function hideEntry(entryId: string, hide: boolean): Promise<string | null> {
  const { error } = await supabase.rpc('spotlight_hide_entry', { p_entry: entryId, p_hide: hide });
  return error ? friendly(error.message) : null;
}

export async function redrawRound(roundId: string): Promise<string | null> {
  const { error } = await supabase.rpc('spotlight_redraw', { p_round: roundId });
  return error ? friendly(error.message) : null;
}

// Photos are shrunk on the phone first (a camera photo can be 5 MB+).
export async function uploadSpotlightPhoto(roundId: string, entryId: string, file: File): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Please choose a photo.' };
  let upload: File;
  try {
    upload = await compressImageToTarget(file, 900 * 1024, 1400);
  } catch {
    return { error: "We couldn't read that photo. Please try another one." };
  }
  const path = `${roundId}/${entryId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('spotlight-photos').upload(path, upload, { contentType: 'image/jpeg' });
  if (error) return { error: error.message };
  return { path };
}

// Signed links last an hour; remember them so scrolling back and forth
// (and the slideshow) doesn't ask for the same picture twice.
const urlCache = new Map<string, { url: string; at: number }>();
export async function getPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const need: string[] = [];
  for (const p of new Set(paths.filter(Boolean))) {
    const hit = urlCache.get(p);
    if (hit && now - hit.at < 45 * 60_000) out[p] = hit.url;
    else need.push(p);
  }
  if (need.length > 0) {
    const { data, error } = await supabase.storage.from('spotlight-photos').createSignedUrls(need, 3600);
    if (error) console.error('spotlight photo links failed', error);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) {
        urlCache.set(row.path, { url: row.signedUrl, at: now });
        out[row.path] = row.signedUrl;
      }
    }
  }
  return out;
}

// ---- task bank (teachers and admins) ----------------------------------
export async function listTasks(): Promise<SpotlightTask[]> {
  const { data, error } = await supabase.from('spotlight_tasks').select('id, prompt, kind, bands, needs_photo, active').order('created_at', { ascending: false });
  if (error) { console.error('listTasks failed', error); return []; }
  return (data ?? []) as SpotlightTask[];
}

export async function addTask(input: { prompt: string; kind: TaskKind; bands: TaskBand[]; needs_photo: boolean }, userId: string): Promise<string | null> {
  const { error } = await supabase.from('spotlight_tasks').insert({ ...input, prompt: input.prompt.trim(), created_by: userId });
  if (!error) return null;
  return error.code === '23505' ? 'That task is already in the list.' : error.message;
}

export async function setTaskActive(id: string, active: boolean): Promise<string | null> {
  const { error } = await supabase.from('spotlight_tasks').update({ active }).eq('id', id);
  return error?.message ?? null;
}

export async function deleteTask(id: string): Promise<string | null> {
  const { error } = await supabase.from('spotlight_tasks').delete().eq('id', id);
  return error?.message ?? null;
}

// ---- small helpers ------------------------------------------------------
const DAY_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

// "Sat 9 – Sun 10 Nov" for a weekend that starts on the given Saturday.
export function weekendLabel(saturday: string): string {
  const sat = new Date(saturday + 'T12:00:00');
  const sun = new Date(sat.getTime() + 24 * 3600 * 1000);
  const sameMonth = sat.getMonth() === sun.getMonth();
  const a = sat.toLocaleDateString('en-GB', sameMonth ? { day: 'numeric' } : DAY_FMT);
  const b = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${a} – ${b}`;
}

export function monthLabel(saturday: string): string {
  return new Date(saturday + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function monthKey(saturday: string): string {
  return saturday.slice(0, 7);
}

// Hours / minutes left until a moment, as a friendly phrase.
export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ${hours}h left`;
  if (hours >= 1) return `${hours}h ${mins % 60}m left`;
  return `${mins}m left`;
}

// Small badges that show on the class board.
export function badgesFor(row: LeaderRow, all: LeaderRow[]): { emoji: string; label: string }[] {
  const out: { emoji: string; label: string }[] = [];
  // (the streak itself is shown beside the name, so it is not repeated here)
  if (row.spotlighted > 0) out.push({ emoji: '⭐', label: `Spotlight ×${row.spotlighted}` });
  const rated = all.filter((r) => r.avg_received != null);
  const top = rated.length > 0 ? Math.max(...rated.map((r) => r.avg_received as number)) : null;
  if (top != null && row.avg_received === top && row.avg_received >= 3.5) out.push({ emoji: '🏆', label: 'Top rated' });
  if (row.ratings_given >= 6) out.push({ emoji: '💬', label: 'Super reviewer' });
  if (row.best_streak >= 5) out.push({ emoji: '🚀', label: 'Never misses' });
  return out.slice(0, 3);
}
