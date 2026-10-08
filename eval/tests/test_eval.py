import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))

from harness import dgs, run_deck  # noqa: E402
from metrics import json_parse_status, near_duplicate_pairs, percentile  # noqa: E402
import run_eval  # noqa: E402


def test_percentile_nearest_rank():
    assert percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) == 5
    assert percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95) == 10
    assert percentile([], 50) is None


def test_parse_status_uses_production_extractor():
    body = json.dumps({"cards": [{"front": "a", "back": "b"}]})
    assert json_parse_status(body, dgs._extract_json_object) == "strict"
    assert json_parse_status("Here:\n" + body, dgs._extract_json_object) == "salvaged"
    assert json_parse_status("no json here", dgs._extract_json_object) == "failed"
    assert json_parse_status('{"items": []}', dgs._extract_json_object) == "failed"


def test_near_duplicates_catch_what_exact_dedupe_misses():
    fronts = ["What is the ease factor in SM-2?", "What is the ease factor in SM2?", "Who created SM-2?"]
    pairs = near_duplicate_pairs(fronts)
    assert [(i, j) for i, j, *_ in pairs] == [(0, 1)]
    assert len(dgs._dedupe_cards([{"front": f, "back": "x"} for f in fronts])) == 3


def test_run_deck_restores_backend_and_counts():
    original_chat = dgs.chat
    r = run_deck(source_text="Concept text " * 50, requested=10, model="fake", chat_fn=run_eval.fake_chat_fn(1))
    assert dgs.chat is original_chat
    assert r["error"] is None
    assert r["cards_final"] <= r["target_after_clamp"]
    assert any(c["kind"] == "title" for c in r["calls"])
    assert all("parse_status" in c for c in r["calls"] if c["kind"] == "cards")


def test_dry_run_end_to_end(tmp_path):
    out = run_eval.main(["--dry-run", "--models", "fake-a,fake-b", "--router", "small=fake-a,large=fake-b,threshold_chars=3000",
                         "--out", str(tmp_path), "--run-id", "t"])
    summary = json.loads((out / "summary.json").read_text())
    assert set(summary["summaries"]) >= {"fake-a", "fake-b"}
    assert any(k.startswith("router(") for k in summary["summaries"])
    with (out / "human_labels.csv").open() as f:
        header = next(csv.reader(f))
    assert "model" not in header  # labelling sheet is blind
