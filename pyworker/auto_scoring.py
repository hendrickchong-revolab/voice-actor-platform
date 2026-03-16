import os

from .audio_convert import ensure_wav
from .nisqa_runner import run_nisqa
from .s3_audio import download_to_tempfile


def score_with_nisqa(audio_s3_uri: str, *, mos_threshold: float, min_metric_threshold: float):
    """Downloads audio from S3, converts to wav if needed, runs NISQA.

    Returns (nisqa_result, mean_score: float, passed: bool).
    """

    local_path = download_to_tempfile(audio_s3_uri)
    wav_path = ensure_wav(local_path)

    res = run_nisqa(wav_path)

    mean_metric = (
        res.noi_pred
        + res.dis_pred
        + res.col_pred
        + res.loud_pred
    ) / 4.0

    passed = res.mos_pred >= mos_threshold and mean_metric >= min_metric_threshold

    return res, mean_metric, passed


def get_default_min_threshold() -> float:
    raw = os.getenv("NISQA_MIN_SCORE", "3.5").strip()
    try:
        return float(raw)
    except ValueError:
        return 3.5
