import os

from .audio_convert import ensure_wav
from .nisqa_runner import run_nisqa
from .s3_audio import download_to_tempfile


def score_with_nisqa(audio_s3_uri: str, *, mos_threshold: float, min_metric_threshold: float):
    """Downloads audio from S3, converts to wav if needed, runs NISQA.

    Returns (nisqa_result, passed: bool).
    """

    local_path = download_to_tempfile(audio_s3_uri)
    wav_path = ensure_wav(local_path)

    res = run_nisqa(wav_path)

    passed = (
        res.mos_pred >= mos_threshold
        and res.noi_pred >= min_metric_threshold
        and res.dis_pred >= min_metric_threshold
        and res.col_pred >= min_metric_threshold
        and res.loud_pred >= min_metric_threshold
    )

    return res, passed


def get_default_min_threshold() -> float:
    raw = os.getenv("NISQA_MIN_SCORE", "3.5").strip()
    try:
        return float(raw)
    except ValueError:
        return 3.5
