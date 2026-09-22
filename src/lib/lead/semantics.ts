import type { Blocker, BlockerKind, Commitment, IndividualReport, Momentum, ReportSignals } from "@/lib/lead/types";

/* ==========================================================================
   Semantic extraction for committee check-ins.

   The intake form collects four free-text answers (project, updates, next
   steps, issues). This module reads them with an explicit, auditable lexicon
   rather than a black box: every derived claim keeps the scholar's own
   sentence, and every classification records why it was reached. Signals are
   derived on read, so improving a lexicon improves past weeks too.
   ========================================================================== */

const STOPWORDS = new Set([
  "a", "about", "after", "all", "also", "am", "an", "and", "any", "are", "as", "at", "be", "been", "being", "but", "by", "can", "did", "do", "does", "for", "from", "get", "got", "had", "has", "have", "he", "her", "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just", "me", "more", "most", "my", "no", "not", "of", "on", "one", "or", "our", "out", "over", "she", "should", "so", "some", "such", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "to", "too", "up", "us", "very", "was", "we", "were", "what", "when", "which", "while", "who", "will", "with", "would", "you", "your",
]);

/** Words that read as effort but carry no evidence. */
const VAGUE_CUES = ["stuff", "things", "a lot", "etc", "various", "misc", "whatever", "as usual", "same as always", "working on it", "in the works", "moving along", "good progress", "went well", "a bit", "kind of", "sort of", "hopefully", "maybe"];

const DELIVERED_CUES = ["completed", "finished", "finalized", "published", "posted", "sent out", "sent", "launched", "released", "submitted", "approved", "hosted", "ran the", "wrapped up", "went live", "delivered", "distributed", "printed", "recorded", "uploaded", "signed off", "locked in", "booked", "confirmed", "closed out", "handed off", "went out"];
const ADVANCING_CUES = ["drafted", "draft of", "started", "began", "building", "designing", "writing", "editing", "revised", "reviewing", "updated", "met with", "reached out", "outlined", "scheduled", "collected", "gathered", "tested", "interviewed", "in progress", "working on", "nearly done", "almost done", "compiled", "assigned"];
const PLANNING_CUES = ["brainstormed", "discussed", "plan to", "planning", "proposing", "proposed", "considering", "thinking about", "looking into", "want to", "hope to", "idea for", "ideas for", "decided to", "agreed to"];
const STALLED_CUES = ["no update", "no updates", "nothing new", "same as last week", "no progress", "paused", "on hold", "on pause", "postponed", "pushed back", "tabled", "did not meet", "no meeting", "have not started", "nothing yet", "no changes"];

type BlockerRule = { kind: BlockerKind; label: string; cues: string[]; base: Blocker["severity"]; action: string };

/**
 * Each rule pairs the language scholars actually use with the move a chair can
 * make this week. The action is the point of the reading: a named blocker with
 * no next move is only a complaint with a category attached.
 */
