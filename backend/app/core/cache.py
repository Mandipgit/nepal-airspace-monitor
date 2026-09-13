"""
In-Memory Asynchronous TTL Cache
Provides thread-safe caching to debounce external provider calls and prevent rate-limit exhaustion.
"""

import time
import asyncio
from datetime import datetime, timezone
from typing import Any, Optional, Tuple, Dict
from dataclasses import dataclass

@dataclass
class CacheEntry:
    data: Any
    cached_at_mono: float
    expires_at_mono: float
    created_at_utc: datetime

class AsyncTTLCache:
    """Async in-memory key-value cache with individual TTL expiration."""
    def __init__(self, default_ttl_seconds: float = 10.0):
        self.default_ttl_seconds = default_ttl_seconds
        self._store: Dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    async def get(self, key: str) -> Optional[Tuple[Any, float]]:
        """
        Retrieve value if present and unexpired.
        Returns:
            Tuple of (data, age_seconds) or None if absent/expired.
        """
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            
            now_mono = time.monotonic()
            if now_mono >= entry.expires_at_mono:
                # Expired
                del self._store[key]
                self._misses += 1
                return None
            
            self._hits += 1
            age_seconds = now_mono - entry.cached_at_mono
            return entry.data, age_seconds

    async def set(self, key: str, data: Any, ttl_seconds: Optional[float] = None) -> None:
        """Store value with specified TTL."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl_seconds
        now_mono = time.monotonic()
        
        async with self._lock:
            self._store[key] = CacheEntry(
                data=data,
                cached_at_mono=now_mono,
                expires_at_mono=now_mono + ttl,
                created_at_utc=datetime.now(timezone.utc)
            )

    async def invalidate(self, key: str) -> bool:
        """Manually invalidate a cache key."""
        async with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    async def clear(self) -> None:
        """Clear all cached entries."""
        async with self._lock:
            self._store.clear()

    async def get_stats(self) -> Dict[str, Any]:
        """Return cache hit/miss statistics and entry count."""
        async with self._lock:
            now_mono = time.monotonic()
            active_keys = [k for k, v in self._store.items() if now_mono < v.expires_at_mono]
            return {
                "active_entries": len(active_keys),
                "total_entries": len(self._store),
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio": (self._hits / (self._hits + self._misses)) if (self._hits + self._misses) > 0 else 0.0
            }

# Global singleton instance for live flight positions
flight_cache = AsyncTTLCache(default_ttl_seconds=10.0)
