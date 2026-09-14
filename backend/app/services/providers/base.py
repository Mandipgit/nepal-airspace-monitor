"""
Base Flight Provider Interface
Abstract class defining the contract for all live aircraft data providers.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from app.models.flight import NormalizedFlight

class BaseFlightProvider(ABC):
    """Abstract base class for live flight telemetry providers."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Unique provider identifier string (e.g., 'opensky', 'flightaware')."""
        pass

    @property
    def last_rate_limit_remaining(self) -> Optional[int]:
        """Remaining API rate limit credits reported by the provider, if available."""
        return None

    @abstractmethod
    async def get_live_flights(
        self,
        lamin: float,
        lomin: float,
        lamax: float,
        lomax: float
    ) -> List[NormalizedFlight]:
        """
        Fetch and normalize live aircraft states within the specified geographical bounding box.
        
        Args:
            lamin: Minimum latitude (south)
            lomin: Minimum longitude (west)
            lamax: Maximum latitude (north)
            lomax: Maximum longitude (east)
            
        Returns:
            List of NormalizedFlight domain objects.
            
        Raises:
            ProviderError: If external provider fails or returns unparseable content.
            RateLimitError: If provider rate limit has been exceeded.
        """
        pass
