import uuid
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(
    time_cost=2,  # iterations
    memory_cost=102400,  # 100 MB (safe + modern)
    parallelism=8,
    hash_len=32,
    salt_len=16,
)


def create_user(db, name: str, email: str, password: str):
    if db.users.find_one({"email": email}):
        raise ValueError("EMAIL_IN_USE")

    uid = str(uuid.uuid4())

    user = {
        "uid": uid,
        "name": name,
        "email": email,
        "password_hash": ph.hash(password),  # ✅ Argon2 hash
    }

    result = db.users.insert_one(user)
    user["_id"] = result.inserted_id
    return user


def authenticate_user(db, email: str, password: str):
    user = db.users.find_one({"email": email})
    if not user:
        return None

    try:
        ph.verify(user["password_hash"], password)
    except VerifyMismatchError:
        return None

    # Optional: auto-upgrade hash params if needed later
    if ph.check_needs_rehash(user["password_hash"]):
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": ph.hash(password)}},
        )

    return user
