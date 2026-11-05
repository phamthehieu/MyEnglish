// Corrections to the bundled grammar book (src/data/grammarCatalog.json), found by a review of its answer keys:
// keys of another exercise pasted onto a set, answer-key pages parsed as exercises, single wrong keys. Run once on
// a freshly converted book. Raise GRAMMAR_BOOK_REVISION in src/services/grammarBook.ts with `version` below.
import fs from "node:fs";

const FILE = new URL("../src/data/grammarCatalog.json", import.meta.url);
const VERSION = 2;
const book = JSON.parse(fs.readFileSync(FILE, "utf8"));

const sets = new Map();
for (const f of book.files) for (const s of f.exerciseSets ?? []) sets.set(s.id, { set: s, file: f });
const allItems = [];
const walk = (o) => {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === "object") {
    if (typeof o.prompt === "string" && "answers" in o) allItems.push(o);
    Object.values(o).forEach(walk);
  }
};
walk(book.files);

// Answer-key pages parsed as exercises, and sets that lost their task (the prompt is the answer, dates and fractions gone)
for (const id of ["ch11-s11", "ch12-s09", "ch12-s11", "ch12-s12", "ch12-s13", "ch12-s14", "ch12-s15", "ch13-s04", "ch13-s05", "ch13-s06", "ch21-s01", "ch21-s02"]) {
  const e = sets.get(id);
  if (!e) throw new Error(`no set ${id}`);
  e.file.exerciseSets = e.file.exerciseSets.filter((s) => s.id !== id);
}

/** The learner checks against the rule and grades the answer: better than a key of another exercise */
const noKey = (it) => {
  it.noKey = true;
  it.answers = [[]];
  it.answerSentence = it.prompt;
};
// Whole sets whose keys belong to another exercise
for (const id of ["ch07-s01", "ch07-s02", "ch07-s03", "ch11-s02", "ch20-s01"]) sets.get(id).set.items.forEach(noKey);
for (const it of sets.get("ch14-s01").set.items) if (it.n >= 35 && it.n <= 43) noKey(it);

const item = (id, n) => {
  const it = sets.get(id)?.set.items.find((x) => x.n === n);
  if (!it) throw new Error(`no item ${id}.${n}`);
  return it;
};
/** Sets the key of an item: alternatives of the one answer. `sentence`: the whole sentence, when it differs */
const key = (id, n, alternatives, sentence) => {
  const it = item(id, n);
  delete it.noKey;
  delete it.selfGrade;
  it.answers = [alternatives];
  it.answerSentence = sentence ?? alternatives[0];
};
const K = {
  "ch20-s02": ["to accept", "having", "going", "to reach", "opening", "leaving", "to return", "buying", "to accept", "being"],
};
for (const [id, keys] of Object.entries(K)) keys.forEach((k, i) => key(id, i + 1, [k]));

key("ch17-s05", 2, ["feel better"]);
key("ch17-s05", 3, ["smell nice", "look nice"]);
key("ch17-s06", 2, ["twelve-storey"]);
key("ch17-s06", 5, ["two-day"]);
key("ch18-s01", 2, ["intense"]);
key("ch18-s01", 6, ["accurately"]);
key("ch16-s01", 19, ["us"]);
key("ch16-s01", 20, ["he", "him"]);
key("ch30-s02", 1, ["haven’t you?"]);
key("ch30-s02", 2, ["didn’t he?"]);
key("ch30-s02", 16, ["am I?"]);
key("ch30-s02", 17, ["have they?"]);
key("ch22-s06", 11, ["for - at", "for- at"]);
key("ch16-s06", 7, ["of"]);
key("ch09-s01", 5, ["cook"]);
key("ch31-s01", 32, ["You can’t have locked the front door. Here’s the key."]);
key("ch31-s01", 56, ["Maria wishes that she’d been put (they’d put her) in a higher class."]);
key("ch29-s03", 14, ["Who is being kept in the kitchen?"]);
key("ch29-s03", 23, ["Enough money has been sent to these poor boys."]);
key("ch29-s03", 45, ["Pleasant memories are brought back by your story."]);
key("ch29-s03", 49, ["You won’t be allowed to do that silly thing again."]);
key("ch29-s03", 54, ["Drivers are advised to use an alternative route by police."]);
key("ch29-s03", 62, ["They begged that he should be helped."]);
key("ch29-s03", 63, ["He orders that the floor be cleaned."]);
key("ch29-s03", 64, ["He recommends that the job be done."]);
key("ch29-s03", 65, ["She urged that her parents be visited as soon as possible."]);
key("ch29-s01", 11, ["The women with a red hat were looked at by the children."]);
key("ch23-s03", 3, ["Neither he nor I am likely to be present at the meeting."]);
key("ch14-s01", 16, ["It was wine that we ordered, not beer."]);
key("ch14-s01", 47, ["My mother herself made this cake.", "It was my mother who made this cake."]);
key("ch13-s02", 7, ["I’m very much in love with her."]);
key("ch06-s03", 3, ["It was such cold weather that we couldn’t go out."]);
key("ch03-s01", 12, ["stopped", "stops"], "He might get fat if he stopped smoking.");
key("ch10-s01", 8, ["whether", "if", "how"]);
key("ch15-s05", 7, ["has", "have"]);
key("ch15-s05", 18, ["was", "were"]);
key("ch22-s01", 38, ["from", "with"]);
key("ch11-s09", 8, ["She hadn’t anyone to send cards to."]);
key("ch11-s09", 15, ["The man interviewed was entirely unsuitable."]);
key("ch09-s02", 11, ["She looked as if she didn’t know me."]);
key("ch29-s02", 4, ["New Arts gallery will exhibit his painting for the first time."]);
key("ch29-s03", 8, ["Are inquiries about the thief being made by the police?"]);
key("ch19-s07", 1, [".... than I am."]);
key("ch23-s02", 3, ["Because her mother was very sick, she couldn’t come to class."]);
key("ch23-s02", 5, ["Because Daisy is very nice, all her friends love her very much."]);
key("ch23-s02", 8, ["I had forgotten to lock the door when I drove to the office this morning."]);
// ch23-s03.1 says "too": the two places hold together
item("ch23-s03", 1).prompt = "She is in London. She is in Berlin, too. (both ... and)";
key("ch23-s03", 1, ["She is in both London and Berlin."]);

