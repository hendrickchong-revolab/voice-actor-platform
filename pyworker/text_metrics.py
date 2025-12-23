import re


def _normalize(text: str) -> list[str]:
    # Lowercase, strip punctuation-ish, collapse whitespace.
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s']+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.split() if text else []


def levenshtein(a: list[str], b: list[str]) -> int:
    # Classic DP, O(n*m) but strings are short.
    n, m = len(a), len(b)
    if n == 0:
        return m
    if m == 0:
        return n

    prev = list(range(m + 1))
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            cur[j] = min(
                prev[j] + 1,        # deletion
                cur[j - 1] + 1,     # insertion
                prev[j - 1] + cost, # substitution
            )
        prev = cur
    return prev[m]


def word_error_rate(reference: str, hypothesis: str) -> float:
    ref = _normalize(reference)
    hyp = _normalize(hypothesis)
    if len(ref) == 0:
        return 0.0 if len(hyp) == 0 else 1.0
    dist = levenshtein(ref, hyp)
    return dist / len(ref)
