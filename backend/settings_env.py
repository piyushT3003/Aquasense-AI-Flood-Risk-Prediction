"""Tiny .env loader (no extra dependency). Values already set in the environment win."""
import os, pathlib


def load_env(path: pathlib.Path = pathlib.Path(__file__).resolve().parent / ".env") -> list[str]:
    loaded = []
    if not path.exists():
        return loaded
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if v and k not in os.environ:
            os.environ[k] = v
            loaded.append(k)
    return loaded
