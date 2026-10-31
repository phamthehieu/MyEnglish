import type { GrammarBookLesson, GrammarBookPracticeGroup } from "@/types/grammarBook";
import { getAllBookLessons, getAllPracticeGroups, getKnownLessonIds } from "./grammarBook";
import { getLessonProgress, isLessonIntroduced } from "./grammarService";
import { persistKeyNow } from "./storageBackup";

/**
 * The grammar path: the imported book's lessons in book order, minus the lessons the learner took off it
 * (single lessons or whole chapters). What is kept is the list of lessons left out, so a chapter imported
 * later joins the path by itself. New lessons come in book order, one per day; a lesson already met is
 * reviewed on its FSRS schedule.
 */

/** Old format: the lessons picked, a snapshot of the book at the time (migrated to the excluded list) */
export const GRAMMAR_SELECTION_KEY = "myenglish_grammar_selection_v1";
/** The lessons taken off the path */
export const GRAMMAR_EXCLUDED_KEY = "myenglish_grammar_path_excluded_v1";
const INTRO_DATES_KEY = "myenglish_grammar_intro_dates_v1";

/** Default initial tense: Present Simple (Thì hiện tại đơn) for beginners / foundation */
export const DEFAULT_INITIAL_TENSE_IDS = ["ch01-l01"] as const;

/** Marker recorded when the user confirms their starting tense choice */
export const GRAMMAR_TENSES_INIT_KEY = "myenglish_grammar_tenses_init_v1";

export function hasChosenInitialTenses(): boolean {
  try {
    return localStorage.getItem(GRAMMAR_TENSES_INIT_KEY) === "1";
  } catch {
    return true;
  }
}

export function markInitialTensesDone(): void {
  try {
    localStorage.setItem(GRAMMAR_TENSES_INIT_KEY, "1");
    persistKeyNow(GRAMMAR_TENSES_INIT_KEY);
  } catch {}
}

/** The lessons chosen at the first run: learned first, then the rest of the book in its order */
export const GRAMMAR_START_KEY = "myenglish_grammar_start_v1";
/** Set once the path cut down by an older first run was opened to the whole book again */
const PATH_REOPENED_KEY = "myenglish_grammar_path_reopened_v1";
/** The tenses offered at the first run (TenseSelectionPicker): the book's first chapter */
const FIRST_RUN_TENSE = /^ch01-l\d\d$/;

/**
 * The first run's choice of tenses is where the path starts, not the whole path: nothing is taken off the book.
 * (It used to keep only the chosen tenses, so a beginner who kept the default met one lesson and then no more.)
 */
export function saveInitialTenses(lessonIds: string[]): void {
  try {
    writeIdList(GRAMMAR_START_KEY, lessonIds);
    localStorage.removeItem(GRAMMAR_EXCLUDED_KEY);
    localStorage.removeItem(GRAMMAR_SELECTION_KEY);
    localStorage.setItem(PATH_REOPENED_KEY, "1");
  } catch {}
  markInitialTensesDone();
  window.dispatchEvent(new CustomEvent("myenglish-grammar-updated"));
}

/**
 * Once: a path that holds only first-run tenses was made by the older first run, which took every other lesson
 * off the book. It is opened to the whole book again, those tenses first.
 */
function reopenFirstRunPath(known: string[]): void {
  try {
    if (localStorage.getItem(PATH_REOPENED_KEY) === "1" || !hasChosenInitialTenses()) return;
    localStorage.setItem(PATH_REOPENED_KEY, "1");
    const excluded = readIdList(GRAMMAR_EXCLUDED_KEY);
    if (!excluded || excluded.length === 0) return;
    const kept = known.filter((id) => !excluded.includes(id));
    if (kept.length === 0 || !kept.every((id) => FIRST_RUN_TENSE.test(id))) return;
    writeIdList(GRAMMAR_START_KEY, kept);
    localStorage.removeItem(GRAMMAR_EXCLUDED_KEY);
  } catch {}
}

