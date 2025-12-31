import os
import subprocess
import tempfile


def ensure_wav(input_path: str) -> str:
    # If already wav, return as-is.
    if input_path.lower().endswith(".wav"):
        return input_path

    # Convert with ffmpeg.
    out_fd, out_path = tempfile.mkstemp(prefix="va_audio_", suffix=".wav")
    os.close(out_fd)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-ac",
        "1",
        "-ar",
        "48000",
        out_path,
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        raise RuntimeError(f"FFMPEG_CONVERT_FAILED: {stderr or 'unknown error'}")

    return out_path