const BLOCKER_RULES: BlockerRule[] = [
  { kind: "waiting-on-others", label: "Waiting on a reply", base: "high", action: "Name the person accountable, set a reply-by date, and escalate to co-chairs if it passes.", cues: ["waiting on", "waiting for", "waiting to hear", "no response", "have not heard", "has not responded", "no reply", "still waiting", "pending approval", "need approval", "needs approval", "unanswered"] },
  { kind: "editing-access", label: "Editing access missing", base: "medium", action: "Name who owns the permission, grant editing access on the linked document or page, and record that owner in the evidence ledger.", cues: ["need access", "no access", "cannot edit", "view only", "view-only", "not shared", "permission", "permissions", "locked", "request access", "requesting access", "editing access", "access to the", "cannot access", "read only", "read-only", "password"] },
  { kind: "capacity", label: "Capacity and workload", base: "high", action: "Re-scope the week to one deliverable, or assign a Free Agent to the committee.", cues: ["short-handed", "shorthanded", "only one person", "no one", "nobody", "too much", "overwhelmed", "spread thin", "not enough people", "need volunteers", "need help", "need more hands", "understaffed", "midterms", "exams", "finals", "workload", "bandwidth", "everyone is busy", "burnt out", "burned out", "stretched"] },
  { kind: "attendance", label: "Attendance and turnout", base: "high", action: "Attach the next session to an existing high-attendance touchpoint and send a 24-hour reminder.", cues: ["low turnout", "low attendance", "few people came", "no one came", "nobody came", "no-show", "no shows", "did not show", "empty room", "poor attendance", "only a few", "attendance was low", "cancelled due to", "canceled due to", "drop off", "drop-off"] },
  { kind: "direction", label: "Direction and scope unclear", base: "medium", action: "Get one written decision from the co-chairs before the next meeting and log it as the source of truth.", cues: ["unclear", "not sure", "unsure", "do not know", "confused", "confusing", "need direction", "no guidelines", "no guidance", "vague", "conflicting", "mixed messages", "who owns", "not defined", "up in the air", "waiting on a decision", "no clear"] },
  { kind: "timeline", label: "Timeline at risk", base: "high", action: "Re-baseline the date publicly and cut scope to the one item that must ship.", cues: ["behind schedule", "behind on", "delayed", "running out of time", "not going to make", "missed the deadline", "past due", "rushed", "short notice", "tight timeline", "no time", "ran out of time", "pushed the date", "slipped"] },
  { kind: "funding", label: "Funding and supplies", base: "medium", action: "File the spend request with a budget line and an amount before the next cycle closes.", cues: ["budget", "funding", "funds", "no money", "costs too much", "expensive", "reimbursement", "supplies", "materials", "printing", "catering", "sponsor"] },
  { kind: "tooling", label: "Tool or platform problem", base: "medium", action: "Log the defect with a screenshot and an owner, and verify a fix before the next publish.", cues: ["broken", "bug", "error", "not working", "does not work", "glitch", "crashed", "cannot log in", "login", "formatting issue", "will not upload", "template broke"] },
  { kind: "coordination", label: "Coordination gap", base: "medium", action: "Put one owner on each deliverable and move the dates onto the shared Academy calendar.", cues: ["double booked", "double-booked", "scheduling conflict", "overlap", "overlapping", "miscommunication", "did not know", "last minute", "two different", "duplicate", "crossed wires", "not on the same page", "was not told", "left out of"] },
];

/**
 * The issues field is where a problem is declared. The updates field is not, so a
 * blocker inferred from an update has to be carrying a problem signal too -
 * otherwise "approved two of the three committee budgets" reads as a funding
 * blocker purely because it contains the word budget.
 */
const PROBLEM_MARKERS = ["not ", "no ", "cannot", "unable", "still", "delay", "issue", "problem", "concern", "risk", "stuck", "blocked", "waiting", "over budget", "short", "missing", "without", "struggl", "fail", "behind", "lost", "never", "instead of", "had to"];

const ESCALATORS = ["still", "again", "for weeks", "two weeks", "three weeks", "a month", "no one", "nobody", "never", "urgent", "critical", "completely", "cannot", "multiple times", "twice", "repeatedly", "every week", "blocked"];
const DAMPENERS = ["minor", "small", "slight", "a little", "not a big deal", "is resolved", "was resolved", "now resolved", "has been resolved", "we resolved", "got resolved", "figured out", "is fixed", "now fixed", "we fixed", "has been fixed", "no longer an issue", "should be fine", "manageable", "worked around", "sorted out"];

