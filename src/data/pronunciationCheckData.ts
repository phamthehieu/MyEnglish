/**
 * Data for the pronunciation check ("Đọc thử cho máy nghe", src/services/pronunciationCheck.ts).
 * The recognizer is told a word and the words it is easily mistaken for. Lessons with minimal pairs
 * (ship / sheep) get them from the pairs; the lessons below have none, so what a word is mistaken for is
 * written here.
 */

/**
 * Lessons about the LAST sound of a word: the sound being learned is the end of the word, so the
 * "focus" level of the check judges that end and the "word" level the whole word.
 */
export const END_SOUND_LESSONS: ReadonlySet<string> = new Set(["pron-final-sounds", "pron-s-endings", "pron-ed-endings"]);

/**
 * Lessons where a word WITHOUT a known look-alike is still not checked: what they teach cannot be told by
 * recognizing the word. Word stress is about which syllable is stressed, and the IT words include homophones
 * (cache / cash, sequel / SQL) that a recognizer cannot tell apart. Every other lesson lets any single word be tried.
 */
export const CHECK_NEEDS_LOOKALIKE: ReadonlySet<string> = new Set(["pron-word-stress", "pron-it-words"]);

/**
 * word -> what it is mistaken for, per lesson id. For the -s and -ed lessons the usual mistake of a
 * Vietnamese speaker is to drop the ending, so a word is set against the same word without it.
 */
export const CHECK_AGAINST: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  "pron-s-endings": {
    tests: ["test"],
    apps: ["app"],
    commits: ["commit"],
    bugs: ["bug"],
    files: ["file"],
    logs: ["log"],
    users: ["user"],
    fixes: ["fix"],
    pushes: ["push"],
    pages: ["page"],
  },
  "pron-ed-endings": {
    fixed: ["fix"],
    pushed: ["push"],
    checked: ["check"],
    logged: ["log"],
    saved: ["save"],
    opened: ["open"],
    merged: ["merge"],
    deleted: ["delete"],
    updated: ["update"],
    added: ["add"],
  },
};
