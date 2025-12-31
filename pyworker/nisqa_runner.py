import os
import shlex
import subprocess
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class NisqaResult:
    mos_pred: float
    noi_pred: float
    dis_pred: float
    col_pred: float
    loud_pred: float
    model: str | None = None


def _parse_nisqa_csv(stdout: str) -> NisqaResult:
    # Expected format (header + one row), like:
    # deg,mos_pred,noi_pred,dis_pred,col_pred,loud_pred,model
    # sample.wav,4.50,...
    lines = [ln.strip() for ln in stdout.splitlines() if ln.strip()]
    if not lines:
        raise RuntimeError("NISQA_EMPTY_OUTPUT")

    if len(lines) == 1 and "," in lines[0] and lines[0].lower().startswith("deg,"):
        raise RuntimeError("NISQA_MISSING_DATA_ROW")

    header = None
    row = None
    if lines[0].lower().startswith("deg,"):
        header = [h.strip() for h in lines[0].split(",")]
        row = [c.strip() for c in lines[1].split(",")] if len(lines) > 1 else None
    else:
        # If caller outputs without header, assume fixed order.
        header = ["deg", "mos_pred", "noi_pred", "dis_pred", "col_pred", "loud_pred", "model"]
        row = [c.strip() for c in lines[0].split(",")]

    if not row or len(row) < 6:
        raise RuntimeError("NISQA_BAD_OUTPUT")

    def get(name: str, default: Any = None):
        try:
            idx = header.index(name)
        except ValueError:
            return default
        return row[idx] if idx < len(row) else default

    return NisqaResult(
        mos_pred=float(get("mos_pred")),
        noi_pred=float(get("noi_pred")),
        dis_pred=float(get("dis_pred")),
        col_pred=float(get("col_pred")),
        loud_pred=float(get("loud_pred")),
        model=str(get("model")) if get("model") not in (None, "") else None,
    )


def run_nisqa(wav_path: str) -> NisqaResult:
    """Run NISQA via an external command.

    Configure with env var NISQA_PREDICT_CMD containing a command template with {wav} placeholder.

    Example:
      NISQA_PREDICT_CMD='nisqa_predict --input {wav} --output -'

    The command must print a CSV with the columns:
      deg,mos_pred,noi_pred,dis_pred,col_pred,loud_pred,model

    (Header row is optional; one data row required.)
    """

    template = os.getenv("NISQA_PREDICT_CMD", "").strip()
    if not template:
        raise RuntimeError("NISQA_NOT_CONFIGURED")

    cmd_str = template.replace("{wav}", wav_path)
    cmd = shlex.split(cmd_str)

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        raise RuntimeError(f"NISQA_FAILED: {stderr or 'unknown error'}")

    return _parse_nisqa_csv(proc.stdout or "")
