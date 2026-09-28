# Prompt Design

Every artifact prompt in `src/lib/ai/prompts/` is assembled from the same
skeleton, so a provider switch never changes the contract and a schema
change is visible in exactly one place per kind:

```
ROLE_FRAME            who the model is (shared)
TASK: …               one line, per kind
TEACHER INPUTS:       key: value block from the real form (formatInputBlock)
FIELD_CONTRACT        the exact JSON shape, field by field
MINI_EXAMPLE          a worked mini-example, "shape only — never copy"
NO_REFERENCES_RULE    (explainer only) no references anywhere
JSON_CONTRACT         ONE valid JSON object, nothing else
INTEGRITY_RULES       uncertainty honesty + no fabricated citations
```

This document annotates the design decisions per block.

## Role framing (shared, `prompts/shared.ts`)

> "You are an expert SSC and HSC ICT teacher in Bangladesh with 15+ years
> of classroom experience and deep knowledge of the national ICT curriculum
> (including introductory CSE topics …). You write classroom-ready teaching
> material in clear, simple English suited to the stated class level."

Why: the persona fixes vocabulary, level and cultural context (Bangladeshi
classroom, national curriculum, SSC/HSC + intro CSE scope) before any task
is given. "Suited to the stated class level" anchors difficulty to the
teacher's `classLevel` input instead of a generic "high school".

## Schema instruction (per kind, `FIELD_CONTRACT` + `JSON_CONTRACT`)

Each contract says "a JSON object with EXACTLY these fields" and documents
**every** field with its type and an inline description of what good looks
like — e.g. quiz MCQs: "options: string[] — REQUIRED only for `mcq`:
exactly 4 distinct options", "answer: for mcq it must equal one of the
options". The contract mirrors the zod schema 1:1, so the model is told the
same rules that will validate it. `JSON_CONTRACT` then closes the loop:
one JSON object, no fences, no commentary, no extra fields, no HTML/LaTeX
in strings (the output is data for React components, not rendered
markdown).

## Worked example (per kind, `MINI_EXAMPLE`)

Each prompt ends its contract with a realistic mini-example prefixed
"shape only — adapt fully to the inputs, never copy it literally". This
teaches the *shape* (nesting, granularity, tone — e.g. a rubric cell says
"All conversions correct and verified", not "good") without inviting
memorized output. Examples deliberately use a different topic from the
seed content so a copied example cannot pass silently as "adapted".

## Uncertainty handling (shared `INTEGRITY_RULES` + explainer field)

- Shared rule: "If you are not certain about a curriculum fact, say so
  honestly in the optional `uncertaintyNote` field instead of inventing
  details, statistics or references. Never fabricate citations, textbook
  page numbers or board declarations."
- The Explanation schema makes `uncertaintyNote` an *optional* field and
  the explainer contract repeats it: "include ONLY if you are not fully
  certain; never invent facts to fill it".
- The app stores and renders the note prominently on the draft (a
  teacher-facing warning), and dropping/keeping it through edit + approve
  is pinned by `tests/explainer-uncertainty.test.ts`.

Uncertainty is treated as data to surface, never as a reason to fail
silently or to bluff.

## Per-artifact annotations

### Lesson plan (`lesson.ts`)

- Inputs: topic, classLevel, durationMin, optional objectives,
  priorKnowledge, assessmentStyle.
- Contract highlights: 3–5 measurable objectives phrased "Students will be
  able to …"; a 3–5 minute warm-up *connected to the topic*; a
  150–300-word concept explanation in "simple classroom language with a
  small worked example if relevant"; assessment "must match the requested
  assessment style" (the teacher's form choice is binding); and a
  `differentiation` object with explicit `support` / `core` / `stretch`
  tracks — differentiation is structural, not an afterthought.
- The teacher's optional objectives are echoed as the objectives the model
  must keep and extend, so teacher intent survives generation.

### Quiz (`quiz.ts`)

- Inputs: topic, classLevel, questionCount, difficulty (incl. `mixed`),
  questionTypes (incl. `Mixed` = sensible variety), optional
  learningObjective, language.
- Contract highlights: "questions: array of EXACTLY the requested number";
  per-type rules (4 distinct MCQ options, answer must equal an option,
  true_false is exactly "true"/"false", viva model answer 2–4 sentences);
  overall `difficulty` is "medium" when a mix was requested while each
  question keeps its own difficulty; every question carries a
  teacher-facing `explanation`.
- These rules are exactly what `QuizSpecSchema` enforces, and they carry
  into the question bank on export.

### Worksheet (`worksheet.ts`)

- Inputs: topic, classLevel, sectionCount, focus, difficultyMix, and
  teacher-supplied `learningGoals`.
- Contract highlights: sections of 3–6 numbered-ready questions; an
  `answerKey` with "the correct answer for EVERY question, in the same
  order" (index-aligned with the flattened questions — validated
  downstream); `teacherNotes` covering how to run and mark the sheet.
- The mock echoes teacher learningGoals when supplied, so even demo mode
  respects teacher intent.

### Rubric (`rubric.ts`)

- Inputs: assignmentTitle, classLevel, criteriaCount, totalPoints.
- Contract highlights: each criterion carries four performance-level
  descriptors (`excellent` / `good` / `developing` / `beginning`) plus
  integer `points`, and "all criteria points must sum to totalPoints".
- Defense in depth: the save action recomputes `totalPoints =
  sum(criteria.points)` on every teacher edit, so a stored rubric can never
  disagree with its own table (pinned by tests).

### AI explainer (`explainer.ts`)

- Inputs: the student's question, the captured `confusion` (optional but
  decisive when present), topic, audience (`student` | `teacher`).
- Contract highlights: a 2–4 sentence explanation "a struggling student
  can follow"; an everyday analogy with "Bangladeshi context preferred"
  (rickshaw meters, light switches, kitchen scales — analogies that land
  locally); ordered `stepByStep` steps; the `commonMistake` for *this
  exact question*; one paired practice question + answer; the optional
  `uncertaintyNote`.
- Additional `NO_REFERENCES_RULE` (educational integrity, spec 20.6): "Do
  not include references, citations, textbook names, page numbers or URLs
  in ANY field … fabricating a reference is worse than giving none." The
  schema has no references field at all, so the rule is also enforced
  structurally.

## The repair prompt (engine, `provider.ts`)

When a response fails validation, the retry prompt is the original prompt
plus:

```
YOUR PREVIOUS RESPONSE WAS REJECTED. It was not valid JSON or failed validation:
- <issue>: <message>
Return the corrected JSON object following the original contract exactly. Output JSON only.
```

The model re-sees the full contract (not a diff) plus the exact zod issues,
which is the cheapest reliable repair signal; exactly one retry is allowed
before an honest error.
