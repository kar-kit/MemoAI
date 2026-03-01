# app/db/client.py
from pymongo import MongoClient
from pymongo.server_api import ServerApi
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "memoai")

if not MONGODB_URI:
    raise RuntimeError("❌ MONGODB_URI is not set")

client = MongoClient(
    MONGODB_URI,
    server_api=ServerApi("1"),
)

db = client[DB_NAME]


def test_connection() -> None:
    """Ping MongoDB and raise if it fails."""
    client.admin.command("ping")
    print("✅ MongoDB ping OK")


def ensure_indexes():
    """
    IMPORTANT:
    - card_reviews must allow multiple reviews per (uid, deck_id, card_id)
      so we MUST NOT have a unique index on (uid, deck_id, card_id).
    - We also proactively drop any existing unique index that matches that key pattern.
    """

    # 1) Drop legacy unique index if it exists (name may vary)
    try:
        for idx in db.card_reviews.list_indexes():
            keys = list(idx["key"].items())
            is_target = keys == [("uid", 1), ("deck_id", 1), ("card_id", 1)]
            if is_target and idx.get("unique", False):
                db.card_reviews.drop_index(idx["name"])
                print(f"🧹 Dropped legacy UNIQUE index: {idx['name']}")
    except Exception as e:
        # Don't crash startup for index cleanup issues
        print(f"⚠️ Index cleanup warning: {e}")

    # 2) Create NON-unique indexes that support your queries
    # Fast lookups by deck
    db.card_reviews.create_index([("uid", 1), ("deck_id", 1), ("rated_at", -1)])
    # Fast “latest rating per card” and per-card history
    db.card_reviews.create_index(
        [("uid", 1), ("deck_id", 1), ("card_id", 1), ("rated_at", -1)]
    )

    # Optional: if you still do any queries just by uid+deck_id
    db.card_reviews.create_index([("uid", 1), ("deck_id", 1)])

    # One active session per user+deck
    db.study_sessions.create_index([("uid", 1), ("deck_id", 1)], unique=True)
    db.study_sessions.create_index([("uid", 1), ("deck_id", 1), ("updated_at", -1)])

    # -----------------------------
    # SM-2 scheduling state
    # One state per (uid, deck_id, card_id)
    # -----------------------------
    db.card_states.create_index(
        [("uid", 1), ("deck_id", 1), ("card_id", 1)],
        unique=True,
    )
    # Fast “what’s due next”
    db.card_states.create_index([("uid", 1), ("deck_id", 1), ("next_due_at", 1)])


if __name__ == "__main__":
    test_connection()
