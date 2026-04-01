"""
4-letter uppercase code generator for Client and ContractorProfile.
Auto-generates from entity name, ensures uniqueness, avoids offensive words.
"""

OFFENSIVE_CODES = {
    "ANAL", "ANUS", "ARSE",
    "BDSM", "BLOW", "BOOB", "BUTT",
    "CLIT", "COCK", "COON", "CRAP", "CUNT",
    "DAMN", "DEAD", "DETH", "DICK", "DILD", "DONG", "DYKE",
    "FAGG", "FART", "FICK", "FIST",
    "FUCC", "FUCK", "FUCS", "FUKS", "FUKK", "FUXK",
    "GASH", "GOOK", "GROP",
    "HATE", "HEIL", "HELL", "HOMO", "HORE",
    "JERK", "JISM", "JIZZ",
    "KIKE", "KILL", "KINK", "KKKK", "KNOB", "KUNT",
    "LEWD", "LEZZ", "LUST",
    "METH", "MILF", "MOFO", "MUFF", "MURD",
    "NAZI", "NIGA", "NIGG", "NIPS", "NUDE", "NUTS",
    "ORAL", "ORGY",
    "PAKI", "PEDO", "PERV", "PHUC", "PHUK", "PIMP", "PISS",
    "POON", "POOP", "PORN", "PUBE", "PUKE", "PUSS", "PUSY",
    "QUIM",
    "RAPE", "RUMP",
    "SCAT", "SCUM", "SEXY", "SHAG", "SHIT", "SHIZ", "SHYT",
    "SLAG", "SLUT", "SMEG", "SPIC", "STFU", "SUCK",
    "THOT", "TITS", "TITT", "TURD", "TWAT",
    "VULV",
    "WANK", "WHOR",
    "XXXX",
}

OFFENSIVE_PREFIXES = {
    "ASS", "CUM", "DIK", "FAG", "FUC", "FUK", "FUX",
    "GAY", "KKK", "NIG", "PHU", "POO",
    "PUS", "SEX", "SHI", "SHT", "TIT", "VAG", "WTF",
}


def _is_blocked(code: str) -> bool:
    code = code.upper()
    if code in OFFENSIVE_CODES:
        return True
    if any(code.startswith(p) for p in OFFENSIVE_PREFIXES):
        return True
    return False


def _base_code(name: str) -> str:
    """Extract first 4 uppercase letters from name."""
    letters = [c.upper() for c in name if c.isalpha()]
    while len(letters) < 4:
        letters.append("X")
    return "".join(letters[:4])


def _increment_code(code: str) -> str | None:
    """Increment code: ABCD → ABCE, ABCZ → ABDZ, etc."""
    chars = list(code)
    for i in range(3, -1, -1):
        if chars[i] < "Z":
            chars[i] = chr(ord(chars[i]) + 1)
            return "".join(chars)
        chars[i] = "A"
    return None  # all ZZZZ exhausted


def generate_code(name: str, model_class, exclude_id=None) -> str:
    """
    Generate a unique 4-letter code from name.
    model_class: Django model with a `code` CharField.
    exclude_id: exclude this PK from uniqueness check (for updates).
    """
    candidate = _base_code(name)
    existing = set(
        model_class.objects.values_list("code", flat=True)
    )
    if exclude_id:
        own = model_class.objects.filter(pk=exclude_id).values_list("code", flat=True).first()
        if own:
            existing.discard(own)

    attempts = 0
    while attempts < 1000:
        if not _is_blocked(candidate) and candidate not in existing:
            return candidate
        candidate = _increment_code(candidate)
        if candidate is None:
            candidate = _base_code(name) + "A"  # fallback, won't happen in practice
            break
        attempts += 1

    return candidate


def suggest_code(desired: str, model_class, exclude_id=None) -> str:
    """
    If desired code is taken or blocked, suggest the next available one.
    """
    desired = desired.upper()[:4].ljust(4, "X")
    existing = set(model_class.objects.values_list("code", flat=True))
    if exclude_id:
        own = model_class.objects.filter(pk=exclude_id).values_list("code", flat=True).first()
        if own:
            existing.discard(own)

    if not _is_blocked(desired) and desired not in existing:
        return desired

    candidate = desired
    for _ in range(1000):
        candidate = _increment_code(candidate)
        if candidate is None:
            break
        if not _is_blocked(candidate) and candidate not in existing:
            return candidate

    return generate_code(desired, model_class, exclude_id)
