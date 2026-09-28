# AI Architecture

The provider-agnostic AI layer in `src/lib/ai/` is the heart of the
project (spec 10 + 20.11). One interface, three backends, one strict
validation boundary — and no code path that lets unvalidated model output
reach a teacher's screen.

```
src/lib/ai/
  provider.ts     the AiProvider interface, selection rules, shared engine
  gemini.ts       Gemini REST implementation (v1beta generateContent)
  openai.ts       OpenAI chat-completions implementation
  mock.ts         deterministic template provider (demo honesty)
  mock-content.ts the curated SSC/HSC ICT sample-content library
  prompts/        one module per artifact kind (+ shared framing)
  schemas/        one zod schema per artifact kind
  validate.ts     JSON-parse + zod-validate + issue formatting
  errors.ts       AiGenerationError (provider | validation)
```

## The provider interface

```ts
export interface AiProvider {
  readonly name: ProviderName;   // "gemini" | "openai" | "mock"
  readonly model: string;
  generate<T>(
    kind: ArtifactKind,          // "lesson" | "quiz" | "worksheet" | "rubric" | "explainer"
    input: Record<string, unknown>,
    schema: ZodType<T>,           // the artifact's zod schema
  ): Promise<GenerationResult<T>>; // { data, provider, model }
}
```

Every provider implements `generate` by delegating to one shared engine,
`runGeneration(kind, input, schema, config)`, where `config` supplies:

- `name` / `model` — stamped onto the stored artifact for provenance;
- `produce(prompt)` — one transport attempt: real providers return raw
  model text, the mock returns a ready object;
- `repairable` — real providers participate in the repair retry; the mock's
  deterministic output never does (fail fast instead).

## Selection rules

`resolveProviderName(env)` is a pure function (unit-tested env matrix):

1. `AI_PROVIDER` explicitly set to `gemini` / `openai` / `mock` → that one.
2. Else `GEMINI_API_KEY` present → `gemini`.
3. Else `OPENAI_API_KEY` present → `openai`.
4. Else → `mock`.

`AI_MODEL` overrides the model id for any provider; defaults live in
`DEFAULT_MODELS` (`gemini-2.5-flash`, `gpt-4o-mini`, `mock-template-v1`).
`getProviderInfo(env)` exposes provider/model/label/mockMode for UI chips —
never any key.

## Schemas (the trust boundary)

`src/lib/ai/schemas/` defines a strict zod schema per artifact kind
(`LessonPlanSchema`, `QuizSpecSchema`, `WorksheetSpecSchema`,
`RubricSpecSchema`, `ExplanationSchema`). The engine validates **every**
response against the schema for that kind before returning it, and the
store layer re-validates full documents with the doc schemas
(`src/lib/db/types.ts`) at both store boundaries. Consequences:

- a malformed quiz can never be persisted, printed, or sent to the question
  bank — validation happens first;
- cross-field rules (MCQs have exactly 4 options and an answer among them,
  true/false answers are `true`/`false`, rubric points sum to
  `totalPoints`) are enforced in the same place as field types;
- the same schemas power the teacher-facing editors, so an edited artifact
  must satisfy the identical contract the model satisfied.

## Validation + the single repair retry

`validate.ts` strips a defensive markdown fence, `JSON.parse`s the text,
then `safeParse`s it. Failures become human-readable issue strings
(`path: message`), which feed the retry:

1. First attempt — prompt built by `prompts/<kind>.ts` from the teacher's
   inputs.
2. If invalid, **one** repair retry: the original prompt plus
   `YOUR PREVIOUS RESPONSE WAS REJECTED …` and the exact issue list, ending
   with "Return the corrected JSON object following the original contract
   exactly."
3. If the retry is still invalid → `AiGenerationError`
   (`reason: "validation"`, issues attached, message says nothing was
   saved). The server action surfaces that message honestly to the form.

There is no third attempt, no silent fallback, and no partially-trusted
output — ever.

## Timeout + transport retry

Each provider request runs with a **20 s timeout** (`REQUEST_TIMEOUT_MS`)
via `AbortController`. A transport failure (timeout, network error, HTTP
5xx) is retried **once** (2 attempts total, `withTransportRetry`); after
that the engine throws `AiGenerationError` with `reason: "provider"` and an
honest "failed after 2 attempts" message. JSON modes:

- Gemini: `generationConfig: { responseMimeType: "application/json" }`
  against `generativelanguage.googleapis.com/v1beta/…/generateContent`;
- OpenAI: `response_format: { type: "json_object" }` against
  `/v1/chat/completions`.

## Key safety

- Keys are read **only** inside server-only modules (`gemini.ts`,
  `openai.ts`, `provider.ts`), which are imported exclusively from
  `src/app/actions/*` (server actions) and route handlers.
- No component, client bundle or API response ever contains a key; the
  Settings page reports key *presence* as booleans via
  `src/lib/settings/env-status.ts` (unit-tested to prove values never
  leak).
- The mock provider requires no key and is selected automatically when none
  is configured — the deployed demo is always functional and always honest
  about which mode it is in.

## Where generation is called

Only in server actions: `generateLessonPlanAction`,
`generateQuizAction`, `generateWorksheetAction`, `generateRubricAction`,
`generateExplanationAction`. Each guards the session (`requireRole`),
validates the teacher's form input with zod, calls
`getProvider().generate(...)`, catches `AiGenerationError` into an honest
form-level error, and stores the validated result as a **draft** with
`provider` + `model` provenance (spec 20.10).

See also: [prompt-design.md](./prompt-design.md) for how prompts are built,
[safety.md](./safety.md) for the review-first philosophy.
