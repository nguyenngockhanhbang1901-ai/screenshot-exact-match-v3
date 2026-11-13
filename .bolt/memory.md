# Project memory

## Product intent & audience

- Vite + React project hosted on GitHub; already functional in its source repository.
- User communicates in Vietnamese; likely a developer maintaining/deploying an existing project rather than starting fresh.

## Brand personality & voice

- No brand-specific cues inferred yet.

## Visual design & UX direction

- No UI/visual details examined this turn; not enough signal to record.

## Decisions, constraints & rationale

- Project uses `bun` as package manager (presence of `bun.lock`); npm install fails due to a known peer-dependency resolution bug.
- Must have `bun` installed locally before installing dependencies or building.
- Build passes cleanly once dependencies are installed — no code-level errors.

## Open questions & assumptions

- Assumption: "review" in the user's message refers to a build/CI check or local dev run, not a code-review workflow.
- Unknown: exact React/Vite version stack and plugin set (not inspected yet).
- Unknown: deployment target and whether CI uses bun.
- Unknown: whether there are test scripts or lint configs that also need validation.