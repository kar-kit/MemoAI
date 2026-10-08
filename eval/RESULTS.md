# MemoAI generation eval: results

**Run date:** 8 October 2026
**Code under test:** `rest-backend/app/services/deck_generation_service.py` at commit `65de8a2` (imported unchanged; only Mongo writes and the `chat` call are wrapped, see `harness.py`)
**Hardware:** Proxmox VM with an RTX 3060 12 GB passed through, 2 vCPU, 9.6 GB RAM, Ollama 0.34.0, default model options (as in production: no temperature, seed or context override; Ollama reported a 4096-token context)
**Corpus:** 5 self-written lecture texts, 1.8k to 9.5k characters, CC BY 4.0 (`corpus/manifest.json`). One is formatted like `python-pptx` slide extraction, and one is long enough to be split into 2 chunks.
**Repeats:** 2 per model per item, so each model row covers 10 decks. Sampling is not seeded, matching production.

| Model tag | Digest | Size / quant | Role |
|---|---|---|---|
| `gemma3:latest` | `a2af6cc3eb7f` | 4.3B Q4_K_M | **Production** (`OLLAMA_CHAT_MODEL` default and deployed config) |
| `phi3:3.8b` | `4f2222927938` | 3.8B Q4_0 | Small-model baseline (TinyLlama is not installed on the server, and nothing was pulled for this run) |
| `qwen3:8b` | `500a1f067a9f` | 8.2B Q4_K_M | Larger-model baseline (thinking on by default, because production does not set `think`) |
| `qwen3:8b`, `ibm/granite4.1:8b` | `500a1f067a9f`, `444af1c4b2fe` | 8.2B / 8.8B | LLM judges (thinking off, temperature 0, JSON mode) |

## Commands

```bash
# generation (each model is forced for every item; the warm-up call is excluded from timings)
python eval/run_eval.py --host http://localhost:11435 --models gemma3:latest,phi3:3.8b,qwen3:8b --repeats 2 \
  --router small=phi3:3.8b,large=gemma3:latest,threshold_chars=3000 \
  --router small=gemma3:latest,large=qwen3:8b,threshold_chars=3000 --run-id 2026-10-08-oracle
# judge passes over the saved generations (two judges, so their disagreement is visible)
python eval/run_eval.py --host http://localhost:11435 --from-runs eval/results/2026-10-08-oracle/runs.jsonl \
  --judge-model qwen3:8b <same --router flags> --run-id 2026-10-08-oracle-judge-qwen3
python eval/run_eval.py --host http://localhost:11435 --from-runs eval/results/2026-10-08-oracle/runs.jsonl \
  --judge-model ibm/granite4.1:8b <same --router flags> --run-id 2026-10-08-oracle-judge-granite
```

`localhost:11435` was an SSH tunnel to the Ollama server. Raw per-deck records, every LLM call's token counts and timings, and all generated cards are in `results/2026-10-08-oracle*/runs.jsonl`.

## Results

p95 is nearest-rank over 10 decks, so it equals the slowest deck. Treat it as a worst case, not a stable tail estimate. "Call" means one card-generation LLM call; a deck makes 1 to 3 of these plus a title call.

| Config | Deck p50 s | Deck p95 s | Call p50 s | Call p95 s | Tok in / deck | Tok out / deck | JSON strict | JSON salvaged by regex | JSON failed (cards lost) | Exact card count |
|---|---|---|---|---|---|---|---|---|---|---|
| **`gemma3:latest` (production)** | **6.8** | **16.7** | 6.0 | 7.0 | 2,122 | 744 | 0% | 100% | 0% | 10/10 |
| `phi3:3.8b` | 11.5 | 35.8 | 7.3 | 17.3 | 2,630 | 1,359 | 74% | 5% | 21% | 6/10 |
| `qwen3:8b` | 32.9 | 113.2 | 21.3 | 52.3 | 1,630 | 2,665 | 100% | 0% | 0% | 10/10 |
| Router A, simulated: phi3 for ≤3k chars, else gemma3 | 11.5 | 23.2 | 6.0 | 17.3 | 2,511 | 1,148 | 53% | 37% | 11% | 8/10 |
| Router B, simulated: gemma3 for ≤3k chars, else qwen3 | 6.8 | 113.2 | 6.4 | 46.9 | 1,761 | 1,485 | 29% | 71% | 0% | 10/10 |

Quality signals (none of these is ground truth):

| Config | Cards | Judge qwen3: all 4 criteria pass | Judge granite: all 4 pass | Near-dup pairs flagged (confirmed by hand) |
|---|---|---|---|---|
| `gemma3:latest` | 136 | 96% | 98% | 10 (3) |
| `phi3:3.8b` | 129 | 94% | 96% | 7 (5) |
| `qwen3:8b` | 136 | 98% | 100% | 17 (0) |

