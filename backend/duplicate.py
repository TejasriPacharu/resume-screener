import hashlib
import json

from config import REGISTRY_PATH


def _load() -> dict:
    if REGISTRY_PATH.exists():
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    return {}


def _save(registry: dict):
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def file_hash(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def is_duplicate(file_path: str, role_id: str) -> bool:
    registry = _load()
    hash_val = file_hash(file_path)
    return hash_val in registry.get(role_id, [])


def register(file_path: str, role_id: str):
    registry = _load()
    hash_val = file_hash(file_path)
    if role_id not in registry:
        registry[role_id] = []
    if hash_val not in registry[role_id]:
        registry[role_id].append(hash_val)
    _save(registry)


def clear_role(role_id: str):
    """Remove all registered hashes for a role (useful for re-parse flows)."""
    registry = _load()
    if role_id in registry:
        del registry[role_id]
        _save(registry)


def clear_all():
    """Remove all registered hashes for all roles."""
    _save({})