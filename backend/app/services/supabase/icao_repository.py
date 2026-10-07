"""
ICAO Phonetic Alphabet Repository
Retrieves and persists official ICAO phonetic alphabet data from Supabase PostgreSQL.
Provides resilient in-memory fallback to ensure 100% availability offline and before remote migration.
"""

import logging
from typing import List, Dict, Any
from app.services.supabase.client import get_supabase_client, get_supabase_admin_client
from app.schemas.icao import IcaoPhoneticItemSchema, IcaoPhoneticResponse

logger = logging.getLogger(__name__)

# Official 26 ICAO International Aviation Phonetic Alphabet Records (A-Z)
OFFICIAL_ICAO_PHONETIC_ALPHABET: List[Dict[str, Any]] = [
    {"letter": "A", "phonetic": "Alpha", "morse_code": ".-", "pronunciation": "AL-FAH"},
    {"letter": "B", "phonetic": "Bravo", "morse_code": "-...", "pronunciation": "BRAH-VOH"},
    {"letter": "C", "phonetic": "Charlie", "morse_code": "-.-.", "pronunciation": "CHAR-LEE"},
    {"letter": "D", "phonetic": "Delta", "morse_code": "-..", "pronunciation": "DELL-TAH"},
    {"letter": "E", "phonetic": "Echo", "morse_code": ".", "pronunciation": "ECK-OH"},
    {"letter": "F", "phonetic": "Foxtrot", "morse_code": "..-.", "pronunciation": "FOKS-TROT"},
    {"letter": "G", "phonetic": "Golf", "morse_code": "--.", "pronunciation": "GOLF"},
    {"letter": "H", "phonetic": "Hotel", "morse_code": "....", "pronunciation": "HOH-TELL"},
    {"letter": "I", "phonetic": "India", "morse_code": "..", "pronunciation": "IN-DEE-AH"},
    {"letter": "J", "phonetic": "Juliett", "morse_code": ".---", "pronunciation": "JEW-LEE-ETT"},
    {"letter": "K", "phonetic": "Kilo", "morse_code": "-.-", "pronunciation": "KEY-LOH"},
    {"letter": "L", "phonetic": "Lima", "morse_code": ".-..", "pronunciation": "LEE-MAH"},
    {"letter": "M", "phonetic": "Mike", "morse_code": "--", "pronunciation": "MIKE"},
    {"letter": "N", "phonetic": "November", "morse_code": "-.", "pronunciation": "NO-VEM-BER"},
    {"letter": "O", "phonetic": "Oscar", "morse_code": "---", "pronunciation": "OSS-CAH"},
    {"letter": "P", "phonetic": "Papa", "morse_code": ".--.", "pronunciation": "PAH-PAH"},
    {"letter": "Q", "phonetic": "Quebec", "morse_code": "--.-", "pronunciation": "KEH-BECK"},
    {"letter": "R", "phonetic": "Romeo", "morse_code": ".-.", "pronunciation": "ROW-ME-OH"},
    {"letter": "S", "phonetic": "Sierra", "morse_code": "...", "pronunciation": "SEE-AIR-RAH"},
    {"letter": "T", "phonetic": "Tango", "morse_code": "-", "pronunciation": "TANG-GO"},
    {"letter": "U", "phonetic": "Uniform", "morse_code": "..-", "pronunciation": "YOU-NEE-FORM"},
    {"letter": "V", "phonetic": "Victor", "morse_code": "...-", "pronunciation": "VIK-TAH"},
    {"letter": "W", "phonetic": "Whiskey", "morse_code": ".--", "pronunciation": "WISS-KEY"},
    {"letter": "X", "phonetic": "X-ray", "morse_code": "-..-", "pronunciation": "ECKS-RAY"},
    {"letter": "Y", "phonetic": "Yankee", "morse_code": "-.--", "pronunciation": "YANG-KEY"},
    {"letter": "Z", "phonetic": "Zulu", "morse_code": "--..", "pronunciation": "ZOO-LOO"},
]

class IcaoRepository:
    """Repository managing ICAO reference datasets in Supabase PostgreSQL."""

    def __init__(self):
        self._cached_items: List[IcaoPhoneticItemSchema] = [
            IcaoPhoneticItemSchema(**item) for item in OFFICIAL_ICAO_PHONETIC_ALPHABET
        ]

    def _get_client(self):
        try:
            return get_supabase_client()
        except Exception:
            return None

    def _get_admin_client(self):
        try:
            return get_supabase_admin_client()
        except Exception:
            return None

    async def get_alphabet(self) -> IcaoPhoneticResponse:
        """
        Retrieve all 26 ICAO phonetic alphabet entries ordered A through Z.
        Queries Supabase database table 'icao_phonetic_alphabet' first.
        Falls back seamlessly to the canonical aviation dataset if remote table is unreachable.
        """
        # 1. Attempt query from Supabase table
        client = self._get_client()
        if client:
            try:
                res = client.table("icao_phonetic_alphabet").select("letter, phonetic, morse_code, pronunciation").order("letter").execute()
                if res.data and len(res.data) >= 26:
                    items = [
                        IcaoPhoneticItemSchema(
                            letter=str(row["letter"]).strip().upper(),
                            phonetic=str(row["phonetic"]).strip(),
                            morse_code=row.get("morse_code"),
                            pronunciation=row.get("pronunciation"),
                        )
                        for row in res.data
                    ]
                    # Ensure alphabetical sort A-Z
                    items.sort(key=lambda x: x.letter)
                    return IcaoPhoneticResponse(total=len(items), alphabet=items)
            except Exception as e:
                logger.debug(f"Supabase 'icao_phonetic_alphabet' query fallback invoked: {e}")

        # 2. Fallback to official verified dataset
        items = list(self._cached_items)
        items.sort(key=lambda x: x.letter)
        return IcaoPhoneticResponse(total=len(items), alphabet=items)

# Global singleton repository instance
icao_repository = IcaoRepository()
