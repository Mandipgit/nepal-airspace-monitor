import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
import asyncio
import time
from app.core.cache import AsyncTTLCache

class AsyncTTLCacheTestCase(unittest.IsolatedAsyncioTestCase):
    async def test_cache_hit_and_miss(self):
        cache = AsyncTTLCache(default_ttl_seconds=5.0)
        
        # Initial miss
        miss = await cache.get("test_key")
        self.assertIsNone(miss)
        
        # Set value
        await cache.set("test_key", {"flights": [1, 2, 3]})
        
        # Cache hit
        hit = await cache.get("test_key")
        self.assertIsNotNone(hit)
        data, age = hit
        self.assertEqual(data["flights"], [1, 2, 3])
        self.assertGreaterEqual(age, 0.0)

    async def test_ttl_expiration(self):
        # Short 0.05s TTL
        cache = AsyncTTLCache(default_ttl_seconds=0.05)
        await cache.set("quick_key", "active_data")
        
        # Immediate read succeeds
        hit = await cache.get("quick_key")
        self.assertIsNotNone(hit)
        
        # Wait for TTL expiry
        await asyncio.sleep(0.06)
        
        # Subsequent read returns None
        expired = await cache.get("quick_key")
        self.assertIsNone(expired)

    async def test_stats_and_invalidation(self):
        cache = AsyncTTLCache(default_ttl_seconds=10.0)
        await cache.set("k1", "v1")
        await cache.set("k2", "v2")
        
        # Hit k1
        await cache.get("k1")
        # Miss k3
        await cache.get("k3")
        
        stats = await cache.get_stats()
        self.assertEqual(stats["total_entries"], 2)
        self.assertEqual(stats["hits"], 1)
        self.assertEqual(stats["misses"], 1)
        
        # Invalidate k1
        invalidated = await cache.invalidate("k1")
        self.assertTrue(invalidated)
        self.assertIsNone(await cache.get("k1"))

if __name__ == "__main__":
    unittest.main()
