import os

from fastapi import FastAPI
from pydantic import BaseModel

from .db import connect, fetch_recording, update_recording
from .text_metrics import word_error_rate

app = FastAPI(title="va-platform pyworker")


class AnalyzeRequest(BaseModel):
    recordingId: str


class AnalyzeResponse(BaseModel):
    recordingId: str
    status: str
    werScore: float | None = None
    transcript: str | None = None
    note: str | None = None


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    # Phase 3 scaffold:
    # - ASR is not integrated yet (Whisper/NISQA). For now, we compute WER only if TRANSCRIPT_OVERRIDE is set.
    # - This endpoint updates the Recording row directly.

    transcript_override = os.getenv("TRANSCRIPT_OVERRIDE", "").strip() or None

    with connect() as conn:
        rec = fetch_recording(conn, req.recordingId)
        if not rec:
            return AnalyzeResponse(recordingId=req.recordingId, status="NOT_FOUND", note="Recording not found")

        # Already terminal
        if rec["status"] in ("APPROVED", "REJECTED"):
            return AnalyzeResponse(recordingId=req.recordingId, status=rec["status"], note="Already terminal")

        transcript = transcript_override
        wer = None
        auto_passed = None
        if transcript is not None:
            wer = word_error_rate(rec["scriptText"], transcript)
            auto_passed = wer <= rec["maxWer"]

        # Decision logic (MVP): without ASR we can't auto-approve; if transcript override exists we can auto-evaluate WER.
        status = "FLAGGED"
        note = "Python analysis scaffold ran."
        if wer is not None:
            if wer <= rec["maxWer"]:
                status = "FLAGGED"  # keep human in loop until SNR/MOS are implemented
                note = f"WER={wer:.3f} meets threshold; awaiting SNR/MOS before auto-approve."
            else:
                status = "REJECTED"
                note = f"WER={wer:.3f} exceeds threshold."

        update_recording(
            conn,
            req.recordingId,
            status=status,
            transcript=transcript,
            wer=wer,
            snr=None,
            mos=None,
            note=note,
            auto_passed=auto_passed,
        )

        return AnalyzeResponse(
            recordingId=req.recordingId,
            status=status,
            werScore=wer,
            transcript=transcript,
            note=note,
        )
