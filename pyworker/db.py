import os
from urllib.parse import urlparse

import psycopg


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required")
    return url


def connect():
    # psycopg accepts standard postgres URLs
    return psycopg.connect(get_database_url())


def fetch_recording(conn, recording_id: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r.id, r.status, r."audioUrl", r."scriptId", r."userId",
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
            "scriptText": script_text,
            "projectId": project_id,
            "maxWer": float(max_wer) if max_wer is not None else 0.15,
            "maxNoiseFloorDb": float(max_noise_floor_db) if max_noise_floor_db is not None else -40.0,
            "targetMos": float(target_mos) if target_mos is not None else 3.5,
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
                "autoScoredAt" = NOW(),
                "autoPassed" = %s,
                "reviewNote" = COALESCE(%s, "reviewNote"),
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (status, transcript, wer, snr, mos, auto_passed, note, recording_id),
        )
    conn.commit()
