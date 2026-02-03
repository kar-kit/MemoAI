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


if __name__ == "__main__":
    test_connection()
