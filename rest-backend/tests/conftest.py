import os
from typing import Any, get_args, get_origin

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

os.environ.setdefault("SESSION_SECRET", "test-session-secret")


def _value_for_field(name: str, annotation: Any):
    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin is None:
        if annotation is str:
            if "email" in name:
                return "joey@example.com"
            if "password" in name:
                return "StrongPass123!"
            if "name" in name:
                return "Joey"
            if "title" in name:
                return "Test Title"
            if "content" in name or "message" in name:
                return "Test content"
            if "source_type" in name:
                return "text"
            if "source_ref" in name:
                return "ref-1"
            return "test"
        if annotation is int:
            return 1
        if annotation is float:
            return 1.0
        if annotation is bool:
            return True
        if annotation is list:
            return []
        if annotation is dict:
            return {}
        if isinstance(annotation, type) and issubclass(annotation, BaseModel):
            return make_payload(annotation)
        return None

    if origin is list:
        return []
    if origin is dict:
        return {}
    if origin is tuple:
        return []
    if str(origin).endswith("Literal"):
        return args[0]
    if str(origin).endswith("Union"):
        non_none = [a for a in args if a is not type(None)]
        if not non_none:
            return None
        return _value_for_field(name, non_none[0])

    return None


def make_payload(model_cls: type[BaseModel], overrides: dict[str, Any] | None = None):
    data = {}
    overrides = overrides or {}

    for name, field in model_cls.model_fields.items():
        if name in overrides:
            data[name] = overrides[name]
            continue

        if not field.is_required():
            continue

        value = _value_for_field(name, field.annotation)
        if value is not None:
            data[name] = value

    return data


@pytest.fixture
def app():
    from app.main import app as fastapi_app

    fastapi_app.router.on_startup.clear()
    return fastapi_app


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def authed_client(app):
    from app.dependencies.auth import require_session

    app.dependency_overrides[require_session] = lambda: "user-123"

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
