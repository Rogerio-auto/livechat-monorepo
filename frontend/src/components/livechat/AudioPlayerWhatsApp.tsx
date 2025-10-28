import { useEffect, useMemo, useRef, useState } from "react";

type AudioPlayerProps = {
  src: string;
  caption?: string | null;
};

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AudioPlayerWhatsApp({ src, caption }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    audio.pause();
    audio.load();
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const progressMax = useMemo(() => {
    if (duration && Number.isFinite(duration)) return duration;
    return Math.max(currentTime, 0) || 0;
  }, [duration, currentTime]);

  return (
    <div className="flex w-full flex-col gap-2 text-zinc-800">
      <div className="flex items-center gap-3 rounded-2xl   bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
          className="flex h-10 w-10 items-center justify-center rounded-full  bg-white text-zinc-700 hover:bg-zinc-100 transition"
        >
          {isPlaying ? (
            <span className="text-lg font-bold">❚❚</span>
          ) : (
            <span className="translate-x-[1px] text-lg font-semibold">▶</span>
          )}
        </button>
        <div className="flex flex-1 flex-col gap-1">
          <input
            type="range"
            min={0}
            max={progressMax || 0}
            step={0.1}
            value={Math.min(currentTime, progressMax || 0)}
            onChange={handleRangeChange}
            onInput={handleRangeChange}
            className="w-44 appearance-none rounded-full accent-emerald-600 md:w-56"
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <audio ref={audioRef} src={src} preload="metadata" />
      </div>
      {caption ? (
        <p className="text-xs text-zinc-600">{caption}</p>
      ) : null}
    </div>
  );
}

export default AudioPlayerWhatsApp;
