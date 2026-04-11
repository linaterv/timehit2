from django.db import connections


def _cursor():
    return connections["candidates"].cursor()


def rebuild_fts(candidate):
    """Rebuild the FTS5 entry for a single candidate."""
    texts = [
        candidate.full_name or "",
        candidate.email or "",
        candidate.phone or "",
        candidate.country or "",
        candidate.skills or "",
        candidate.notes or "",
    ]
    for activity in candidate.activities.all():
        if activity.text:
            texts.append(activity.text)
    for f in candidate.files.all():
        if f.extracted_text and f.extracted_text not in ("[NO_TEXT_EXTRACTED]", "[EXTRACTION_ERROR]"):
            texts.append(f.extracted_text)

    content = "\n".join(texts)
    cid = str(candidate.id)

    with _cursor() as c:
        c.execute("DELETE FROM candidates_fts WHERE candidate_id = %s", [cid])
        c.execute("INSERT INTO candidates_fts (candidate_id, content) VALUES (%s, %s)", [cid, content])


def delete_fts(candidate_id):
    """Delete FTS entry for a candidate."""
    with _cursor() as c:
        c.execute("DELETE FROM candidates_fts WHERE candidate_id = %s", [str(candidate_id)])


def search_candidates(query, limit=25):
    """Search candidates via FTS5. Returns list of (candidate_id, snippet, rank)."""
    if not query or not query.strip():
        return []
    # Add prefix matching: "recrui" -> "recrui*", "java spring" -> "java* spring*"
    import re
    terms = re.findall(r'[\w]+', query, re.UNICODE)
    if not terms:
        return []
    fts_query = " ".join(f"{t}*" for t in terms)
    with _cursor() as c:
        c.execute(
            """
            SELECT candidate_id,
                   snippet(candidates_fts, 1, '<b>', '</b>', '...', 30) AS snippet,
                   rank
            FROM candidates_fts
            WHERE candidates_fts MATCH %s
            ORDER BY rank
            LIMIT %s
            """,
            [fts_query, limit],
        )
        return c.fetchall()
