"""
Application Exceptions and Error Handlers
"""

# pyrefly: ignore [missing-import]
from fastapi import Request, status
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class AppError(Exception):
    """Base application exception."""
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR, details: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class ProviderError(AppError):
    """Raised when an external data provider fails or returns unexpected responses."""
    def __init__(self, provider: str, message: str, status_code: int = status.HTTP_502_BAD_GATEWAY, details: dict = None):
        super().__init__(
            message=f"Provider '{provider}' error: {message}",
            status_code=status_code,
            details=details
        )
        self.provider = provider

class RateLimitError(ProviderError):
    """Raised when an external data provider rate limit is exceeded."""
    def __init__(self, provider: str, retry_after: int = None, details: dict = None):
        msg = f"Rate limit reached for provider '{provider}'."
        if retry_after:
            msg += f" Retry after {retry_after} seconds."
        super().__init__(
            provider=provider,
            message=msg,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details={"retry_after": retry_after, **(details or {})}
        )
        self.retry_after = retry_after

class FlightNotFoundError(AppError):
    """Raised when a specific flight ID or ICAO24 is not found."""
    def __init__(self, identifier: str):
        super().__init__(
            message=f"Flight '{identifier}' not found in current airspace snapshot.",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"identifier": identifier}
        )

async def app_error_handler(request: Request, exc: AppError):
    """FastAPI error handler for custom AppError exceptions."""
    logger.error(f"Application error on {request.method} {request.url.path}: {exc.message} (status: {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": exc.__class__.__name__,
                "message": exc.message,
                "details": exc.details
            }
        }
    )
