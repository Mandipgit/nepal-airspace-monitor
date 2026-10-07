"""
ICAO Phonetic Alphabet Pydantic Schemas
Defines request/response contracts for the 26 ICAO phonetic alphabet entries.
"""

from typing import Optional, List
from pydantic import BaseModel, Field

class IcaoPhoneticItemSchema(BaseModel):
    """Single ICAO phonetic alphabet mapping entry."""
    letter: str = Field(..., max_length=1, description="Single alphabet letter (A-Z)")
    phonetic: str = Field(..., description="Official ICAO phonetic code word (e.g. Alpha, Bravo)")
    morse_code: Optional[str] = Field(None, description="International Morse code representation")
    pronunciation: Optional[str] = Field(None, description="Standard phonetic pronunciation guide")

class IcaoPhoneticResponse(BaseModel):
    """List response containing all 26 ICAO phonetic alphabet items ordered A to Z."""
    total: int = Field(..., description="Total count of phonetic alphabet entries (26)")
    alphabet: List[IcaoPhoneticItemSchema] = Field(..., description="Alphabetical list of phonetic entries")