Judge calibration on 9 hand-labelled probe cards (`corpus/judge_probe.json`): qwen3 caught 4 of 5 planted defects and granite caught 3 of 5. Both passed all 16 clean-card criteria. The two judges agreed on pass/fail for 388 of 401 cards, but only 6 cards were flagged by both.

## What the numbers say

1. **The production choice holds up on this corpus.** `gemma3:latest` had the lowest latency, never lost a chunk, and hit the requested card count on all 10 decks. `qwen3:8b` produced cleaner JSON (100% strict) but was 4.8x slower at p50 and generated 3.6x the output tokens. 78% of its output, by characters, was thinking text that the app throws away, because `llm_service.chat` never sets `think=False`.
2. **Neither routing policy beat the single production model here.** Sending short inputs to the small model (Router A) added latency, because phi3 is wordier and retries via top-up. It also lost cards to parse failures (11% of calls) and missed the requested count on 2 of 10 decks. Router B matches gemma3 on short inputs and inherits qwen3's 113 s worst case on the long one. The backend does not implement routing at all (see Limitations), so these rows only test whether routing would be worth building. On this evidence it would not be.
3. **Structured output depends on a regex.** gemma3 wraps every reply in a ```` ```json ```` fence, so a strict `json.loads` would fail 100% of the time. All production cards survive only because `_extract_json_object` regex-extracts the first `{...}`. phi3's 21% failures were malformed JSON; one reply had a corrupted key (`clf:` where `"front":` belonged). The parse failure is logged and the chunk is silently dropped, so the user just gets fewer cards.

## Error analysis (read by hand)

- **A factual error shared by all three models.** In the `db` text, "no-force" and "steal" are defined in adjacent sentences. gemma3 (both repeats) answered "What is a no-force policy?" with the definition of steal. qwen3 (both repeats) answered with no-steal. So the production model put a wrong card in the deck on both runs. That gives 4 wrong cards and 8 chances for a judge to flag them, and the judges flagged 3 correctly: both judges caught gemma3 repeat 1, and the qwen3 judge caught qwen3 repeat 0. Both judges passed qwen3 repeat 1. On gemma3 repeat 0, both judges passed the wrong card and attached their "confuses steal with no-force" note to the neighbouring "What does a checkpoint do?" card, whose answer is correct. That is a score-alignment failure on a 24-card deck. Conclusion: neither the judge scores nor their per-card placement can be trusted without a human reading them.
- **Answer does not match question.** gemma3 answered "What is the role of RuBisCO?" with "the most abundant protein on Earth" (repeat 0).
- **Invented structure.** phi3 produced "three main stages of photosynthesis" with a third stage that the source does not have.
- **Near-duplicates.** Production dedupe is exact-match only, so pairs like "What is write-ahead logging (WAL)?" / "What is write-ahead logging?" (gemma3) and "What are the ACID properties of a transaction / of transactions?" (phi3) reach the user. The fuzzy detector here is poor: of 34 flagged pairs, only 8 were real duplicates on manual review. The rest were deliberate contrast cards ("learning rate too small" vs "too large"). That is why the table reports both counts.
- **Title prompt ignored by phi3.** On 10 of 10 decks phi3 wrote a sentence instead of "max 4 words". The backend's `[:80]` cut then stores a truncated sentence as the deck title.

## Limitations of this eval

- **The backend has no multi-model router.** Every LLM call (intent classification, card generation and title) goes to the single `OLLAMA_CHAT_MODEL` (`gemma3:latest`). `OLLAMA_TOOL_MODEL` / `tool_call()` is defined but never called. The router rows above are simulated offline by choosing, per input, which forced-model run to count.
- 5 texts × 2 repeats is a smoke-scale benchmark. Differences of a few percentage points in judge scores are noise. The latency and JSON-failure gaps are large enough to read; the quality gaps are not.
- The corpus is self-written, clean prose. Real lecture PDFs bring extraction noise (headers, page numbers, broken equations), which this eval does not cover. `file_parser.py` was not exercised; text goes straight into `generate_deck_from_text_chunked`.
- The lexical-support metric (share of answer words found in the source) flagged only 1 to 2% of cards in every config and missed the no-force error. It is reported in `summary.md` but is not a useful discriminator.
- No human labels yet. `results/2026-10-08-oracle/human_labels.csv` is a blind, shuffled sheet of all 401 cards, with model identities in `human_labels_key.csv`. Until it is filled in, the judge columns are uncalibrated.
- The 3060 is shared with other homelab services. A 12B judge (`gemma4:12b-it-qat`) was tried first: with thinking on it returned empty JSON, and on a later call the VM's 9.6 GB of RAM ran out and the kernel OOM-killed `llama-server` (systemd restarted Ollama at 18:11). Those partial judge results were discarded.
- There is no monetary cost column, because self-hosted inference has no per-token bill. Tokens and GPU-seconds per deck are the cost proxy.