const THEME_RULES: { label: string; cues: string[] }[] = [
  { label: "Communications and storytelling", cues: ["newsletter", "article", "story", "stories", "write-up", "writeup", "interview", "feature", "spotlight", "editorial", "headline", "copy", "blurb", "scholar news", "press", "announcement", "publish", "byline", "draft"] },
  { label: "Digital presence", cues: ["instagram", "post", "posts", "reel", "reels", "social media", "website", "web page", "webpage", "linkedin", "graphic", "graphics", "canva", "design", "logo", "banner", "follower", "followers", "feed", "caption", "hashtag", "site"] },
  { label: "Event delivery", cues: ["event", "events", "rsvp", "venue", "room", "catering", "agenda", "run of show", "setup", "set up", "tabling", "workshop", "panel", "speaker", "ceremony", "banquet", "logistics", "sign-in", "check-in", "headcount", "invite"] },
  { label: "Community and belonging", cues: ["community", "connect", "connection", "bond", "mixer", "welcome", "belonging", "culture", "support", "buddy", "mentor", "inclusive", "icebreaker", "hangout", "get to know"] },
  { label: "Recruitment and onboarding", cues: ["recruit", "recruitment", "applicant", "application", "onboard", "onboarding", "new scholar", "new scholars", "cohort", "orientation", "intake", "outreach", "info session", "interest form"] },
  { label: "Partnerships and external relations", cues: ["partner", "partnership", "alumni", "employer", "sponsor", "department", "office of", "career services", "faculty", "staff", "external", "collaborate with", "co-host", "cohost", "campus partner", "nonprofit"] },
  { label: "Governance and process", cues: ["charter", "bylaws", "policy", "process", "structure", "responsibilities", "handbook", "template", "workflow", "cadence", "minutes", "rubric", "guidelines", "system for", "tracker"] },
  { label: "Recognition and culture", cues: ["award", "recognition", "shout out", "shoutout", "celebrate", "celebration", "appreciate", "appreciation", "milestone", "highlight", "thank", "kudos"] },
  { label: "Data and reporting", cues: ["report", "reporting", "form", "survey", "data", "track", "tracking", "spreadsheet", "metric", "metrics", "attendance numbers", "response rate", "dashboard", "analytics", "feedback form"] },
  { label: "Capacity and wellbeing", cues: ["workload", "burnout", "stress", "balance", "availability", "bandwidth", "time commitment", "exams", "midterms"] },
];

const ARTIFACT_NOUNS = ["newsletter", "article", "post", "reel", "story", "flyer", "poster", "graphic", "form", "survey", "spreadsheet", "document", "deck", "slides", "agenda", "minutes", "report", "template", "calendar", "website", "page", "email", "draft", "itinerary", "budget", "proposal", "charter", "handbook", "script", "video", "logo", "banner", "schedule", "roster", "tracker", "guide", "policy", "invitation", "invite", "signup", "sign-up", "playlist", "podcast", "campaign", "series", "workshop", "event", "meeting", "session", "panel", "mixer", "database", "rubric", "checklist"];

const NAME_STOPLIST = new Set(["academy", "leadership", "scholar", "scholars", "committee", "community", "events", "chairs", "free", "agents", "news", "web", "social", "media", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "illinois", "tech", "campusgroups", "instagram", "linkedin", "canva", "google", "zoom", "the", "this", "next", "last", "also", "however", "additionally", "unfortunately", "finally", "overall", "after", "before", "during", "since", "because"]);

const DATE_PATTERN = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|\bnext (?:week|month|monday|meeting|session)\b|\bend of (?:the )?(?:week|month|semester)\b/gi;
const QUANTITY_PATTERN = /\b\d{1,4}\s*%|\b\d{1,4}\s+[a-z][a-z-]{2,24}(?:\s+[a-z][a-z-]{2,24})?/gi;
/** Function words that can end a quantity match but are not part of the quantity. */
const QUANTITY_TAIL = new Set(["against", "and", "the", "for", "with", "from", "over", "under", "up", "to", "in", "on", "at", "was", "were", "came", "went", "each", "that", "which", "who", "but", "so", "while", "after", "before", "out", "this", "last", "next", "than", "of", "by", "as", "is", "are"]);
const DUE_PATTERN = /\b(?:by|before|on|due|ahead of|no later than)\s+(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:mon|tues|wednes|thurs|fri|satur|sun)day|next week|end of (?:the )?(?:week|month|semester)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?)/i;

const LEAD_IN = /^(?:we|i|our team|the committee)?\s*(?:are |am |is )?(?:going to|plan to|planning to|will|want to|need to|hope to|intend to|aim to|would like to|should|must|continue to|keep)\s+/i;
const FILLER = /\b(?:at (?:this|the) (?:time|moment)|right now|so far|as of now|currently|yet|this week|for now|really|honestly)\b/gi;
const BLANK_ANSWER = /^(?:n\/?a|none|no|nope|nothing|nil|no issues?|no problems?|no concerns?|no blockers?|not really|all good|we are good|everything is (?:fine|good|on track)|no updates?|tbd|-+|\.+)$/i;

