# CP 2.4 — INTELLIGENCE ENGINE

The Intelligence Engine introduces a non-destructive cognitive layer on top of the deterministic Central de Precatórios capabilities. It leverages local, offline AI (Ollama `qwen3:4b`) to read, extract, compare, and summarize complex legal documents without overriding human or official source authority.

## Principles

1. **AI as Assistant**: The AI produces "observations" (`aiObservationSchema`), not authoritative facts. All findings must be corroborated by exact evidence strings and document pages.
2. **Local-First**: The system operates exclusively against an Ollama instance without external API costs or data privacy leaks.
3. **Structured Extraction**: The AI is forbidden from writing unstructured responses when populating the CP database. It uses JSON schemas strictly enforced by `zod`.
4. **Resilience**: The system gracefully degrades to deterministic rules if the AI provider goes offline.

## Core Services

- `ollama-provider.ts`: Manages HTTP connectivity to Ollama, handling model presence checks, timeout envelopes, and structure validation.
- `ai-health.ts` (API route): Exposes robust real-time diagnostics (`OLLAMA_OFFLINE`, `MODEL_NOT_FOUND`, `GENERATION_FAILED`, `STRUCTURED_OUTPUT_FAILED`, `TIMEOUT`, `READY`).
- `ai-core.ts`: Defines `AIObservation`, `AIRun`, and `AITaskPolicy` schemas.
- `creditor-extraction.ts`: Dedicated extraction AI task ensuring that roles like `ADVOGADO` aren't mistakenly classified as `CREDOR`.
- `intelligence-panel.tsx`: Exposes a unified "Inteligência CP" dashboard inside the Lead workspace.

## Prompt Versioning & Caching
Tasks are strictly versioned (`promptVersion: "v1"`). AI runs track input references, model configurations, and validation state for transparent auditing.

## Development Status
- [x] Initial architecture
- [x] Health Check and API
- [x] Schema constraints
- [x] CP UI Tab (`Inteligência`)
- [ ] Large scale batching (future iteration)
