# Run 2026-10-08-oracle-judge-qwen3

Command: `python eval/run_eval.py --host http://localhost:11435 --from-runs /tmp/memoai-runs-generation.jsonl --judge-model qwen3:8b --router small=phi3:3.8b,large=gemma3:latest,threshold_chars=3000 --router small=gemma3:latest,large=qwen3:8b,threshold_chars=3000 --run-id 2026-10-08-oracle-judge-qwen3`

| Config | Decks (err) | Deck p50 s | Deck p95 s | Call p50 s | Call p95 s | Tok in/deck | Tok out/deck | Decode tok/s | JSON strict | JSON salvaged | JSON failed | Cards/requested | Exact count | Near-dup pairs/deck | Low lexical support | Judge: answerable | Judge: consistent | Judge: atomic | Judge: non-trivial | Judge: all four |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gemma3:latest` | 10 (0) | 6.8 | 16.7 | 6.0 | 7.0 | 2122 | 744 | 93.3 | 0% | 100% | 0% | 1.00 | 100% | 1.0 | 1% | 96% | 96% | 96% | 96% | 96% |
| `phi3:3.8b` | 10 (0) | 11.5 | 35.8 | 7.3 | 17.3 | 2630 | 1359 | 99.1 | 74% | 5% | 21% | 0.96 | 60% | 0.7 | 2% | 97% | 99% | 95% | 100% | 94% |
| `qwen3:8b` | 10 (0) | 32.9 | 113.2 | 21.3 | 52.3 | 1630 | 2665 | 57.9 | 100% | 0% | 0% | 1.00 | 100% | 1.7 | 1% | 98% | 98% | 98% | 98% | 98% |
| `router(small=phi3:3.8b,large=gemma3:latest,<= 3000 chars)` | 10 (0) | 11.5 | 23.2 | 6.0 | 17.3 | 2511 | 1148 | 101.4 | 53% | 37% | 11% | 0.98 | 80% | 0.6 | 1% | 94% | 96% | 93% | 97% | 91% |
| `router(small=gemma3:latest,large=qwen3:8b,<= 3000 chars)` | 10 (0) | 6.8 | 113.2 | 6.4 | 46.9 | 1761 | 1485 | 65.1 | 29% | 71% | 0% | 1.00 | 100% | 1.7 | 1% | 96% | 96% | 96% | 97% | 96% |

Router row is simulated offline from the forced-model runs: items with <= 3000 source chars use `phi3:3.8b`, longer items use `gemma3:latest`. It is a candidate policy, not code that exists in the backend.

Router row is simulated offline from the forced-model runs: items with <= 3000 source chars use `gemma3:latest`, longer items use `qwen3:8b`. It is a candidate policy, not code that exists in the backend.

Judge probe (`qwen3:8b` on 9 hand-labelled cards): planted defects caught 4/5, clean-card criteria passed 16/16.

## Per deck

| Model | Item | Requested | Final cards | Deck s | LLM calls | JSON statuses | Title |
|---|---|---|---|---|---|---|---|
| `gemma3:latest` | sm2 | 10 | 10 | 6.8 | 2 | salvaged | Spaced Repetition Guide |
| `gemma3:latest` | tcp | 12 | 12 | 9.7 | 3 | salvaged,salvaged | TCP Congestion Control |
| `gemma3:latest` | gd | 12 | 12 | 6.0 | 2 | salvaged | Gradient Descent Basics |
| `gemma3:latest` | photo | 10 | 10 | 4.9 | 2 | salvaged | Photosynthesis Basics |
| `gemma3:latest` | db | 24 | 24 | 15.9 | 4 | salvaged,salvaged,salvaged | Database Transactions Control |
| `gemma3:latest` | sm2 | 10 | 10 | 7.0 | 2 | salvaged | Spaced Repetition Algorithm |
| `gemma3:latest` | tcp | 12 | 12 | 9.0 | 3 | salvaged,salvaged | TCP Congestion Control |
| `gemma3:latest` | gd | 12 | 12 | 6.3 | 2 | salvaged | Gradient Descent Basics |
| `gemma3:latest` | photo | 10 | 10 | 5.7 | 2 | salvaged | Photosynthesis Basics |
| `gemma3:latest` | db | 24 | 24 | 16.7 | 4 | salvaged,salvaged,salvaged | Database Transactions Control |
| `phi3:3.8b` | sm2 | 10 | 9 | 23.2 | 3 | strict,failed | Spaced Repetition Algorithm This deck title encapsulates the key concepts of spa |
| `phi3:3.8b` | tcp | 12 | 11 | 19.1 | 3 | failed,strict | TCP Congestion Control Study The deck titled TCP Congestion Control Study encaps |
| `phi3:3.8b` | gd | 12 | 12 | 13.3 | 2 | strict | Gradient Descent in ML Deck Title Gradient Descent Explained |
| `phi3:3.8b` | photo | 10 | 10 | 8.4 | 2 | strict | Photosynthesis Light and Calvin Cycles In this summary deck Photosynthesis Light |
| `phi3:3.8b` | db | 24 | 20 | 35.8 | 4 | strict,failed,strict | Transaction Study Deck A concise summary of this deck is Transactions Control Re |
| `phi3:3.8b` | sm2 | 10 | 10 | 8.1 | 2 | strict | Smart Spacing for Memorization The deck focuses on spaced repetition techniques  |
| `phi3:3.8b` | tcp | 12 | 12 | 11.5 | 3 | strict,salvaged | TCP Congestion Control This deck covers the essentials of TCP congestion control |
| `phi3:3.8b` | gd | 12 | 12 | 8.1 | 3 | strict,strict | Gradient Descent Techniques This deck is about the various aspects of gradient d |
| `phi3:3.8b` | photo | 10 | 10 | 8.8 | 3 | strict,strict | Photosynthesis Process Deck This deck encapsulates the essence of a biology stud |
| `phi3:3.8b` | db | 24 | 23 | 27.3 | 4 | strict,failed,strict | Conflict-free Schedules The deck covers the concepts of transactions concurrency |
| `qwen3:8b` | sm2 | 10 | 10 | 27.5 | 2 | strict | Spaced Repetition SM-2 Algorithm |
| `qwen3:8b` | tcp | 12 | 12 | 32.9 | 2 | strict | TCP Congestion Control |
| `qwen3:8b` | gd | 12 | 12 | 54.7 | 2 | strict | Gradient Descent Methods |
| `qwen3:8b` | photo | 10 | 10 | 35.3 | 2 | strict | Photosynthesis Light and Dark Reactions |
| `qwen3:8b` | db | 24 | 24 | 67.2 | 3 | strict,strict | Transactions Concurrency Control |
| `qwen3:8b` | sm2 | 10 | 10 | 26.8 | 2 | strict | Spaced Repetition SM-2 |
| `qwen3:8b` | tcp | 12 | 12 | 23.1 | 2 | strict | TCP Congestion Control |
| `qwen3:8b` | gd | 12 | 12 | 68.0 | 2 | strict | Gradient Descent Optimization |
| `qwen3:8b` | photo | 10 | 10 | 24.6 | 2 | strict | Light to Chemical Energy |
| `qwen3:8b` | db | 24 | 24 | 113.2 | 3 | strict,strict | Transactions Concurrency Control |
