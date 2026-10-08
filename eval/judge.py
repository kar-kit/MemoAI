"""Optional LLM-as-judge pass. Scores are a cheap second opinion, not ground truth:
a 4-12B local judge shares failure modes with the generators (and same-family bias when the
judge and generator come from the same family). Calibrate against human_labels.csv before quoting."""
from __future__ import annotations

import json
from typing import Dict, List

CRITERIA = {
    "answerable": "The answer on the back can be found in, or directly follows from, the SOURCE.",
    "consistent": "Nothing on the card contradicts the SOURCE or is factually wrong.",
    "atomic": "The card tests one fact or idea, not several bundled together.",
    "non_trivial": "Answering needs real recall of the material; the answer is not given away by the question and is not a vague or meaningless question.",
}


def build_prompt(source: str, cards: List[Dict]) -> str:
    crit = "\n".join(f'- "{k}": {v}' for k, v in CRITERIA.items())
    numbered = "\n".join(f'{i + 1}. Q: {c["front"]}\n   A: {c["back"]}' for i, c in enumerate(cards))
    return (
        "You are grading flashcards that were generated from lecture material.\n"
        "Grade every card on each criterion with 1 (meets it) or 0 (does not). Be strict.\n\n"
        f"Criteria:\n{crit}\n\n"
        "Return JSON only, in this shape, one entry per card in the same order:\n"
        '{"scores": [{"i": 1, "answerable": 1, "consistent": 1, "atomic": 1, "non_trivial": 1, "note": "short reason if any 0"}]}\n\n'
        f"--- SOURCE START ---\n{source}\n--- SOURCE END ---\n\n"
        f"--- CARDS ---\n{numbered}\n"
    )


def judge_deck(client, judge_model: str, source: str, cards: List[Dict]) -> Dict:
    if not cards:
        return {"scores": [], "parse_ok": True}
    resp = client.chat(
        model=judge_model,
        messages=[{"role": "user", "content": build_prompt(source, cards)}],
        format="json",
        options={"temperature": 0, "num_ctx": 8192},
        # Thinking must be off: with format="json", gemma4/qwen3 spend the budget in the thinking
        # channel and return empty content (observed: 6.9k tokens, 181 s, no JSON).
        think=False,
    )
    raw = resp["message"]["content"]
    try:
        scores = json.loads(raw).get("scores", [])
        scores = [s for s in scores if isinstance(s, dict)]
        ok = len(scores) == len(cards)
    except Exception:
        scores, ok = [], False
    return {"scores": scores if ok else [], "parse_ok": ok, "raw_preview": raw[:300]}
