import os
import tempfile
import wave

from fastapi import FastAPI
from pydantic import BaseModel

from .db import connect, fetch_recording, update_recording
from .text_metrics import word_error_rate
from .auto_scoring import score_with_nisqa, get_default_min_threshold
from .nisqa_runner import run_nisqa

app = FastAPI(title="va-platform pyworker")


class AnalyzeRequest(BaseModel):
    recordingId: str


class AnalyzeResponse(BaseModel):
    recordingId: str
    status: str
    werScore: float | None = None
    transcript: str | None = None
    mosScore: float | None = None
    nisqaNoiPred: float | None = None
    nisqaDisPred: float | None = None
    nisqaColPred: float | None = None
    nisqaLoudPred: float | None = None
    autoPassed: bool | None = None
    note: str | None = None


@app.get("/health")
def health():
    template = os.getenv("NISQA_PREDICT_CMD", "").strip()
    return {
        "ok": True,
        "nisqaConfigured": bool(template),
        "nisqaHasPlaceholder": ("{wav}" in template) if template else False,
    }


@app.get("/nisqa/selftest")
def nisqa_selftest():
    """Run a minimal NISQA invocation on a generated 1s silent WAV.

    This verifies whether NISQA is installed/configured (NISQA_PREDICT_CMD) and can run.
    """

    # Generate a small PCM16 mono WAV at 16kHz.
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name

    try:
        sample_rate = 16000
        seconds = 1
        num_frames = sample_rate * seconds
        silence_frame = (0).to_bytes(2, byteorder="little", signed=True)
        with wave.open(wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(silence_frame * num_frames)

        res = run_nisqa(wav_path)
        return {
            "ok": True,
            "result": {
                "mos_pred": res.mos_pred,
                "noi_pred": res.noi_pred,
                "dis_pred": res.dis_pred,
                "col_pred": res.col_pred,
                "loud_pred": res.loud_pred,
                "model": res.model,
            },
        }
    except Exception as e:
        hint = (
            "Configure NISQA by setting NISQA_PREDICT_CMD (must include {wav}). "
            "Fastest path: clone the NISQA repo somewhere accessible and set a command like: "
            "python /app/pyworker/nisqa_predict_stdout.py --wav {wav} --repo /path/to/NISQA --model /path/to/NISQA/weights/nisqa.tar"
        )
        return {"ok": False, "error": str(e), "hint": hint}
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass


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

        # Idempotency: if already auto-scored, don't redo heavy work.
        if rec.get("autoScoredAt") is not None:
            return AnalyzeResponse(
                recordingId=req.recordingId,
                status=rec["status"],
                werScore=rec.get("werScore"),
                transcript=rec.get("transcript"),
                mosScore=rec.get("mosScore"),
                nisqaNoiPred=rec.get("nisqaNoiPred"),
                nisqaDisPred=rec.get("nisqaDisPred"),
                nisqaColPred=rec.get("nisqaColPred"),
                nisqaLoudPred=rec.get("nisqaLoudPred"),
                autoPassed=None,
                note="Already auto-scored",
            )

        # Already terminal
        if rec["status"] in ("APPROVED", "REJECTED"):
            return AnalyzeResponse(recordingId=req.recordingId, status=rec["status"], note="Already terminal")

        transcript = transcript_override
        wer = None

        # NISQA scoring (MOS + component predictions)
        nisqa_res = None
        nisqa_passed = None
        min_metric = get_default_min_threshold()
        try:
            nisqa_res, nisqa_passed = score_with_nisqa(
                rec["audioUrl"],
                mos_threshold=rec["targetMos"],
                min_metric_threshold=min_metric,
            )
        except Exception as e:
            # Don't crash the pipeline; store a clear note for managers.
            nisqa_res = None
            nisqa_passed = None
            nisqa_err = str(e)

        auto_passed = nisqa_passed

        # Optional WER if TRANSCRIPT_OVERRIDE is set.
        if transcript is not None:
            wer = word_error_rate(rec["scriptText"], transcript)
            auto_passed = (auto_passed is True) and (wer <= rec["maxWer"]) if auto_passed is not None else (wer <= rec["maxWer"])

        # Decision logic:
        # - If WER is available and fails -> REJECTED
        # - If NISQA passes (and WER passes when available) -> APPROVED
        # - Otherwise -> FLAGGED (needs human review)
        status = "FLAGGED"
        note_parts: list[str] = []
        if nisqa_res is not None:
            note_parts.append(
                f"NISQA MOS={nisqa_res.mos_pred:.3f} (min {rec['targetMos']:.2f}), NOI={nisqa_res.noi_pred:.3f}, DIS={nisqa_res.dis_pred:.3f}, COL={nisqa_res.col_pred:.3f}, LOUD={nisqa_res.loud_pred:.3f} (min {min_metric:.2f})."
            )
            if nisqa_passed is True:
                note_parts.append("NISQA meets thresholds.")
            elif nisqa_passed is False:
                note_parts.append("NISQA below thresholds.")
        else:
            note_parts.append(f"NISQA not available: {nisqa_err}")

        if wer is not None:
            if wer <= rec["maxWer"]:
                note_parts.append(f"WER={wer:.3f} meets threshold {rec['maxWer']:.3f}.")
            else:
                status = "REJECTED"
                note_parts.append(f"WER={wer:.3f} exceeds threshold {rec['maxWer']:.3f}.")

        if status != "REJECTED" and auto_passed is True:
            status = "APPROVED"
            note_parts.append("Auto-approved by thresholds.")

        note = " ".join(note_parts) if note_parts else "Python analysis ran."

        update_recording(
            conn,
            req.recordingId,
            status=status,
            transcript=transcript,
            wer=wer,
            snr=None,
            mos=nisqa_res.mos_pred if nisqa_res is not None else None,
            nisqa_noi=nisqa_res.noi_pred if nisqa_res is not None else None,
            nisqa_dis=nisqa_res.dis_pred if nisqa_res is not None else None,
            nisqa_col=nisqa_res.col_pred if nisqa_res is not None else None,
            nisqa_loud=nisqa_res.loud_pred if nisqa_res is not None else None,
            nisqa_model=nisqa_res.model if nisqa_res is not None else None,
            note=note,
            auto_passed=auto_passed,
        )

        return AnalyzeResponse(
            recordingId=req.recordingId,
            status=status,
            werScore=wer,
            transcript=transcript,
            mosScore=nisqa_res.mos_pred if nisqa_res is not None else None,
            nisqaNoiPred=nisqa_res.noi_pred if nisqa_res is not None else None,
            nisqaDisPred=nisqa_res.dis_pred if nisqa_res is not None else None,
            nisqaColPred=nisqa_res.col_pred if nisqa_res is not None else None,
            nisqaLoudPred=nisqa_res.loud_pred if nisqa_res is not None else None,
            autoPassed=auto_passed,
            note=note,
        )
