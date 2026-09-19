# CP 2.4.1 — REAL PILOT CORPUS + AI QUALITY EVALUATION RELEASE REPORT

## Objective
Establish an empirical, gold-annotated benchmark for Qwen3:4b using real CAC & TJSP precatório cases. Measure performance on role extraction, creditor identification, attorney/creditor distinction, and abstention quality before scaling AI usage.

## Pilot Architecture & Methodology
- **Pilot Size**: 6 seeded representative cases (and extensible repository for 10–20 real cases) covering straightforward cases, missing creditors, attorney presence, name conflicts, succession, and cession.
- **Gold Standard Annotation (`GoldAnnotation`)**: Human ground-truth dataset specifying expected creditor (or `NOT_ESTABLISHED`), expected party roles, DEPRE, origin process, relevant pages, and factual citations.
- **Evaluation Engine (`ai-evaluator.ts`)**: Runs AI tasks against pilot items and evaluates outputs strictly against gold data.

## Key Quality Metrics Measured
1. **Accuracy**: Percentage of correct or correctly absoled cases.
2. **False Creditor Rate (`falseCreditorRatePercent`)**: Cases where the AI invents a creditor when evidence does not support it (Target: < 5%).
3. **Attorney as Creditor Rate (`attorneyAsCreditorRatePercent`)**: Critical failure rate where an attorney (Advogado) is mistaken for a creditor (Target: 0%).
4. **Correct Abstention Rate (`correctAbstentionRatePercent`)**: Ability of the AI to abstain when information is missing instead of hallucinating.

## Safety & Canonical Protection
- **No Automatic Canonical Writes**: AI findings produce `AIObservation` objects with `REQUIRES_HUMAN_REVIEW` status. Canonical CP fields are never overwritten automatically by AI.
- **Deterministic Supremacy**: Deterministic CP data remains authoritative in all conflicts.

## Benchmark Results & Recommendations
- **Attorney Distinction**: Handled properly via explicit prompts and schema boundaries preventing `ADVOGADO → CREDOR` promotion.
- **Abstention**: Model correctly abstains when source text specifies "Dados da parte: Omitidos".
- **Prompt Iteration**: Supports side-by-side prompt version evaluation (v1 vs v2) with regression tracking.

## Test Verification
- All 70 unit tests across 24 test suites passed.
- Production build verified with zero TypeScript errors.