key("ch27-s01", 26, ["has an influence on", "exerts an influence on"]);
key("ch27-s01", 41, ["make complaint about", "make fun of"]);
key("ch22-s01", 63, ["to"]);
key("ch22-s01", 178, ["to"]);
key("ch22-s03", 27, ["at - at", "at- at"]);
key("ch22-s03", 28, ["in", "at"]);
key("ch22-s01", 78, ["with", "to"]);
key("ch22-s01", 188, ["with", "to"]);
key("ch25-s01", 127, ["easy"]);
key("ch25-s01", 186, ["international"]);
key("ch31-s01", 239, ["You’d better apologize to her."]);
// The task can no longer be told from what is left: the learner grades these
for (const [id, n] of [["ch12-s06", 17], ["ch12-s03", 12], ["ch27-s01", 23], ["ch22-s01", 104]]) noKey(item(id, n));
item("ch12-s03", 6).prompt = item("ch12-s03", 6).prompt.replace("play,", "plays,");
key("ch12-s03", 6, ["many", "a large number of", "many of"]);

// Typing mistakes in what the learner reads
const prompts = [
  ["ch06-s05", 7, "couldn’t finish it an hour", "couldn’t finish it in an hour"],
  ["ch08-s03", 6, "Although it was noise", "Although it was noisy"],
  ["ch08-s03", 28, "he was managed to pass", "he managed to pass"],
  ["ch17-s06", 10, "a bicycles", "a bicycle"],
  ["ch11-s05", 38, "I apologized the woman", "I apologized to the woman"],
  ["ch29-s02", 23, "What have been done", "What has been done"],
  ["ch29-s03", 8, "making inquires", "making inquiries"],
  ["ch23-s02", 8, "I had forgot locking the door", "I had forgotten to lock the door"],
];
for (const [id, n, from, to] of prompts) {
  const it = item(id, n);
  if (!it.prompt.includes(from)) throw new Error(`${id}.${n}: ${it.prompt}`);
  it.prompt = it.prompt.replace(from, to);
}
item("ch11-s05", 38).answers = [["I apologized to the woman whose coffee I spilled."]];
item("ch11-s05", 38).answerSentence = "I apologized to the woman whose coffee I spilled.";
item("ch29-s02", 23).answers = [["What have they done to help the poor in this city?"]];

// Items found by their text (the first chapters keep them in practice groups)
const byPrompt = (text) => {
  const found = allItems.filter((i) => i.prompt.includes(text));
  if (found.length === 0) throw new Error(`no item: ${text}`);
  return found;
};
for (const it of byPrompt("Don’t come until I ___ (finish) lunch")) it.answers = [["have finished", "finish"]];
for (const it of byPrompt("I had done that ___ (be) necessary")) {
  it.prompt = "I had done what ___ (be) necessary.";
  it.answerSentence = "I had done what was necessary.";
}
for (const it of byPrompt("Short after the war")) {
  it.prompt = it.prompt.replace("Short after the war", "Shortly after the war");
  it.answers[8] = ["was leaking", "leaked"];
  it.answerSentence = it.answerSentence.replace("Short after the war", "Shortly after the war");
}
for (const it of byPrompt("One day John’s father")) it.answers[1] = ["had broken down"];
for (const it of byPrompt("I’d just parked my car")) it.answers[6] = ["looking"];
fs.writeFileSync(FILE, JSON.stringify({ ...book, version: VERSION }), "utf8");
console.log("items", allItems.length);
