-- ==============================================================================
-- AeroTrace - ICAO Phonetic Alphabet Schema & Dataset
-- Target: Supabase (PostgreSQL 15+)
-- Table: icao_phonetic_alphabet
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.icao_phonetic_alphabet (
    id SERIAL PRIMARY KEY,
    letter VARCHAR(1) NOT NULL UNIQUE,
    phonetic VARCHAR(50) NOT NULL,
    morse_code VARCHAR(10),
    pronunciation VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Index for letter lookups and ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_icao_phonetic_letter ON public.icao_phonetic_alphabet (letter);

-- Seed official 26 ICAO Phonetic Alphabet records (A through Z)
INSERT INTO public.icao_phonetic_alphabet (letter, phonetic, morse_code, pronunciation)
VALUES
    ('A', 'Alpha', '.-', 'AL-FAH'),
    ('B', 'Bravo', '-...', 'BRAH-VOH'),
    ('C', 'Charlie', '-.-.', 'CHAR-LEE'),
    ('D', 'Delta', '-..', 'DELL-TAH'),
    ('E', 'Echo', '.', 'ECK-OH'),
    ('F', 'Foxtrot', '..-.', 'FOKS-TROT'),
    ('G', 'Golf', '--.', 'GOLF'),
    ('H', 'Hotel', '....', 'HOH-TELL'),
    ('I', 'India', '..', 'IN-DEE-AH'),
    ('J', 'Juliett', '.---', 'JEW-LEE-ETT'),
    ('K', 'Kilo', '-.-', 'KEY-LOH'),
    ('L', 'Lima', '.-..', 'LEE-MAH'),
    ('M', 'Mike', '--', 'MIKE'),
    ('N', 'November', '-.', 'NO-VEM-BER'),
    ('O', 'Oscar', '---', 'OSS-CAH'),
    ('P', 'Papa', '.--.', 'PAH-PAH'),
    ('Q', 'Quebec', '--.-', 'KEH-BECK'),
    ('R', 'Romeo', '.-.', 'ROW-ME-OH'),
    ('S', 'Sierra', '...', 'SEE-AIR-RAH'),
    ('T', 'Tango', '-', 'TANG-GO'),
    ('U', 'Uniform', '..-', 'YOU-NEE-FORM'),
    ('V', 'Victor', '...-', 'VIK-TAH'),
    ('W', 'Whiskey', '.--', 'WISS-KEY'),
    ('X', 'X-ray', '-..-', 'ECKS-RAY'),
    ('Y', 'Yankee', '-.--', 'YANG-KEY'),
    ('Z', 'Zulu', '--..', 'ZOO-LOO')
ON CONFLICT (letter) DO UPDATE SET
    phonetic = EXCLUDED.phonetic,
    morse_code = EXCLUDED.morse_code,
    pronunciation = EXCLUDED.pronunciation;
