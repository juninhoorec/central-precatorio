# CP 2.3.4 — Creditor Resolution Engine Release Report

## Objective
The goal of the CP 2.3.4 phase was to bridge the gap between "having a real precatory" and "knowing who the beneficiary/creditor is", using deterministic public official sources without making arbitrary guesses.

## Outcomes
- **Batch Resolution Engine**: Created `creditor-resolution-batch.ts` to allow processing 801/911 records through deterministic matching.
- **Official Sources Investigated**: 
  - Pesquisa de Precatórios (TJSP) - identified as requiring CAPTCHA, mapped to `ASSISTED_CAPTURE`.
  - Credores (TJSP) - analyzed for deterministic matches.
- **States & Confidence**: Implemented robust states like `CREDOR_IDENTIFICADO`, `CREDOR_CORROBORADO`, `CREDOR_PARCIALMENTE_IDENTIFICADO`, `POSSÍVEL_CORRESPONDÊNCIA`, and `CONFLITO_DE_IDENTIDADE`.
- **Identity Split**: Separated original creditor identity from the current holder status (e.g. `CURRENT_HOLDER_NOT_CONFIRMED`).
- **Tests**: Enhanced `creditor-resolution.test.ts` and created `creditor-resolution-batch.test.ts` to simulate and validate the resolution logic and batch jobs.
- **UI Updates**: Added "Identidade do Credor" block to the `OperationalCase` component with resolved states, next actions, and last validation dates.

## Resolution Results
For the simulated/regression corpus (representing the 801/911 real reports):
- Processed: 100%
- Creditor Identified: Supported where explicit beneficiary label and exact DEPRE matched.
- Assisted Required: Routed properly for sources hidden behind CAPTCHA constraints.

## Next Steps (CP 2.4)
- Connect Qwen/Ollama for AI-assisted semantic reasoning of roles where deterministic match falls short.
- Automate extraction of creditor evidence text.
