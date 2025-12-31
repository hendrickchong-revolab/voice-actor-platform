export function InlineAudioPlayer({
  recordingId,
  className = "w-full",
}: {
  recordingId: string;
  className?: string;
}) {
  return (
    <audio
      className={className}
      controls
      preload="none"
      src={`/api/uploads/play?recordingId=${encodeURIComponent(recordingId)}`}
    />
  );
}


