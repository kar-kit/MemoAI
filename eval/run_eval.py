"""MemoAI flashcard-generation eval.

  python eval/run_eval.py --host http://localhost:11434 --models gemma3:latest,qwen3:8b \
      --judge-model gemma4:12b-it-qat
  python eval/run_eval.py --dry-run          # no Ollama needed; exercises the whole pipeline

Writes eval/results/<run-id>/{runs.jsonl, summary.json, summary.md, human_labels.csv, human_labels_key.csv}.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import random
import sys
import time
from pathlib import Path
from typing import Dict, List

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from harness import ollama_chat_fn, run_deck  # noqa: E402
from metrics import summarise_runs  # noqa: E402

PRODUCTION_MODEL = "gemma3:latest"  # OLLAMA_CHAT_MODEL default in llm_service.py and the deployed .env


def load_corpus(only: List[str] | None = None) -> List[Dict]:
    manifest = json.loads((HERE / "corpus" / "manifest.json").read_text())
    items = []
    for it in manifest["items"]:
        if only and it["id"] not in only:
            continue
        it = dict(it)
        it["text"] = (HERE / "corpus" / it["file"]).read_text()
        items.append(it)
    return items


def fake_chat_fn(seed: int = 0):
    """Deterministic stand-in for Ollama used by --dry-run and the unit tests. Emits a mix of
    strict JSON, wrapped JSON, junk and near-duplicates so every metric path is exercised."""
    rng = random.Random(seed)

    def _call(messages, model):
        prompt = messages[-1]["content"]
        if not prompt.startswith("You generate flashcards"):
            return {"content": "Dry Run Deck", "prompt_eval_count": 50, "eval_count": 4, "eval_duration_ns": 1e7}
        mode = rng.choice(["strict", "strict", "wrapped", "junk"])
        cards = [{"front": f"What is concept {i}?", "back": f"Concept {i} is a dry run answer."} for i in range(rng.randint(3, 8))]
        cards.append({"front": "What is concept 0 ?", "back": "dup"})  # near-duplicate of card 0
        body = json.dumps({"cards": cards})
        content = {"strict": body, "wrapped": f"Sure! Here you go:\n```json\n{body}\n```", "junk": "I cannot do that."}[mode]
        return {"content": content, "prompt_eval_count": len(prompt) // 4, "eval_count": len(content) // 4, "eval_duration_ns": 5e8}

    return _call


def route(item: Dict, small: str, large: str, threshold_chars: int) -> str:
    """Candidate size-based router (NOT in the production backend, which always uses one model):
    short single-chunk inputs go to the small model, long inputs to the large one."""
    return small if len(item["text"]) <= threshold_chars else large


def fmt(v, pct=False, nd=1):
    if v is None:
        return "n/a"
    return f"{v * 100:.0f}%" if pct else f"{v:.{nd}f}"


def summary_table(summaries: Dict[str, Dict], judged: bool) -> str:
    head = ["Config", "Decks (err)", "Deck p50 s", "Deck p95 s", "Call p50 s", "Call p95 s", "Tok in/deck", "Tok out/deck",
            "Decode tok/s", "JSON strict", "JSON salvaged", "JSON failed", "Cards/requested", "Exact count", "Near-dup pairs/deck",
            "Low lexical support"]
    if judged:
        head += ["Judge: answerable", "Judge: consistent", "Judge: atomic", "Judge: non-trivial", "Judge: all four"]
    rows = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    for name, s in summaries.items():
        r = [f"`{name}`", f'{s["decks"]} ({s["deck_errors"]})', fmt(s["deck_latency_p50_s"]), fmt(s["deck_latency_p95_s"]),
             fmt(s["card_call_latency_p50_s"]), fmt(s["card_call_latency_p95_s"]), fmt(s["tokens_in_per_deck"], nd=0),
             fmt(s["tokens_out_per_deck"], nd=0), fmt(s["decode_tok_per_s"]), fmt(s["json_strict_rate"], True),
             fmt(s["json_salvaged_rate"], True), fmt(s["json_failed_rate"], True), fmt(s["count_ratio_mean"], nd=2),
             fmt(s["count_exact_rate"], True), fmt(s["near_dup_pairs_per_deck"]), fmt(s["low_support_card_rate"], True)]
        if judged:
            r += [fmt(s[k], True) for k in ("judge_answerable", "judge_consistent", "judge_atomic", "judge_non_trivial", "judge_all_four")]
        rows.append("| " + " | ".join(r) + " |")
    return "\n".join(rows)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="http://localhost:11434")
    ap.add_argument("--models", default=PRODUCTION_MODEL, help="comma-separated Ollama tags; each is forced for every item")
    ap.add_argument("--items", default="", help="comma-separated corpus ids (default: all)")
    ap.add_argument("--repeats", type=int, default=1)
    ap.add_argument("--judge-model", default="", help="optional Ollama tag for LLM-as-judge")
    ap.add_argument("--router", action="append", default=[], help="small=<tag>,large=<tag>,threshold_chars=<n>; simulates a size-based router from the forced-model runs (repeatable)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-runs", default="", help="skip generation; re-judge/re-summarise an existing runs.jsonl")
    ap.add_argument("--out", default=str(HERE / "results"))
    ap.add_argument("--run-id", default="")
    args = ap.parse_args(argv)

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    items = load_corpus([i for i in args.items.split(",") if i] or None)
    run_id = args.run_id or ("dryrun-" if args.dry_run else "") + dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out = Path(args.out) / run_id
    out.mkdir(parents=True, exist_ok=True)

    client = None
    if args.dry_run:
        chat_fn = fake_chat_fn()
        if args.judge_model:
            print("note: --judge-model is ignored in --dry-run", flush=True)
    else:
        from ollama import Client

        client = Client(host=args.host, timeout=600)
        chat_fn = ollama_chat_fn(args.host)
        print(f"ollama {client._client.get('/api/version').json().get('version')} at {args.host}", flush=True)

    runs: List[Dict] = []
    if args.from_runs:
        runs = [json.loads(line) for line in Path(args.from_runs).read_text().splitlines() if line.strip()]
        models = list(dict.fromkeys(r["model"] for r in runs))
        items = [it for it in items if it["id"] in {r["item"] for r in runs}]
    with (out / "runs.jsonl").open("w") as fh:
        for model in ([] if args.from_runs else models):
            if not args.dry_run:
                t0 = time.perf_counter()
                warm = client.chat(model=model, messages=[{"role": "user", "content": "Reply with: ok"}])
                print(f"[warm-up] {model} load {warm.get('load_duration', 0) / 1e9:.1f}s, wall {time.perf_counter() - t0:.1f}s", flush=True)
            for rep in range(args.repeats):
                for it in items:
                    r = run_deck(source_text=it["text"], requested=it["requested_card_count"], model=model, chat_fn=chat_fn)
                    r.update({"item": it["id"], "repeat": rep, "source_chars": len(it["text"])})
                    print(f"[{model}] {it['id']} rep{rep}: {r['cards_final']}/{r['requested']} cards, {r['deck_latency_s']:.1f}s, "
                          f"parse={[c.get('parse_status') for c in r['calls'] if c['kind'] == 'cards']} err={r['error']}", flush=True)
                    runs.append(r)
                    fh.write(json.dumps(r) + "\n")
                    fh.flush()
            if not args.dry_run:  # free VRAM before the next model
                client.generate(model=model, prompt="", keep_alive=0)

    judged = bool(args.judge_model) and not args.dry_run
    judge_probe = None
    if judged:
        from judge import judge_deck

        src = {it["id"]: it["text"] for it in items}
        for r in runs:
            try:
                r["judge"] = judge_deck(client, args.judge_model, src[r["item"]], r["cards"])
            except Exception as e:  # a dropped connection should not lose the whole run
                r["judge"] = {"scores": [], "parse_ok": False, "error": f"{type(e).__name__}: {e}"}
            print(f"[judge] {r['model']} {r['item']}: parse_ok={r['judge']['parse_ok']}", flush=True)
        probe = json.loads((HERE / "corpus" / "judge_probe.json").read_text())
        pj = judge_deck(client, args.judge_model, (HERE / "corpus" / probe["source"]).read_text(), probe["cards"])
        checks = [(c, k, v, s.get(k)) for c, s in zip(probe["cards"], pj["scores"]) for k, v in c["expect"].items()]
        caught = [x for x in checks if x[0].get("defect") and x[2] == 0]
        clean = [x for x in checks if not x[0].get("defect")]
        judge_probe = {
            "parse_ok": pj["parse_ok"],
            "defects_caught": f'{sum(1 for x in caught if x[3] == 0)}/{len(caught)}',
            "clean_cards_passed": f'{sum(1 for x in clean if x[3] == 1)}/{len(clean)}',
            "detail": [{"front": c["front"], "back": c["back"], "criterion": k, "expected": v, "judge": got, "defect": c.get("defect")} for c, k, v, got in checks],
        }
        print(f"[judge-probe] defects caught {judge_probe['defects_caught']}, clean criteria passed {judge_probe['clean_cards_passed']}", flush=True)
        client.generate(model=args.judge_model, prompt="", keep_alive=0)
    with (out / "runs.jsonl").open("w") as fh:
        for r in runs:
            fh.write(json.dumps(r) + "\n")

    summaries = {m: summarise_runs([r for r in runs if r["model"] == m]) for m in models}
    router_note = ""
    for spec in args.router:
        cfg = dict(kv.split("=", 1) for kv in spec.split(","))
        small, large, thr = cfg["small"], cfg["large"], int(cfg.get("threshold_chars", 4000))
        picked = []
        for it in items:
            choice = route(it, small, large, thr)
            picked += [r for r in runs if r["model"] == choice and r["item"] == it["id"]]
        name = f"router(small={small},large={large},<= {thr} chars)"
        summaries[name] = summarise_runs(picked)
        router_note += (f"\nRouter row is simulated offline from the forced-model runs: items with <= {thr} source chars "
                       f"use `{small}`, longer items use `{large}`. It is a candidate policy, not code that exists in the backend.\n")

    per_item = ["| Model | Item | Requested | Final cards | Deck s | LLM calls | JSON statuses | Title |", "|---|---|---|---|---|---|---|---|"]
    for r in runs:
        st = ",".join(c.get("parse_status", "") for c in r["calls"] if c["kind"] == "cards")
        per_item.append(f'| `{r["model"]}` | {r["item"]} | {r["requested"]} | {r["cards_final"]} | {r["deck_latency_s"]:.1f} | '
                        f'{len(r["calls"])} | {st} | {(r.get("title") or "").replace("|", "/")} |')

    (out / "summary.json").write_text(json.dumps({"run_id": run_id, "host": args.host, "models": models, "judge_model": args.judge_model or None,
                                                  "items": [i["id"] for i in items], "repeats": args.repeats, "judge_probe": judge_probe, "summaries": summaries}, indent=2))
    md = (f"# Run {run_id}\n\nCommand: `python eval/run_eval.py {' '.join(argv if argv is not None else sys.argv[1:])}`\n\n"
          f"{summary_table(summaries, judged)}\n{router_note}"
          + (f"\nJudge probe (`{args.judge_model}` on 9 hand-labelled cards): planted defects caught {judge_probe['defects_caught']}, "
             f"clean-card criteria passed {judge_probe['clean_cards_passed']}.\n" if judge_probe else "") + f"\n## Per deck\n\n" + "\n".join(per_item) + "\n")
    (out / "summary.md").write_text(md)

    # Blind human-labelling sheet: shuffled cards, model hidden in a separate key file.
    rows = [(r["model"], r["item"], r["repeat"], i, c) for r in runs for i, c in enumerate(r["cards"])]
    random.Random(7).shuffle(rows)
    with (out / "human_labels.csv").open("w", newline="") as f, (out / "human_labels_key.csv").open("w", newline="") as k:
        w, kw = csv.writer(f), csv.writer(k)
        w.writerow(["card_uid", "item", "front", "back", "answerable_0_1", "consistent_0_1", "atomic_0_1", "non_trivial_0_1", "notes"])
        kw.writerow(["card_uid", "model", "item", "repeat", "card_index"])
        for n, (model, item, rep, i, c) in enumerate(rows):
            uid = f"c{n:04d}"
            w.writerow([uid, item, c["front"], c["back"], "", "", "", "", ""])
            kw.writerow([uid, model, item, rep, i])
    print(md)
    print(f"wrote {out}")
    return out


if __name__ == "__main__":
    main()
