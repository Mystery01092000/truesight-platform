"use client";

import { useCallback, useState } from "react";
import { Upload, FileUp, CheckCircle, AlertCircle } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils/cn";
import { presignKbUpload, uploadToPresignedUrl, ingestKb } from "@/lib/kb/client";

export function KbUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const reset = () => {
    setFile(null);
    setMessage(null);
  };

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setMessage(null);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    handleFile(dropped ?? null);
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);

    try {
      const key = `uploads/${Date.now()}-${file.name}`;
      const presign = await presignKbUpload(key, file.type || "application/octet-stream");
      await uploadToPresignedUrl(presign.url, file, file.type || undefined);
      const result = await ingestKb(["s3"]);
      setMessage({
        type: "success",
        text: `Uploaded and ingested ${result.documentCount} document(s), ${result.chunkCount} chunk(s).`,
      });
      setFile(null);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Upload or ingest failed",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Reveal delay={0.1}>
      <Surface level={1} radius="lg" className="p-5">
        <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
          Upload document
        </h2>
        <p className="mt-1 text-label leading-[1.5] text-mute">
          Drop a file to upload to S3 and ingest into the knowledge base.
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-hairline px-6 py-8 transition-colors",
            dragOver && "border-iris bg-iris-soft",
            !dragOver && "hover:border-hairline-strong hover:bg-surface-elevated",
          )}
        >
          <input
            type="file"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="kb-file-input"
          />
          <label htmlFor="kb-file-input" className="flex cursor-pointer flex-col items-center">
            {file ? (
              <FileUp size={28} strokeWidth={1.5} className="text-iris" />
            ) : (
              <Upload size={28} strokeWidth={1.5} className="text-mute" />
            )}
            <span className="mt-3 text-[14px] text-ink">
              {file ? file.name : "Click or drag a file here"}
            </span>
            <span className="mt-1 text-[12px] text-ash">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Any document type"}
            </span>
          </label>
        </div>

        {message && (
          <div
            className={cn(
              "mt-4 flex items-start gap-2 rounded-md p-3 text-label leading-[1.5]",
              message.type === "success"
                ? "bg-accent-green-soft text-accent-green"
                : "bg-accent-red-soft text-accent-red",
            )}
          >
            {message.type === "success" ? (
              <CheckCircle size={16} strokeWidth={1.75} />
            ) : (
              <AlertCircle size={16} strokeWidth={1.75} />
            )}
            {message.text}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload & ingest"}
          </Button>
          {file && (
            <Button variant="tertiary" onClick={reset} disabled={uploading}>
              Clear
            </Button>
          )}
        </div>
      </Surface>
    </Reveal>
  );
}
