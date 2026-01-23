from pymongo import MongoClient
from pymongo.server_api import ServerApi
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "memoai")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is not set")

# Create Mongo client (singleton)
client = MongoClient(
    MONGODB_URI,
    server_api=ServerApi("1"),
)

# Expose database handle
db = client[DB_NAME]


def test_connection() -> None:
    """Manual connection test (used by pipenv run dbtest)."""
    client.admin.command("ping")
    print("✅ Pinged MongoDB successfully")


if __name__ == "__main__":
    test_connection()
