import re


def extract_text(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF. Returns empty string for non-PDFs."""
    if not str(file_path).lower().endswith(".pdf"):
        return ""
    try:
        import fitz
        doc = fitz.open(file_path)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text.strip() if text.strip() else "[NO_TEXT_EXTRACTED]"
    except Exception:
        return "[EXTRACTION_ERROR]"


def extract_text_from_bytes(data: bytes) -> str:
    """Extract text from PDF bytes."""
    try:
        import fitz
        doc = fitz.open(stream=data, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text.strip()
    except Exception:
        return ""


COUNTRY_MAP = {
    "lithuania": "LT", "vilnius": "LT", "kaunas": "LT", "klaipeda": "LT",
    "poland": "PL", "warsaw": "PL", "krakow": "PL", "wroclaw": "PL", "gdansk": "PL",
    "germany": "DE", "berlin": "DE", "munich": "DE", "frankfurt": "DE", "hamburg": "DE",
    "sweden": "SE", "stockholm": "SE", "gothenburg": "SE",
    "united kingdom": "GB", "london": "GB", "manchester": "GB", "edinburgh": "GB",
    "united states": "US", "new york": "US", "san francisco": "US",
    "netherlands": "NL", "amsterdam": "NL", "rotterdam": "NL",
    "france": "FR", "paris": "FR", "lyon": "FR",
    "spain": "ES", "madrid": "ES", "barcelona": "ES",
    "italy": "IT", "milan": "IT", "rome": "IT",
    "czech republic": "CZ", "czechia": "CZ", "prague": "CZ",
    "estonia": "EE", "tallinn": "EE",
    "latvia": "LV", "riga": "LV",
    "finland": "FI", "helsinki": "FI",
    "denmark": "DK", "copenhagen": "DK",
    "norway": "NO", "oslo": "NO",
    "ireland": "IE", "dublin": "IE",
    "portugal": "PT", "lisbon": "PT",
    "austria": "AT", "vienna": "AT",
    "switzerland": "CH", "zurich": "CH",
    "ukraine": "UA", "kyiv": "UA",
    "romania": "RO", "bucharest": "RO",
    "bulgaria": "BG", "sofia": "BG",
    "croatia": "HR", "zagreb": "HR",
    "india": "IN", "bangalore": "IN", "mumbai": "IN",
}


def _is_name_line(line: str) -> bool:
    """Check if a line looks like a person's name."""
    words = line.split()
    if len(words) < 2 or len(words) > 4:
        return False
    if len(line) < 3 or len(line) > 60:
        return False
    if "@" in line or "linkedin" in line.lower() or "www." in line.lower():
        return False
    if re.search(r"\+?\d[\d\s\-]{6,}", line):
        return False
    return all(re.match(r"^[\w\-''.]+$", w, re.UNICODE) for w in words)


def _is_linkedin_pdf(lines: list) -> bool:
    """Detect if this is a LinkedIn-exported PDF."""
    for line in lines[:3]:
        if line.strip().lower() == "contact":
            return True
    return False


SECTION_HEADERS = {
    "contact", "top skills", "languages", "certifications", "honors-awards",
    "summary", "experience", "education", "skills", "recommendations",
    "publications", "projects", "volunteer experience", "interests",
}

TECH_KEYWORDS = {
    "java", "python", "javascript", "typescript", "react", "angular", "vue",
    "node.js", "nodejs", "spring", "spring boot", "springboot", "django", "fastapi",
    "c++", "c#", "go", "golang", "rust", "ruby", "php", "swift", "kotlin",
    "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "git", "jenkins", "ci/cd", "linux", "rest", "graphql", "kafka",
    "html", "css", "tailwind", "next.js", "nextjs", ".net", "asp.net",
    "microservices", "agile", "scrum", "jira", "sql", "nosql",
    "machine learning", "deep learning", "tensorflow", "pytorch",
    "flutter", "react native", "android", "ios",
    "figma", "storybook", "webpack", "vite",
    "junit", "pytest", "selenium", "playwright", "cypress",
    "rabbitmq", "grpc", "nginx", "openshift",
}


def _parse_linkedin_pdf(lines: list, text: str) -> dict:
    """Parse a LinkedIn-exported PDF.

    LinkedIn PDF structure:
      Contact          <- header
        (email, phone, linkedin url, etc.)
      Top Skills       <- header
        (skill items)
      Languages        <- header (optional)
        (language items)
      Certifications   <- header (optional)
        (cert items)
      FULL NAME        <- the person's name
      Headline text    <- title/description
      City, Region, Country  <- location
      Summary/Experience/Education  <- content sections
    """
    result = {
        "full_name": "", "email": "", "phone": "",
        "linkedin_url": "", "skills": "", "country": "",
    }

    # Email & phone
    emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if emails:
        result["email"] = emails[0]

    phones = re.findall(r"\+\d[\d\s\-()]{7,18}\d", text)
    if phones:
        result["phone"] = phones[0].strip()

    # LinkedIn URL — may be split across lines (e.g. "www.linkedin.com/in/karolina-\nzigmantaitė-559560116 (LinkedIn)")
    # Join all lines, find the URL, strip the "(LinkedIn)" suffix
    joined = " ".join(lines)
    li_match = re.search(r"((?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-–%.]+(?:\s+[\w\-–%.]+)*)", joined)
    if li_match:
        raw = li_match.group(1)
        # Clean up: remove space-joined fragments, take until "(LinkedIn)" or whitespace-then-non-url
        # Reconstruct by finding the raw parts
        clean = re.sub(r"\s+", "", raw)  # remove spaces from line breaks
        if not clean.startswith("http"):
            clean = "https://" + clean
        result["linkedin_url"] = clean

    # Collect "Top Skills" — items between "Top Skills" header and the next section header
    pre_name_sections = {"contact", "top skills", "languages", "certifications"}
    content_sections = {"summary", "experience", "education", "projects",
                        "volunteer experience", "publications", "recommendations",
                        "honors-awards", "interests"}
    all_sections = pre_name_sections | content_sections

    for i, line in enumerate(lines):
        if line.strip().lower() == "top skills":
            skills = []
            for j in range(i + 1, len(lines)):
                s = lines[j].strip()
                if s.lower() in all_sections:
                    break
                if s and len(s) < 80:
                    skills.append(s)
                if len(skills) >= 3:
                    break
            if skills:
                result["skills"] = ", ".join(skills)
            break

    # Name: in LinkedIn PDFs, the name is always the line right before the
    # first headline line (containing " | ") that appears after the metadata.
    for i in range(4, len(lines)):
        if "|" in lines[i]:
            candidate_name = lines[i - 1].strip()
            if _is_name_line(candidate_name):
                result["full_name"] = candidate_name
            # Location: within next few lines after headline
            for k in range(i + 1, min(i + 5, len(lines))):
                loc = lines[k].strip()
                if loc.lower() in content_sections:
                    break
                for keyword, code in COUNTRY_MAP.items():
                    if keyword in loc.lower():
                        result["country"] = code
                        break
                if result["country"]:
                    break
            break

    return result


def parse_cv(text: str) -> dict:
    """Best-effort extraction of candidate info from CV text."""
    result = {
        "full_name": "",
        "email": "",
        "phone": "",
        "linkedin_url": "",
        "skills": "",
        "country": "",
    }
    if not text:
        return result

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Detect LinkedIn PDF format and use specialized parser
    if _is_linkedin_pdf(lines):
        return _parse_linkedin_pdf(lines, text)

    # --- Generic CV parsing below ---

    # Email
    emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    if emails:
        result["email"] = emails[0]

    # Phone
    phones = re.findall(r"\+\d[\d\s\-()]{7,18}\d", text)
    if not phones:
        phones = re.findall(r"\(\d{2,4}\)\s*[\d\s\-]{6,12}\d", text)
    if phones:
        result["phone"] = phones[0].strip()

    # LinkedIn
    linkedin = re.findall(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+/?", text)
    if linkedin:
        url = linkedin[0]
        if not url.startswith("http"):
            url = "https://" + url
        result["linkedin_url"] = url

    # Name — first name-like line (skip headers)
    skip_patterns = re.compile(
        r"^(curriculum|resume|cv\b|page\s|contact|personal|profile|about|summary|"
        r"objective|experience|education|skills|references|http|www\.|@|location|top skills)",
        re.IGNORECASE,
    )
    for line in lines[:8]:
        if skip_patterns.search(line):
            continue
        if "@" in line or re.search(r"\+?\d[\d\s\-]{6,}", line):
            continue
        if _is_name_line(line):
            result["full_name"] = line
            break

    # Location line (e.g. "Location: Vilnius, Lithuania")
    for line in lines[:10]:
        loc_match = re.match(r"(?:location|city|based in)[:\s]+(.+)", line, re.IGNORECASE)
        if loc_match:
            loc_text = loc_match.group(1).strip()
            for keyword, code in COUNTRY_MAP.items():
                if keyword in loc_text.lower():
                    result["country"] = code
                    break
            break

    # Skills — tech keywords found in text
    text_lower = text.lower()
    found_skills = []
    for skill in sorted(TECH_KEYWORDS, key=len, reverse=True):
        if skill in text_lower and skill not in [s.lower() for s in found_skills]:
            idx = text_lower.find(skill)
            original = text[idx:idx + len(skill)]
            found_skills.append(original)
    if found_skills:
        result["skills"] = ", ".join(found_skills[:15])

    # Country
    if not result["country"]:
        for keyword, code in COUNTRY_MAP.items():
            if keyword in text_lower:
                result["country"] = code
                break

    return result


def _location_to_country(location: str) -> str:
    loc = location.lower()
    for keyword, code in COUNTRY_MAP.items():
        if keyword in loc:
            return code
    return ""


def fetch_linkedin(url: str) -> dict:
    """Fetch a LinkedIn public profile and extract available info."""
    import requests
    from bs4 import BeautifulSoup

    result = {
        "full_name": "", "email": "", "phone": "",
        "linkedin_url": url, "skills": "", "country": "",
        "headline": "", "location": "",
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return result
    except Exception:
        return result

    soup = BeautifulSoup(r.text, "html.parser")

    first, last = "", ""
    for tag in soup.find_all("meta"):
        prop = tag.get("property", "") or tag.get("name", "")
        content = tag.get("content", "")
        if prop == "profile:first_name":
            first = content
        elif prop == "profile:last_name":
            last = content
        elif prop == "og:description" and not result["headline"]:
            result["headline"] = content.split("·")[0].strip()

    if first and last:
        result["full_name"] = f"{first} {last}"

    # Location from page text
    text = soup.get_text(" ", strip=True)
    loc_match = re.search(
        r"(?:(?:Greater|Metro)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        text,
    )
    if loc_match:
        result["location"] = f"{loc_match.group(1)}, {loc_match.group(2)}"
        result["country"] = _location_to_country(result["location"])

    return result


def parse_linkedin_text(text: str) -> dict:
    """Parse pasted LinkedIn profile page text."""
    result = parse_cv(text)
    result.setdefault("headline", "")
    # LinkedIn page text often has the name as the first line, then headline
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    # Override name detection — LinkedIn pages put name very early
    for line in lines[:5]:
        if "@" in line or "linkedin" in line.lower():
            continue
        words = line.split()
        if 2 <= len(words) <= 4 and all(re.match(r"^[A-Za-zÀ-ÿ\-'.]+$", w) for w in words):
            result["full_name"] = line
            break
    return result


def generate_linkedin_pdf(data: dict) -> bytes:
    """Generate a simple profile PDF from LinkedIn data."""
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    styles = getSampleStyleSheet()
    BLUE = HexColor("#2D3748")
    LIGHT = HexColor("#718096")

    name_s = ParagraphStyle("LIName", parent=styles["Title"], fontSize=22, textColor=BLUE, spaceAfter=2*mm)
    sub_s = ParagraphStyle("LISub", parent=styles["Normal"], fontSize=12, textColor=HexColor("#4A5568"), spaceAfter=4*mm)
    body_s = ParagraphStyle("LIBody", parent=styles["Normal"], fontSize=10, textColor=BLUE, leading=14, spaceAfter=2*mm)
    small_s = ParagraphStyle("LISmall", parent=body_s, fontSize=9, textColor=LIGHT)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=25*mm, rightMargin=25*mm, topMargin=25*mm, bottomMargin=25*mm)
    story = []

    story.append(Paragraph(data.get("full_name") or "Unknown", name_s))
    if data.get("headline"):
        story.append(Paragraph(data["headline"], sub_s))

    info_parts = []
    if data.get("location"):
        info_parts.append(data["location"])
    if data.get("email"):
        info_parts.append(data["email"])
    if data.get("linkedin_url"):
        info_parts.append(data["linkedin_url"])
    if info_parts:
        story.append(Paragraph("  |  ".join(info_parts), small_s))

    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#CBD5E0"), spaceAfter=4*mm, spaceBefore=4*mm))

    if data.get("skills"):
        story.append(Paragraph(f"<b>Skills:</b> {data['skills']}", body_s))
    story.append(Spacer(1, 8*mm))
    story.append(Paragraph("Imported from LinkedIn", small_s))

    doc.build(story)
    return buf.getvalue()
