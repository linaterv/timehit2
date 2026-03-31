"""
Memorable word dictionary for auto-generating passwords.
Words are ASCII-only (no Lithuanian special characters).
"""
import random

WORDS = [
    # Lithuanian cities
    "Vilnius", "Kaunas", "Klaipeda", "Siauliai", "Panevezys", "Alytus",
    "Marijampole", "Utena", "Kedainiai", "Telsiai", "Taurage", "Ukmerge",
    "Visaginas", "Palanga", "Druskininkai", "Birzai", "Rokiskis", "Anyksciai",
    "Zarasai", "Ignalina", "Trakai", "Nida", "Neringa", "Plunge",
    # Lithuanian rivers & lakes
    "Nemunas", "Neris", "Venta", "Dubysa", "Sesupe", "Minija",
    "Sventoji", "Merkys", "Musa", "Levuo", "Galve", "Druksiai",
    "Asveja", "Tauragnas", "Zuvintas", "Plateliai",
    # Lithuanian historical figures & terms
    "Mindaugas", "Gediminas", "Vytautas", "Jogaila", "Kestutis",
    "Algirdas", "Traidenis", "Sarunas", "Birute", "Basanavicius",
    "Kudirka", "Daukantas", "Maironis", "Ciurlionis", "Zemaitija",
    "Aukstaitija", "Suvalkija", "Dzukija",
    # World capitals
    "London", "Tokyo", "Paris", "Berlin", "Madrid", "Rome",
    "Vienna", "Prague", "Warsaw", "Dublin", "Lisbon", "Athens",
    "Oslo", "Helsinki", "Tallinn", "Riga", "Minsk", "Ankara",
    "Cairo", "Nairobi", "Sydney", "Ottawa", "Havana", "Lima",
    "Santiago", "Bogota", "Brasilia", "Delhi", "Bangkok", "Seoul",
    "Beijing", "Manila", "Jakarta", "Hanoi", "Tehran", "Riyadh",
    # World landmarks & geography
    "Everest", "Amazon", "Sahara", "Danube", "Alps", "Andes",
    "Kilimanjaro", "Baikal", "Nile", "Rhine", "Thames", "Ganges",
    "Fuji", "Vesuvius", "Etna", "Olympus", "Acropolis", "Colosseum",
    "Parthenon", "Stonehenge", "Kremlin", "Louvre", "Vatican",
    "Sphinx", "Pyramid", "Canyon", "Fjord", "Glacier", "Volcano",
    "Savanna", "Tundra", "Taiga", "Steppe", "Oasis", "Atoll",
    # World historical figures
    "Caesar", "Newton", "Darwin", "Tesla", "Edison", "Galileo",
    "Aristotle", "Plato", "Socrates", "Archimedes", "Euclid",
    "Copernicus", "Kepler", "Euler", "Gauss", "Faraday",
    "Maxwell", "Curie", "Pasteur", "Fleming", "Turing",
    "Gutenberg", "Columbus", "Magellan", "Marco", "Viking",
    # Animals (memorable)
    "Eagle", "Falcon", "Wolf", "Bear", "Tiger", "Lion",
    "Panther", "Raven", "Cobra", "Bison", "Hawk", "Fox",
    "Otter", "Badger", "Lynx", "Stork", "Crane", "Dolphin",
    # Colors & elements
    "Silver", "Copper", "Iron", "Bronze", "Cobalt", "Amber",
    "Crystal", "Granite", "Marble", "Obsidian", "Quartz", "Jade",
    # Nature
    "Thunder", "Storm", "Aurora", "Comet", "Nebula", "Zenith",
    "Eclipse", "Horizon", "Summit", "Ridge", "Crest", "Torrent",
]


def generate_password() -> str:
    """Generate a memorable password: Word-Word-NN (e.g. Vilnius-Everest-42)."""
    w1, w2 = random.sample(WORDS, 2)
    num = random.randint(10, 99)
    return f"{w1}{w2}{num}"
