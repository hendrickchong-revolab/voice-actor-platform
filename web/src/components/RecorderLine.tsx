"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock3, Mic, Pause, Play, SkipBack, SkipForward, Square } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record";
import RecordRTC, { StereoAudioRecorder } from "recordrtc";

type Props = {
  scriptId: string;
  text: string;
  context?: string | null;
  details?: Record<string, string | number | boolean | null | undefined> | null;
  onSubmitted?: () => void;
};

type PromptDetail = {
  key: string;
  label: string;
  value: string;
  emphasis: "primary" | "secondary";
  helpText?: string;
};

async function decodeAudio(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 48000 });
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

function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const total = Math.floor(safe);
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatClockWithMs(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const totalMs = Math.floor(safe * 1000);
  const mm = Math.floor(totalMs / 60000)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor((totalMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const mmm = (totalMs % 1000).toString().padStart(3, "0");
  return `${mm}:${ss}.${mmm}`;
}

function toTitleLabel(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function RecorderLine({ scriptId, text, context, details, onSubmitted }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "ready" | "uploading">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [metrics, setMetrics] = useState<{ peak: number; rms: number; durationSec: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimeSec, setPlaybackTimeSec] = useState(0);
  const [playbackDurationSec, setPlaybackDurationSec] = useState(0);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const [hidden, setHidden] = useState(false);
  const liveWaveRef = useRef<HTMLDivElement | null>(null);
  const playbackWaveRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const playbackWsRef = useRef<WaveSurfer | null>(null);
  const liveWsRef = useRef<WaveSurfer | null>(null);
  const liveRecordPluginRef = useRef<RecordPlugin | null>(null);
  const liveMicPreviewRef = useRef<{ onDestroy: () => void; onEnd: () => void } | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordRtcRef = useRef<{ startRecording: () => void; stopRecording: (cb: () => void) => void; getBlob: () => Blob; destroy?: () => void } | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const canSubmit = useMemo(() => {
    if (!blob || !metrics) return false;
    // Very simple quality gates (MVP):
    const tooQuiet = metrics.rms < 0.01;
    const clipped = metrics.peak > 0.98;
    return !tooQuiet && !clipped;
  }, [blob, metrics]);

  const showRecordedWaveform = Boolean(blob);
  const canPlay = Boolean(blob) && status !== "recording" && status !== "processing";

  const scriptDetails = useMemo<PromptDetail[]>(() => {
    const base: PromptDetail[] = [
      {
        key: "script",
        label: "Script",
        value: text,
        emphasis: "primary",
        helpText: "Read this line exactly as shown.",
      },
      {
        key: "context",
        label: "Context",
        value: context?.trim() || "—",
        emphasis: "secondary",
        helpText: "Apply this tone or emotion while reading.",
      },
    ];

    if (!details) return base;

    const reserved = new Set(["script", "text", "context"]);
    const extras = Object.entries(details)
      .filter(([k]) => !reserved.has(k.toLowerCase()))
      .map(([k, v]) => ({ key: k, value: v }))
      .filter((item) => item.value != null && String(item.value).trim() !== "")
      .map<PromptDetail>((item) => ({
        key: item.key,
        label: toTitleLabel(item.key),
        value: String(item.value),
        emphasis: "secondary",
      }));

    return [...base, ...extras];
  }, [context, details, text]);

  useEffect(() => {
    if (!playbackWaveRef.current || !timelineRef.current) return;

    const ws = WaveSurfer.create({
      container: playbackWaveRef.current,
      waveColor: "#a5b4fc",
      progressColor: "#4f46e5",
      cursorColor: "#1f2937",
      normalize: true,
      height: 96,
      dragToSeek: true,
      interact: true,
    });

    ws.registerPlugin(
      TimelinePlugin.create({
        container: timelineRef.current,
        timeInterval: 1,
        primaryLabelInterval: 5,
        secondaryLabelInterval: 1,
      }),
    );

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("timeupdate", (time) => setPlaybackTimeSec(time));
    ws.on("ready", (duration) => setPlaybackDurationSec(duration));
    ws.on("decode", (duration) => setPlaybackDurationSec(duration));

    playbackWsRef.current = ws;

    return () => {
      ws.destroy();
      playbackWsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!blob) {
      playbackWsRef.current?.empty();
      setIsPlaying(false);
      setPlaybackTimeSec(0);
      setPlaybackDurationSec(0);
      return;
    }

    const url = URL.createObjectURL(blob);
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = url;
    playbackWsRef.current?.load(url);

    return () => {
      URL.revokeObjectURL(url);
      if (playbackUrlRef.current === url) {
        playbackUrlRef.current = null;
      }
    };
  }, [blob]);

  useEffect(() => {
    return () => {
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (liveRecordPluginRef.current?.stopMic) {
        liveRecordPluginRef.current.stopMic();
      }
      liveMicPreviewRef.current?.onDestroy();
      liveWsRef.current?.destroy();
      recordRtcRef.current?.destroy?.();
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") {
      recordingStartedAtRef.current = null;
      return;
    }

    if (recordingStartedAtRef.current == null) {
      recordingStartedAtRef.current = Date.now();
    }

    const tick = () => {
      if (recordingStartedAtRef.current == null) return;
      setRecordingElapsedSec((Date.now() - recordingStartedAtRef.current) / 1000);
    };

    tick();
    const interval = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(interval);
    };
  }, [status]);

  async function startLiveWaveform(stream: MediaStream) {
    if (!liveWaveRef.current) return;

    liveWsRef.current?.destroy();

    const ws = WaveSurfer.create({
      container: liveWaveRef.current,
      waveColor: "#93c5fd",
      progressColor: "#2563eb",
      cursorWidth: 0,
      normalize: true,
      interact: false,
      height: 80,
    });

    const plugin = ws.registerPlugin(
      RecordPlugin.create({
        renderRecordedAudio: false,
        scrollingWaveform: true,
        continuousWaveform: true,
      }),
    );

    liveWsRef.current = ws;
    liveRecordPluginRef.current = plugin;
    liveMicPreviewRef.current = plugin.renderMicStream(stream);
  }

  function stopLiveWaveform() {
    liveMicPreviewRef.current?.onDestroy();
    liveMicPreviewRef.current = null;
    if (liveRecordPluginRef.current?.stopMic) {
      liveRecordPluginRef.current.stopMic();
    }
    liveRecordPluginRef.current = null;
    liveWsRef.current?.destroy();
    liveWsRef.current = null;
  }

  async function start() {
    setError(null);
    setBlob(null);
    setMetrics(null);
    setIsPlaying(false);
    setPlaybackTimeSec(0);
    setPlaybackDurationSec(0);
    setRecordingElapsedSec(0);

    const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getUserMedia) {
      // Common when accessing via http://<LAN-IP>; browsers require HTTPS for mic access.
      const isSecure = typeof window !== "undefined" ? window.isSecureContext : false;
      if (!isSecure) {
        setError(
          "Microphone access requires HTTPS. Localhost works over HTTP, but LAN IPs do not. Use https:// (or access via localhost) to record.",
        );
      } else {
        setError("Microphone access is not available in this browser/environment.");
      }
      return;
    }

    let stream: MediaStream;
    try {
      stream = await mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Microphone permission denied. Please allow microphone access and try again.");
      } else if (name === "NotFoundError") {
        setError("No microphone device found.");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Could not access microphone: ${msg}`);
      }
      return;
    }

    mediaStreamRef.current = stream;

    await startLiveWaveform(stream);

    const recorder = new (RecordRTC as unknown as {
      new (streamArg: MediaStream, options: Record<string, unknown>): {
        startRecording: () => void;
        stopRecording: (cb: () => void) => void;
        getBlob: () => Blob;
        destroy?: () => void;
      };
    })(stream, {
      type: "audio",
      mimeType: "audio/wav",
      recorderType: StereoAudioRecorder,
      sampleRate: 48000,
      desiredSampRate: 48000,
      numberOfAudioChannels: 1,
      disableLogs: true,
    });

    recordRtcRef.current = recorder;
    recorder.startRecording();
    recordingStartedAtRef.current = Date.now();
    setRecordingElapsedSec(0);
    setStatus("recording");
  }

  async function stop() {
    if (status !== "recording") return;
    const recorder = recordRtcRef.current;
    if (!recorder) {
      setStatus("idle");
      setError("Recorder is not ready. Please try again.");
      return;
    }

    setStatus("processing");

    try {
      await new Promise<void>((resolve) => {
        recorder.stopRecording(() => resolve());
      });

      const wav = recorder.getBlob();
      setBlob(wav);
      setPlaybackTimeSec(0);
      const m = await decodeAudio(wav);
      setMetrics(m);
      setStatus("ready");
    } catch {
      setStatus("idle");
      setError("Could not finalize recording. Try again.");
    } finally {
      recorder.destroy?.();
      recordRtcRef.current = null;
      stopLiveWaveform();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      recordingStartedAtRef.current = null;
    }
  }

  async function submit() {
    if (!blob || !metrics) return;
    setStatus("uploading");
    setError(null);

    const contentType = blob.type || "audio/wav";
    const extension = contentType.includes("wav") ? "wav" : contentType.includes("ogg") ? "ogg" : "webm";

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

  function seekBy(secondsDelta: number) {
    const ws = playbackWsRef.current;
    if (!ws) return;
    const duration = ws.getDuration();
    if (!duration || duration <= 0) return;
    const next = Math.min(duration, Math.max(0, ws.getCurrentTime() + secondsDelta));
    ws.seekTo(next / duration);
  }

  if (hidden) return null;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base"></CardTitle>
          <Badge variant={status === "recording" ? "destructive" : "secondary"}>{status}</Badge>
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="space-y-2">
            {scriptDetails.map((entry) => (
              <div
                key={entry.key}
                className={
                  entry.emphasis === "primary"
                    ? "rounded-md border border-primary/30 bg-primary/5 p-3"
                    : "rounded-md border border-muted-foreground/20 bg-background p-3"
                }
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {entry.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{entry.helpText}</span>
                </div>
                <p className={entry.emphasis === "primary" ? "text-base font-semibold" : "text-sm font-medium"}>
                  {entry.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            {showRecordedWaveform ? "Recorded waveform (click to seek)" : "Live waveform"}
          </div>

          <div className={showRecordedWaveform ? "hidden" : "block"} aria-hidden={showRecordedWaveform}>
            <div ref={liveWaveRef} className="min-h-24 rounded-md border bg-muted/20" />
          </div>

          <div className={showRecordedWaveform ? "block" : "hidden"} aria-hidden={!showRecordedWaveform}>
            <div ref={playbackWaveRef} className="min-h-24 rounded-md border bg-muted/20" />
            <div ref={timelineRef} className="text-xs text-muted-foreground" />
          </div>
        </div>

        {status === "recording" ? (
          <div className="relative flex items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={stop}
                type="button"
                variant="destructive"
                size="sm"
                aria-label="Stop recording"
                title="Stop recording"
                className="h-9 w-9 rounded-full p-0"
              >
                <Square className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-destructive">Recording</span>
            </div>

            <div className="absolute right-3 flex items-center gap-1 text-xs tabular-nums text-destructive">
              <Clock3 className="h-4 w-4" />
              <span>{formatClockWithMs(recordingElapsedSec)}</span>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-center rounded-md border bg-muted/20 px-3 py-2">
            <div className="flex items-center justify-center gap-1">
              <Button
                onClick={start}
                type="button"
                variant="destructive"
                size="sm"
                aria-label="Start recording"
                title="Start recording"
                className="h-9 w-9 rounded-full p-0"
              >
                <Mic className="h-4 w-4" />
              </Button>

              <Button
                onClick={() => seekBy(-5)}
                type="button"
                disabled={!canPlay}
                variant="ghost"
                size="sm"
                aria-label="Seek backward 5 seconds"
                title="Back 5s"
                className="h-9 w-9 p-0"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                onClick={() => playbackWsRef.current?.playPause()}
                type="button"
                disabled={!canPlay}
                variant="outline"
                size="sm"
                aria-label={isPlaying ? "Pause playback" : "Play recording"}
                title={isPlaying ? "Pause" : "Play"}
                className="h-9 w-9 p-0"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                onClick={() => seekBy(5)}
                type="button"
                disabled={!canPlay}
                variant="ghost"
                size="sm"
                aria-label="Seek forward 5 seconds"
                title="Forward 5s"
                className="h-9 w-9 p-0"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="absolute right-3 text-xs tabular-nums text-muted-foreground">
              {formatClock(playbackTimeSec)} / {formatClock(playbackDurationSec || metrics?.durationSec || 0)}
            </div>
          </div>
        )}

        {metrics ? (
          <div className="text-sm text-muted-foreground">
            <div>Duration: {metrics.durationSec.toFixed(2)}s</div>
            <div>RMS: {metrics.rms.toFixed(4)} (too low if &lt; 0.0100)</div>
            <div>Peak: {metrics.peak.toFixed(4)} (clipped if &gt; 0.9800)</div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
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
