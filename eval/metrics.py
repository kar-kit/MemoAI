"""Pure metric helpers for the MemoAI flashcard eval. No network, no backend imports."""
from __future__ import annotations

import json
import math
import re
from difflib import SequenceMatcher
from itertools import combinations
from typing import Dict, Iterable, List, Optional, Sequence

STOPWORDS = set(
    """a an the and or but if then than of to in on at by for with from into onto over under is are was were be been
    being it its this that these those as which who whom what when where why how not no do does did done can could
    may might must should would will shall has have had having there their they them he she his her we our you your
    i me my so such also each every any all some most more less very just only about after before between during
    while because until both either neither other same own too out up down off again further once here""".split()
)


def percentile(values: Sequence[float], pct: float) -> Optional[float]:
    """Nearest-rank percentile (no interpolation). Returns None for an empty list."""
    vals = sorted(v for v in values if v is not None)
    if not vals:
        return None
    rank = max(1, math.ceil(pct / 100.0 * len(vals)))
    return vals[rank - 1]


def mean(values: Iterable[float]) -> Optional[float]:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def json_parse_status(raw: str, salvage_fn) -> str:
    """'strict' if the whole reply is valid JSON with a cards list, 'salvaged' if the
    production extractor recovers a cards list from wrapped text, 'failed' otherwise."""
    raw = (raw or "").strip()
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict) and isinstance(obj.get("cards"), list):
            return "strict"
    except Exception:
        pass
    obj = salvage_fn(raw)
    if isinstance(obj, dict) and isinstance(obj.get("cards"), list):
        return "salvaged"
    return "failed"


def _norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def content_tokens(s: str) -> List[str]:
    return [t for t in _norm(s).split() if len(t) > 2 and t not in STOPWORDS]


def near_duplicate_pairs(fronts: Sequence[str], ratio: float = 0.8, jaccard: float = 0.7) -> List[tuple]:
    """Pairs of card fronts that the production exact-match dedupe lets through but that
    are near-identical: character similarity >= ratio OR content-word Jaccard >= jaccard."""
    pairs = []
    toks = [set(content_tokens(f)) for f in fronts]
    normed = [_norm(f) for f in fronts]
    for i, j in combinations(range(len(fronts)), 2):
        if not normed[i] or not normed[j]:
            continue
        r = SequenceMatcher(None, normed[i], normed[j]).ratio()
        union = toks[i] | toks[j]
        jac = len(toks[i] & toks[j]) / len(union) if union else 0.0
        if r >= ratio or jac >= jaccard:
            pairs.append((i, j, round(r, 3), round(jac, 3)))
    return pairs


def lexical_support(back: str, source: str) -> Optional[float]:
    """Share of the answer's content words that appear in the source text. A cheap proxy
    for 'answerable from source': high overlap does not prove correctness and low overlap
    does not prove hallucination (paraphrase), so treat it as a screening signal only."""
    toks = content_tokens(back)
    if not toks:
        return None
    src = set(content_tokens(source))
    return sum(1 for t in toks if t in src) / len(toks)


def summarise_runs(runs: List[Dict]) -> Dict:
    """Aggregate a list of per-deck run records (all for the same config)."""
    ok = [r for r in runs if not r.get("error")]
    calls = [c for r in ok for c in r["calls"]]
    card_calls = [c for c in calls if c["kind"] == "cards"]
    statuses = [c["parse_status"] for c in card_calls]
    n_calls = len(statuses) or 1
    deck_lat = [r["deck_latency_s"] for r in ok]
    call_lat = [c["latency_s"] for c in card_calls]
    out_tok = sum(c.get("eval_count") or 0 for c in calls)
    gen_s = sum((c.get("eval_duration_ns") or 0) for c in calls) / 1e9
    support = [s for r in ok for s in r.get("lexical_support", []) if s is not None]
    judge = [j for r in ok for j in (r.get("judge") or {}).get("scores", [])]

    def judge_rate(key):
        vals = [j.get(key) for j in judge if j.get(key) in (0, 1)]
        return mean(vals)

    return {
        "decks": len(runs),
        "deck_errors": len(runs) - len(ok),
        "deck_latency_p50_s": percentile(deck_lat, 50),
        "deck_latency_p95_s": percentile(deck_lat, 95),
        "card_call_latency_p50_s": percentile(call_lat, 50),
        "card_call_latency_p95_s": percentile(call_lat, 95),
        "llm_calls": len(calls),
        "tokens_in_per_deck": mean([sum(c.get("prompt_eval_count") or 0 for c in r["calls"]) for r in ok]),
        "tokens_out_per_deck": mean([sum(c.get("eval_count") or 0 for c in r["calls"]) for r in ok]),
        "decode_tok_per_s": (out_tok / gen_s) if gen_s else None,
        "json_strict_rate": statuses.count("strict") / n_calls if statuses else None,
        "json_salvaged_rate": statuses.count("salvaged") / n_calls if statuses else None,
        "json_failed_rate": statuses.count("failed") / n_calls if statuses else None,
        "cards_final_mean": mean([r["cards_final"] for r in ok]),
        "count_ratio_mean": mean([r["cards_final"] / r["requested"] for r in ok if r["requested"]]),
        "count_exact_rate": mean([1.0 if r["cards_final"] == r["requested"] else 0.0 for r in ok]),
        "exact_dupes_removed": sum(r["exact_dupes_removed"] for r in ok),
        "near_dup_pairs_per_deck": mean([len(r["near_dup_pairs"]) for r in ok]),
        "lexical_support_mean": mean(support),
        "low_support_card_rate": mean([1.0 if s < 0.5 else 0.0 for s in support]),
        "judged_cards": len(judge),
        "judge_answerable": judge_rate("answerable"),
        "judge_consistent": judge_rate("consistent"),
        "judge_atomic": judge_rate("atomic"),
        "judge_non_trivial": judge_rate("non_trivial"),
        "judge_all_four": mean([1.0 if all(j.get(k) == 1 for k in ("answerable", "consistent", "atomic", "non_trivial")) else 0.0 for j in judge]),
    }
