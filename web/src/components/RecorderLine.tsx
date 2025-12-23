"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  scriptId: string;
  text: string;
  context?: string | null;
  onSubmitted?: () => void;
};

async function decodeAudio(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  const channel = audioBuffer.getChannelData(0);

  let peak = 0;
  let sumSq = 0;

  for (let i = 0; i < channel.length; i++) {
    const v = Math.abs(channel[i]);
    peak = Math.max(peak, v);
    sumSq += channel[i] * channel[i];
  }

  const rms = Math.sqrt(sumSq / Math.max(1, channel.length));
  const durationSec = audioBuffer.duration;

  audioCtx.close();
  return { peak, rms, durationSec };
}

async function sha256Hex(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hashBuf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function RecorderLine({ scriptId, text, context, onSubmitted }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "recording" | "ready" | "uploading">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ peak: number; rms: number; durationSec: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const mimeType = useMemo(() => {
    // Client components still render on the server; guard browser-only APIs.
    if (typeof window === "undefined") return "";

    const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== "function") return "";

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    return candidates.find((c) => MR.isTypeSupported(c)) ?? "";
  }, []);

  const canSubmit = useMemo(() => {
    if (!blob || !metrics) return false;
    // Very simple quality gates (MVP):
    const tooQuiet = metrics.rms < 0.01;
    const clipped = metrics.peak > 0.98;
    return !tooQuiet && !clipped;
  }, [blob, metrics]);

  useEffect(() => {
    if (!blob) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  async function start() {
    setError(null);
    setBlob(null);
    setMetrics(null);

    const MR = (typeof window !== "undefined"
      ? (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
      : undefined);

    if (!MR) {
      setError("Recording is not supported in this environment/browser.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MR(stream, mimeType ? { mimeType } : undefined);
    mediaRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const out = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || "audio/webm" });
      setBlob(out);
      setStatus("ready");
      try {
        const m = await decodeAudio(out);
        setMetrics(m);
      } catch {
        setError("Could not analyze audio. Try again.");
      }
    };

    rec.start();
    setStatus("recording");
  }

  function stop() {
    mediaRef.current?.stop();
  }

  async function submit() {
    if (!blob || !metrics) return;
    setStatus("uploading");
    setError(null);

    const contentType = blob.type || mimeType || "audio/webm";
    const extension = contentType.includes("ogg") ? "ogg" : "webm";

    let audioSha256: string;
    try {
      audioSha256 = await sha256Hex(blob);
    } catch {
      setStatus("ready");
      setError("Could not hash audio. Try again.");
      return;
    }

    let audioS3Uri: string;
    try {
      const fd = new FormData();
      fd.set("scriptId", scriptId);
      fd.set("contentType", contentType);
      fd.set("extension", extension);
      fd.set("sha256", audioSha256);
      fd.set("file", new File([blob], `recording.${extension}`, { type: contentType }));

      const uploadRes = await fetch("/api/uploads/put", {
        method: "POST",
        body: fd,
      });

      if (!uploadRes.ok) {
        const msg = await uploadRes.text();
        setStatus("ready");
        setError(`Upload failed: ${msg}`);
        return;
      }

      const json = (await uploadRes.json()) as { audioS3Uri: string };
      audioS3Uri = json.audioS3Uri;
    } catch (e) {
      setStatus("ready");
      const message = e instanceof Error ? e.message : String(e);
      setError(
        `Upload failed (network/CORS). ${message}. If you're using MinIO in Docker, ensure the browser can reach your S3 endpoint, or use the server-side uploader (this build does).`,
      );
      return;
    }

    const createRes = await fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptId,
        audioS3Uri,
        durationSec: metrics.durationSec,
        audioSha256,
      }),
    });

    if (!createRes.ok) {
      setStatus("ready");
      setError("Could not create recording.");
      return;
    }

    // Either advance to next task (task runner) or hide this line (list UI).
    if (onSubmitted) {
      onSubmitted();
      setStatus("idle");
      setBlob(null);
      setMetrics(null);
      return;
    }

    setHidden(true);
    router.refresh();
  }

  if (hidden) return null;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Line</CardTitle>
          <Badge variant={status === "recording" ? "destructive" : "secondary"}>{status}</Badge>
        </div>
        <div className="space-y-1">
          <div className="text-sm">{text}</div>
          {context ? <div className="text-sm text-muted-foreground">{context}</div> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {previewUrl ? (
          <audio className="w-full" controls src={previewUrl} />
        ) : null}

        {metrics ? (
          <div className="text-sm text-muted-foreground">
            <div>Duration: {metrics.durationSec.toFixed(2)}s</div>
            <div>RMS: {metrics.rms.toFixed(4)} (too low if &lt; 0.0100)</div>
            <div>Peak: {metrics.peak.toFixed(4)} (clipped if &gt; 0.9800)</div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {status !== "recording" ? (
            <Button onClick={start} type="button">
              Record
            </Button>
          ) : (
            <Button onClick={stop} type="button" variant="destructive">
              Stop
            </Button>
          )}

          <Button
            onClick={submit}
            type="button"
            disabled={!canSubmit || status !== "ready"}
            variant="secondary"
          >
            Submit
          </Button>
        </div>

        {metrics && !canSubmit ? (
          <p className="text-sm text-amber-600">
            Submission blocked: audio is too quiet or clipped.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
