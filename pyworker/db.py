import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required")
    # Prisma commonly appends `?schema=public` to DATABASE_URL. psycopg doesn't
    # support that URI query param, so strip it while preserving any others.
    parts = urlsplit(url)
    if not parts.query:
        return url

    query = [(k, v) for (k, v) in parse_qsl(parts.query, keep_blank_values=True) if k.lower() != "schema"]
    new_query = urlencode(query)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


def connect():
    # psycopg accepts standard postgres URLs
    return psycopg.connect(get_database_url())


def fetch_recording(conn, recording_id: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r.id, r.status, r."audioUrl", r."scriptId", r."userId",
                   r."autoScoredAt",
                   r."mosScore", r."snrScore", r."werScore",
                   r."nisqaNoiPred", r."nisqaDisPred", r."nisqaColPred", r."nisqaLoudPred", r."nisqaModel",
                   s.text AS script_text, s."projectId" AS project_id,
                   p."maxWer" AS max_wer, p."maxNoiseFloorDb" AS max_noise_floor_db, p."targetMos" AS target_mos
            FROM "Recording" r
            JOIN "ScriptLine" s ON s.id = r."scriptId"
            JOIN "Project" p ON p.id = s."projectId"
            WHERE r.id = %s
            """,
            (recording_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        (
            rec_id,
            status,
            audio_url,
            script_id,
            user_id,
            auto_scored_at,
            mos_score,
            snr_score,
            wer_score,
            nisqa_noi,
            nisqa_dis,
            nisqa_col,
            nisqa_loud,
            nisqa_model,
            script_text,
            project_id,
            max_wer,
            max_noise_floor_db,
            target_mos,
        ) = row
        return {
            "id": rec_id,
            "status": status,
            "audioUrl": audio_url,
            "scriptId": script_id,
            "userId": user_id,
            "autoScoredAt": auto_scored_at,
            "scriptText": script_text,
            "projectId": project_id,
            "maxWer": float(max_wer) if max_wer is not None else 0.15,
            "maxNoiseFloorDb": float(max_noise_floor_db) if max_noise_floor_db is not None else -40.0,
            "targetMos": float(target_mos) if target_mos is not None else 3.5,
            "mosScore": float(mos_score) if mos_score is not None else None,
            "snrScore": float(snr_score) if snr_score is not None else None,
            "werScore": float(wer_score) if wer_score is not None else None,
            "nisqaNoiPred": float(nisqa_noi) if nisqa_noi is not None else None,
            "nisqaDisPred": float(nisqa_dis) if nisqa_dis is not None else None,
            "nisqaColPred": float(nisqa_col) if nisqa_col is not None else None,
            "nisqaLoudPred": float(nisqa_loud) if nisqa_loud is not None else None,
            "nisqaModel": nisqa_model,
        }


def update_recording(
    conn,
    recording_id: str,
    *,
    status: str,
    transcript: str | None,
    wer: float | None,
    snr: float | None,
    mos: float | None,
    nisqa_noi: float | None = None,
    nisqa_dis: float | None = None,
    nisqa_col: float | None = None,
    nisqa_loud: float | None = None,
    nisqa_model: str | None = None,
    note: str | None,
    auto_passed: bool | None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "Recording"
            SET status = %s,
                transcript = %s,
                "werScore" = %s,
                "snrScore" = %s,
                "mosScore" = %s,
                "nisqaNoiPred" = %s,
                "nisqaDisPred" = %s,
                "nisqaColPred" = %s,
                "nisqaLoudPred" = %s,
                "nisqaModel" = %s,
                "autoScoredAt" = NOW(),
                "autoPassed" = %s,
                "reviewNote" = COALESCE(%s, "reviewNote"),
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (
                status,
                transcript,
                wer,
                snr,
                mos,
                nisqa_noi,
                nisqa_dis,
                nisqa_col,
                nisqa_loud,
                nisqa_model,
                auto_passed,
                note,
                recording_id,
            ),
        )
    conn.commit()