function readIdList(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function writeIdList(key: string, ids: string[]): void {
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
  persistKeyNow(key);
}

/**
 * The old picked list becomes an excluded list once the book is known: excluded = lessons of the book − picked
 * (picks that no longer matched any lesson meant the whole book, so nothing is excluded).
 */
function migrateSelection(known: string[]): void {
  if (known.length === 0 || readIdList(GRAMMAR_EXCLUDED_KEY) !== null) return;
  const picked = readIdList(GRAMMAR_SELECTION_KEY);
  if (picked === null) return;
  const pickedSet = new Set(picked);
  const anyKnown = known.some((id) => pickedSet.has(id));
  try {
    writeIdList(GRAMMAR_EXCLUDED_KEY, anyKnown ? known.filter((id) => !pickedSet.has(id)) : []);
    localStorage.removeItem(GRAMMAR_SELECTION_KEY);
  } catch {}
}

/** The lessons taken off the path (empty = the whole book) */
export function getExcludedLessonIds(known: string[] = getKnownLessonIds()): string[] {
  migrateSelection(known);
  if (known.length > 0) reopenFirstRunPath(known);
  return readIdList(GRAMMAR_EXCLUDED_KEY) ?? [];
}

/**
 * The lessons picked in the old format, before the book was loaded and the list migrated (empty otherwise).
 * Kept for callers of the old name.
 */
export function getSelectedLessonIds(): string[] {
  return readIdList(GRAMMAR_SELECTION_KEY) ?? [];
}

export function hasChosenGrammarLessons(): boolean {
  return hasChosenInitialTenses() || getSelectedLessonIds().length > 0 || getExcludedLessonIds().length > 0;
}

/**
 * The lessons on the learner's path, in book order: the book's lessons minus those taken off it, or every
 * lesson of the book when that would leave nothing. Synchronous: uses the lesson list cached by the last
 * book load.
 */
export function getEffectiveLessonIds(known: string[] = getKnownLessonIds()): string[] {
  // Book not loaded yet: picks in the old format as saved (the excluded list needs the book)
  if (known.length === 0) return getSelectedLessonIds();
  const excluded = new Set(getExcludedLessonIds(known));
  const chosen = known.filter((id) => !excluded.has(id));
  return chosen.length > 0 ? chosen : [...known];
}

/** Save the path as the lessons to keep: stored as the lessons of the book left out */
export function saveSelectedLessonIds(lessonIds: string[]): void {
  try {
    const unique = Array.from(new Set(lessonIds));
    const known = getKnownLessonIds();
    if (known.length > 0) {
      const keep = new Set(unique);
      writeIdList(GRAMMAR_EXCLUDED_KEY, known.filter((id) => !keep.has(id)));
      localStorage.removeItem(GRAMMAR_SELECTION_KEY);
    } else {
      // Book not loaded: keep the picks, migrated once the lessons are known
      writeIdList(GRAMMAR_SELECTION_KEY, unique);
      localStorage.removeItem(GRAMMAR_EXCLUDED_KEY);
    }
    // The learner's own choice of lessons: never "repaired" as an older first run's
    localStorage.setItem(PATH_REOPENED_KEY, "1");
    markInitialTensesDone();
    window.dispatchEvent(new CustomEvent("myenglish-grammar-selection-updated", { detail: { lessonIds: unique } }));
    window.dispatchEvent(new CustomEvent("myenglish-grammar-updated"));
  } catch (err) {
    console.warn("Failed to save selected grammar lessons:", err);
  }
}

/**
 * Tick or untick one lesson. Starting from "everything" (nothing excluded), unticking one keeps all the others.
 * The path is never emptied: unticking the last lesson is refused. Returns whether the path changed.
 */
export function toggleLessonSelection(lessonId: string): boolean {
  const current = getEffectiveLessonIds();
  const next = current.includes(lessonId) ? current.filter((id) => id !== lessonId) : [...current, lessonId];
  if (next.length === 0) return false;
  saveSelectedLessonIds(next);
  return true;
}

export async function selectChapterLessons(chapterLessonIds: string[], select: boolean): Promise<boolean> {
  const current = new Set(getEffectiveLessonIds());
  for (const id of chapterLessonIds) {
    if (select) current.add(id);
    else current.delete(id);
  }
  if (current.size === 0) return false;
  saveSelectedLessonIds(Array.from(current));
  return true;
}

/** A lesson the learner has met: quick check done, graded in reviews, or read (a lesson with no questions) */
export function isLessonStudied(lessonId: string): boolean {
  const p = getLessonProgress(lessonId);
  return p.diagnosticStatus !== "unattempted" || p.reps > 0 || !!p.lastReview || isLessonIntroduced(lessonId);
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function readIntroDates(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(INTRO_DATES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** Remember the day a lesson was first studied (pacing: one new lesson per day) */
export function recordLessonIntroDay(lessonId: string, now: Date = new Date()): void {
  const map = readIntroDates();
  if (map[lessonId]) return;
  map[lessonId] = localDay(now);
  try {
    localStorage.setItem(INTRO_DATES_KEY, JSON.stringify(map));
    persistKeyNow(INTRO_DATES_KEY);
  } catch {}
}

/** Lessons first studied today */
export function lessonsIntroducedToday(now: Date = new Date()): string[] {
  const today = localDay(now);
  return Object.entries(readIntroDates())
    .filter(([, day]) => day === today)
    .map(([id]) => id);
}

/** Lessons of the path (in book order) in the order they are learned: those chosen at the first run first */
export function learningOrder<T extends { id: string }>(path: T[]): T[] {
  const start = new Set(readIdList(GRAMMAR_START_KEY) ?? []);
  return [...path.filter((l) => start.has(l.id)), ...path.filter((l) => !start.has(l.id))];
}

/** The path in the order it is learned: the lessons chosen at the first run, then the book's order */
export async function getSelectedLessonsInOrder(): Promise<GrammarBookLesson[]> {
  const all = await getAllBookLessons();
  const effective = new Set(getEffectiveLessonIds(all.map((l) => l.id)));
  return learningOrder(all.filter((l) => effective.has(l.id)));
}

/** Next new lesson: the first lesson of the path not studied yet */
export async function getNextLessonToLearn(): Promise<GrammarBookLesson | null> {
  return (await getSelectedLessonsInOrder()).find((l) => !isLessonStudied(l.id)) ?? null;
}

export interface TodayGrammarPlan {
  /** The next lesson of the path (null when the path is finished or the book is not imported) */
  nextLesson: GrammarBookLesson | null;
  /** A new lesson was already started today: the next one is better left for tomorrow */
  newLessonDoneToday: boolean;
  /** A lesson whose quick check failed: redo it before going on */
  relearn: GrammarBookLesson | null;
  pathLength: number;
  studiedCount: number;
}

export async function getTodayGrammarPlan(now: Date = new Date()): Promise<TodayGrammarPlan> {
  const lessons = await getSelectedLessonsInOrder();
  const introducedToday = new Set(lessonsIntroducedToday(now));
  const relearn =
    lessons.find((l) => getLessonProgress(l.id).diagnosticStatus === "needs_work" && getLessonProgress(l.id).reps <= 1) ?? null;
  return {
    nextLesson: lessons.find((l) => !isLessonStudied(l.id)) ?? null,
    newLessonDoneToday: lessons.some((l) => introducedToday.has(l.id)),
    relearn,
    pathLength: lessons.length,
    studiedCount: lessons.filter((l) => isLessonStudied(l.id)).length,
  };
}

/** Kept for callers of the old name */
export async function getTodaySuggestedLesson(): Promise<GrammarBookLesson | null> {
  const plan = await getTodayGrammarPlan();
  return plan.relearn ?? plan.nextLesson;
}

/** Practice groups whose lessons are all among the given ones ("luyện theo 1, 2… thì") */
export async function getPracticeGroupsForSelection(
  selectedLessonIds: string[],
  overrideGroups?: GrammarBookPracticeGroup[]
): Promise<GrammarBookPracticeGroup[]> {
  const allGroups = overrideGroups ?? (await getAllPracticeGroups());
  const selected = new Set(selectedLessonIds);
  return allGroups.filter((g) => g.lessonIds.length > 0 && g.lessonIds.every((id) => selected.has(id)));
}

export function isReviewGroup(group: GrammarBookPracticeGroup): boolean {
  return group.lessonIds.length >= 2;
}
