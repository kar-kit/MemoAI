from typing import Any, Dict, Optional
from pymongo.database import Database

from app.core.security import hash_password, verify_password


def get_user_by_email(db: Database, email: str) -> Optional[Dict[str, Any]]:
    return db["users"].find_one({"email": email.lower().strip()})


def create_user(db: Database, name: str, email: str, password: str) -> Dict[str, Any]:
    email_norm = email.lower().strip()

    existing = get_user_by_email(db, email_norm)
    if existing:
        raise ValueError("EMAIL_IN_USE")

    doc = {
        "name": name.strip(),
        "email": email_norm,
        "password_hash": hash_password(password),
    }

    result = db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def authenticate_user(
    db: Database, email: str, password: str
) -> Optional[Dict[str, Any]]:
    email_norm = email.lower().strip()
    user = db["users"].find_one({"email": email_norm})
    if not user:
        return None

    if not verify_password(password, user.get("password_hash", "")):
        return None

    return user
