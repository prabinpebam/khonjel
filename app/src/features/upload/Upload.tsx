import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, FileAudio, Loader2, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { useServices } from "@services";
import type { UploadJob } from "@services/ports";
import { PageHeader } from "@components/common/PageHeader";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Progress } from "@components/ui/progress";
import { formatDuration } from "@lib/format";
import { cn } from "@lib/utils";

export function Upload() {
  const { content } = useServices();
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void content.uploads().then((u) => {
      if (live) setJobs(u);
    });
    return () => {
      live = false;
    };
  }, [content]);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: UploadJob[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      filename: file.name,
      durationSec: 0,
      format: file.name.split(".").pop() ?? "audio",
      state: "done",
      progress: 100,
      result: `Mock transcription of ${file.name}.`,
    }));
    setJobs((prev) => [...next, ...prev]);
  }

  function remove(id: string) {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }

  return (
    <div>
      <PageHeader title="Upload" description="Transcribe an existing audio file on device." />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragOver ? "border-accent bg-surface-2" : "border-border bg-surface",
        )}
      >
        <span className="grid size-12 place-items-center rounded-pill bg-cat-upload/12 text-cat-upload">
          <UploadCloud className="size-6" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Drop an audio file or click to browse
        </span>
        <span className="text-xs text-tertiary-foreground">MP3, WAV, M4A, FLAC</span>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </button>

      <div className="mt-6 flex flex-col gap-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-start gap-3 rounded-md border border-border bg-surface p-4"
          >
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-muted-foreground">
              <FileAudio className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{job.filename}</span>
                <UploadBadge state={job.state} />
              </div>
              <p className="mt-0.5 text-xs text-tertiary-foreground">
                {job.format.toUpperCase()}
                {job.durationSec > 0 ? ` · ${formatDuration(job.durationSec)}` : ""}
              </p>

              {job.state === "transcribing" ? (
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={job.progress} className="flex-1" />
                  <span className="text-xs text-tertiary-foreground">{job.progress}%</span>
                </div>
              ) : null}

              {job.state === "done" && job.result ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{job.result}</p>
              ) : null}

              {job.state === "error" ? (
                <p className="mt-2 text-sm text-danger">{job.error ?? "Transcription failed."}</p>
              ) : null}

              {job.state === "done" ? (
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="secondary" size="sm">
                    Save as note
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Copy />
                    Copy
                  </Button>
                </div>
              ) : null}

              {job.state === "error" ? (
                <Button variant="secondary" size="sm" className="mt-3">
                  <RotateCcw />
                  Retry
                </Button>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => remove(job.id)}
              className="text-muted-foreground hover:text-danger"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadBadge({ state }: { state: UploadJob["state"] }) {
  if (state === "queued") return <Badge variant="neutral">Queued</Badge>;
  if (state === "transcribing")
    return (
      <Badge variant="accent">
        <Loader2 className="size-3 animate-spin" />
        Transcribing
      </Badge>
    );
  if (state === "error") return <Badge variant="danger">Error</Badge>;
  return (
    <Badge variant="success">
      <CheckCircle2 className="size-3" />
      Done
    </Badge>
  );
}
