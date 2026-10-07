"""
ICAO Reference Data Endpoints
Exposes the official ICAO Phonetic Alphabet and international aviation standards.
"""

from fastapi import APIRouter
from app.schemas.icao import IcaoPhoneticResponse
from app.services.supabase.icao_repository import icao_repository

router = APIRouter(prefix="/icao", tags=["ICAO Aviation Reference"])

@router.get("/phonetic", response_model=IcaoPhoneticResponse)
async def get_icao_phonetic_alphabet():
    """
    Retrieve all 26 official ICAO phonetic alphabet entries (A through Z) in alphabetical order.
    Data is queried from the backend database table 'icao_phonetic_alphabet'.
    """
    return await icao_repository.get_alphabet()