export function isBlankAnswer(text: string) {
  const value = text
    .replace(FILLER, " ")
    .replace(/\bwe'?re\b/gi, "we are")
    .replace(/\beverything'?s\b/gi, "everything is")
    .replace(/[^a-z0-9/'\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value.length === 0 || BLANK_ANSWER.test(value);
}

export function toSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|[\r\n]+|\s*[•·▪]\s*/)
    .map((part) => part.replace(/^[\s\-–—*+>]+/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((part) => part.replace(/[^a-z0-9]/gi, "").length > 2);
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Meaning-bearing words, lightly stemmed, so "editing" and "edited" thread together. */
export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .map((token) => (token.endsWith("ies") ? `${token.slice(0, -3)}y` : token.endsWith("es") && token.length > 5 ? token.slice(0, -2) : token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token))
    .map((token) => (token.endsWith("ing") && token.length > 6 ? token.slice(0, -3) : token.endsWith("ed") && token.length > 5 ? token.slice(0, -2) : token));
}

/** Overlap of meaning-bearing words: links a project across weeks and tests follow-through. */
export function similarity(left: string, right: string) {
  const a = new Set(contentTokens(left));
  const b = new Set(contentTokens(right));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  a.forEach((token) => { if (b.has(token)) shared += 1; });
  return shared / Math.min(a.size, b.size);
}

/** A stable key for one project, so the same work described in different words still threads. */
export function projectKey(text: string) {
  const tokens = [...new Set(contentTokens(text))].sort();
  return tokens.slice(0, 6).join("-") || "unnamed";
}

function countCues(haystack: string, cues: string[]) {
  return cues.filter((cue) => haystack.includes(cue)).length;
}

function matchedCues(haystack: string, cues: string[]) {
  return cues.filter((cue) => haystack.includes(cue));
}

/** Case-insensitive de-duplication that keeps the first spelling seen. */
function unique(values: string[], limit = 12) {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    kept.push(value);
    if (kept.length >= limit) break;
  }
  return kept;
}

/** Contracted negations are normalised first so the lexicons only need one spelling. */
function expand(text: string) {
  return text
    .replace(/\bcan['’]t\b/gi, "cannot")
    .replace(/\bwon['’]t\b/gi, "will not")
    .replace(/\bhaven['’]t\b/gi, "have not")
    .replace(/\bhasn['’]t\b/gi, "has not")
    .replace(/\bdidn['’]t\b/gi, "did not")
    .replace(/\bdoesn['’]t\b/gi, "does not")
    .replace(/\bdon['’]t\b/gi, "do not")
    .replace(/\bwasn['’]t\b/gi, "was not")
    .replace(/\bweren['’]t\b/gi, "were not")
    .replace(/\bisn['’]t\b/gi, "is not")
    .replace(/\baren['’]t\b/gi, "are not");
}

/** Numbers with the unit they count, minus any function word the match ran into. */
function quantities(text: string) {
  return unique((text.match(QUANTITY_PATTERN) ?? []).map((value) => {
    const parts = value.trim().split(/\s+/);
    while (parts.length > 1 && QUANTITY_TAIL.has(parts[parts.length - 1].toLowerCase())) parts.pop();
    return parts.length > 1 || parts[0].includes("%") ? parts.join(" ") : "";
  }), 8);
}

/**
 * People, not products. Title Case alone matches "Fall Scholar Spotlight" as
 * readily as "Priya Raman", so a candidate only counts as a person when the
 * sentence puts it in a person's position - after "with", "from" or "to", or in
 * front of a verb someone performs.
 */
function personNames(text: string) {
  const names: string[] = [];
  const candidate = "([A-Z][a-z]{2,}(?:\\s+[A-Z][a-z]{2,})?)";
  const patterns = [
    new RegExp(`\\b(?:with|from|to|and|alongside|thanks to|credit to|handed to|met)\\s+${candidate}\\b`, "g"),
    new RegExp(`\\b${candidate}\\s+(?:will|is|has|said|helped|agreed|volunteered|joined|offered|took|sent|wrote|led|owns)\\b`, "g"),
    /@([a-z][\w.-]{2,30})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1];
      if (!value) continue;
      const parts = value.split(/\s+/);
      if (parts.some((part) => NAME_STOPLIST.has(part.toLowerCase()) || ARTIFACT_NOUNS.includes(part.toLowerCase()))) continue;
      names.push(value);
    }
  }
  return unique(names, 8);
}

function artifacts(text: string) {
  const found: string[] = [];
  for (const match of text.matchAll(/["“‘']([^"”’']{3,60})["”’']/g)) found.push(match[1]);
  // The optional second noun keeps compounds whole: "post templates", not "post".
  const nouns = ARTIFACT_NOUNS.join("|");
  const pattern = new RegExp(`\\b((?:[A-Za-z][\\w'-]*\\s+){0,3}(?:${nouns})s?(?:\\s+(?:${nouns})s?)?)\\b`, "gi");
  for (const match of text.matchAll(pattern)) {
    const words = match[1].trim().split(/\s+/);
    // Everything up to the last function word belongs to the sentence rather than to the
    // name: "set up a shared tracker" names the tracker, "committee at Wednesday's meeting"
    // names the meeting.
    for (let index = words.length - 2; index >= 0; index -= 1) {
      if (STOPWORDS.has(words[index].toLowerCase())) { words.splice(0, index + 1); break; }
    }
    // A past-tense verb in front of a longer phrase is the sentence's verb, not part of the
    // name: "designed four post templates" names the templates. Two-word phrases keep their
    // first word, because there "shared tracker" is the name rather than an action.
    if (words.length > 2 && /ed$/i.test(words[0]) && !ARTIFACT_NOUNS.includes(words[0].toLowerCase())) words.shift();
    const phrase = words.join(" ");
    if (words.length > 1 || /^[A-Z]/.test(phrase)) found.push(phrase);
  }
  return unique(found, 10);
}

function severityShift(sentence: string, base: Blocker["severity"]): Blocker["severity"] {
  const order: Blocker["severity"][] = ["low", "medium", "high"];
  const escalators = countCues(sentence, ESCALATORS);
  // Two escalators ("still" plus "two weeks") can lift even an inferred blocker to high.
  let index = order.indexOf(base) + Math.min(2, escalators);
  if (countCues(sentence, DAMPENERS) > 0) index -= 2;
  return order[Math.min(order.length - 1, Math.max(0, index))];
}

function findBlockers(issues: string, updates: string): Blocker[] {
  const blockers: Blocker[] = [];
  const scan = (text: string, declared: boolean) => {
    if (isBlankAnswer(text)) return;
    for (const sentence of toSentences(expand(text))) {
      const lower = sentence.toLowerCase();
      // A sentence that only says there is no problem must not create one.
      if (/^(?:there (?:are|is) no|no |none|we have no|nothing)\b/.test(lower) && countCues(lower, ESCALATORS) === 0) continue;
      if (!declared && countCues(lower, PROBLEM_MARKERS) === 0) continue;
      const ranked = BLOCKER_RULES
        .map((rule) => ({ rule, hits: countCues(lower, rule.cues) }))
        .filter((entry) => entry.hits > 0)
        .sort((a, b) => b.hits - a.hits);
      if (ranked.length === 0) continue;
      const { rule } = ranked[0];
      if (blockers.some((blocker) => blocker.kind === rule.kind)) continue;
      // An issue the scholar declared outranks one inferred from the narrative.
      blockers.push({ kind: rule.kind, label: rule.label, severity: severityShift(lower, declared ? rule.base : "low"), quote: sentence.slice(0, 240), recommendedAction: rule.action });
    }
  };
  scan(issues, true);
  // Problems are often buried in the update rather than declared in the issues field.
  scan(updates, false);
  const rank: Blocker["severity"][] = ["high", "medium", "low"];
  return blockers.sort((a, b) => rank.indexOf(a.severity) - rank.indexOf(b.severity)).slice(0, 5);
}

/** "Web and Social Media" is one committee, not a clause boundary. */
const COMMITTEE_AND = /\bWeb and Social Media\b/g;

/**
 * "Publish the newsletter and send the teaser to Web and Social Media" is two
 * commitments, and tracking them separately is the difference between knowing
 * half of it happened and recording the whole line as kept.
 */
function splitClauses(sentence: string, actionCues: string[]) {
  const masked = sentence.replace(COMMITTEE_AND, (match) => match.replace(/ /g, " "));
  const clauses = masked
    // Real whitespace is required around the conjunction, so the masked committee name survives.
    .split(/\s*,?\s+(?:and then|then|and|as well as)\s+/i)
    .map((part) => part.replace(/ /g, " ").trim())
    .filter((part) => part.split(/\s+/).length >= 3 && countCues(part.toLowerCase(), actionCues) > 0);
  return clauses.length > 1 ? clauses : [sentence];
}

function findCommitments(nextSteps: string): Commitment[] {
  if (isBlankAnswer(nextSteps)) return [];
  const actionCues = [...DELIVERED_CUES, ...ADVANCING_CUES, ...PLANNING_CUES, "finish", "send", "post", "publish", "create", "write", "meet", "reach out", "confirm", "book", "collect", "review", "share", "set up", "follow up", "launch", "prepare", "assign", "recruit", "schedule", "update", "build", "design", "host", "run", "finalize", "draft", "hand", "approve", "complete", "deliver", "distribute", "record", "upload", "submit", "circulate", "compile", "outline", "edit", "revise", "organize", "identify", "onboard", "train", "order", "print", "invite", "email", "contact", "gather", "track", "measure", "summarize", "present"];
  return toSentences(nextSteps)
    .flatMap((sentence) => splitClauses(sentence, actionCues))
    .map((sentence) => {
      if (countCues(sentence.toLowerCase(), actionCues) === 0) return undefined;
      const text = sentence.replace(LEAD_IN, "").replace(/\s+/g, " ").trim();
      if (text.replace(/[^a-z]/gi, "").length < 6) return undefined;
      const commitment: Commitment = { text: (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 200) };
      const due = DUE_PATTERN.exec(sentence)?.[0];
      if (due) commitment.due = due;
      const owner = personNames(sentence)[0];
      if (owner) commitment.owner = owner;
      return commitment;
    })
    .filter((commitment): commitment is Commitment => commitment !== undefined)
    .slice(0, 6);
}

function findDelivered(updates: string) {
  if (isBlankAnswer(updates)) return [];
  return toSentences(updates)
    .filter((sentence) => countCues(sentence.toLowerCase(), DELIVERED_CUES) > 0)
    .map((sentence) => sentence.slice(0, 220))
    .slice(0, 5);
}

function resolveMomentum(updates: string, blockers: Blocker[], delivered: string[]): { momentum: Momentum; reason: string } {
  const lower = expand(updates).toLowerCase();
  const stalled = matchedCues(lower, STALLED_CUES);
  const advancing = matchedCues(lower, ADVANCING_CUES);
  const planning = matchedCues(lower, PLANNING_CUES);
  const high = blockers.filter((blocker) => blocker.severity === "high");
  if (high.length > 0 && delivered.length === 0) return { momentum: "blocked", reason: `A high-severity blocker (${high[0].label.toLowerCase()}) with no delivered work this week.` };
  if (isBlankAnswer(updates)) return { momentum: "stalled", reason: "No update was written for the week." };
  if (stalled.length > 0 && delivered.length === 0) return { momentum: "stalled", reason: `The update says "${stalled[0]}".` };
  if (delivered.length > 0) return { momentum: "shipped", reason: `${delivered.length} completed item${delivered.length === 1 ? "" : "s"} named in the update.` };
  // "Working on it" is a claim of activity with nothing attached to it; do not read it as progress.
  const vague = matchedCues(lower, VAGUE_CUES);
  if (vague.length > 0 && wordCount(updates) < 30) return { momentum: "planning", reason: `The update claims activity without naming an output ("${vague[0]}").` };
  if (advancing.length > 0) return { momentum: "advancing", reason: `Work in flight: "${advancing[0]}".` };
  if (planning.length > 0) return { momentum: "planning", reason: `The update describes intent rather than output: "${planning[0]}".` };
  return { momentum: "advancing", reason: "The update describes activity with no completion or stall signal." };
}

function findThemes(text: string, blockers: Blocker[]) {
  const lower = text.toLowerCase();
  const blockerText = blockers.map((blocker) => blocker.quote.toLowerCase()).join(" ");
  return THEME_RULES
    .map((rule) => ({ label: rule.label, mentions: countCues(lower, rule.cues), tone: (countCues(blockerText, rule.cues) > 0 ? "watch" : "positive") as "positive" | "watch" }))
    .filter((theme) => theme.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);
}

function scoreSentence(sentence: string) {
  const lower = sentence.toLowerCase();
  return (
    countCues(lower, DELIVERED_CUES) * 3 +
    countCues(lower, ADVANCING_CUES) +
    (sentence.match(QUANTITY_PATTERN)?.length ?? 0) * 2 +
    (sentence.match(DATE_PATTERN)?.length ?? 0) +
    artifacts(sentence).length * 2 -
    countCues(lower, VAGUE_CUES) * 3
  );
}

/** Extractive, never generative: the sentences a reader would have picked out themselves. */
function pickQuotes(updates: string, project: string) {
  return [...toSentences(updates), ...toSentences(project)]
    .map((sentence) => ({ sentence, score: scoreSentence(sentence) }))
    .filter((entry) => entry.score > 1 && entry.sentence.length > 24)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => (entry.sentence.length > 220 ? `${entry.sentence.slice(0, 217)}…` : entry.sentence));
}

export function deriveSignals(report: IndividualReport): ReportSignals {
  const narrative = [report.project, report.updates, report.nextSteps, report.issues].join("\n");
  const delivered = findDelivered(report.updates);
  const blockers = findBlockers(report.issues, report.updates);
  const commitments = findCommitments(report.nextSteps);
  const { momentum, reason } = resolveMomentum(report.updates, blockers, delivered);
  const numbers = quantities(report.updates);
  const dates = unique(narrative.match(DATE_PATTERN) ?? [], 8);
  const named = artifacts([report.project, report.updates].join(" "));
  const collaborators = personNames([report.updates, report.nextSteps].join(" ")).filter((name) => !report.scholarName.toLowerCase().includes(name.toLowerCase()));
  const vagueHits = countCues(narrative.toLowerCase(), VAGUE_CUES);

  const score = Math.max(0, Math.min(100,
    20 +
    Math.min(20, numbers.length * 7) +
    Math.min(15, dates.length * 7) +
    Math.min(20, named.length * 5) +
    Math.min(10, report.documentLinks.length * 5 + report.attachments.length * 5) +
    Math.min(15, delivered.length * 7) -
    Math.min(25, vagueHits * 8),
  ));
  // A very short answer cannot be highly specific whichever words it uses.
  const specificity = wordCount(report.updates) < 12 ? Math.min(score, 35) : score;

  const followUps: string[] = [];
  if (wordCount(report.updates) < 15) followUps.push("The update is a single line — ask for the artifact, the count, or the date behind it.");
  if (numbers.length === 0 && named.length === 0) followUps.push("No named deliverable or count appears in the update, so the week cannot be evidenced.");
  if (commitments.length === 0) followUps.push("Next steps are not written as actions, so nothing can be checked next week.");
  if (report.documentLinks.length === 0 && /\b(?:doc|document|sheet|spreadsheet|draft|deck|slides|link)\b/i.test(report.updates)) followUps.push("A document is mentioned but no link with editing access was shared.");
  if (isBlankAnswer(report.issues) && blockers.length > 0) followUps.push(`The issues field reports none, but the update describes one: "${blockers[0].quote.slice(0, 110)}"`);
  if (vagueHits >= 2) followUps.push("The narrative leans on general phrasing; ask which specific piece moved.");

  return {
    words: wordCount(narrative),
    momentum,
    momentumReason: reason,
    specificity,
    evidence: { numbers, dates, artifacts: named, collaborators, links: report.documentLinks.length, attachments: report.attachments.length, meetingHeld: Boolean(report.lastMeetingOn), score },
    blockers,
    commitments,
    delivered,
    themes: findThemes(narrative, blockers),
    quotes: pickQuotes(report.updates, report.project),
    followUps: followUps.slice(0, 4),
  };
}

/** One scannable line for the retrieval list: the clearest thing this report says. */
export function headlineFor(report: IndividualReport, signals: ReportSignals) {
  const source = signals.delivered[0] ?? signals.quotes[0] ?? toSentences(report.updates)[0] ?? toSentences(report.project)[0] ?? "No narrative submitted.";
  const trimmed = source.replace(/\s+/g, " ").trim();
  return trimmed.length > 150 ? `${trimmed.slice(0, 147)}…` : trimmed;
}
