import React, { useRef, useState } from 'react';
import { ProjectAttachment } from '@/types/database.types';
import { filesToProjectAttachments, formatFileSize } from '@/services/projectService';
import {
  Paperclip,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  X,
  Download,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per file

const ACCEPTED_EXTENSIONS =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.png,.jpg,.jpeg,.webp,.zip';

interface ProjectAttachmentUploaderProps {
  attachments: ProjectAttachment[];
  onChange: (next: ProjectAttachment[]) => void;
  uploadedBy?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export function getAttachmentBadgeStyle(ext: string): { bg: string; icon: React.ReactNode } {
  const upper = (ext || '').toUpperCase();
  if (upper === 'PDF') {
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <FileText className="h-3.5 w-3.5 text-rose-600 shrink-0" />,
    };
  }
  if (upper === 'DOC' || upper === 'DOCX' || upper === 'RTF' || upper === 'TXT') {
    return {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />,
    };
  }
  if (upper === 'XLS' || upper === 'XLSX' || upper === 'CSV') {
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />,
    };
  }
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(upper)) {
    return {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <FileImage className="h-3.5 w-3.5 text-purple-600 shrink-0" />,
    };
  }
  return {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: <FileIcon className="h-3.5 w-3.5 text-amber-700 shrink-0" />,
  };
}

export function ProjectAttachmentUploader({
  attachments,
  onChange,
  uploadedBy,
  disabled = false,
  readOnly = false,
}: ProjectAttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    setUploadError(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setUploadError(
        `File(s) exceed 25 MB limit: ${oversized.map((f) => f.name).join(', ')}`
      );
      return;
    }

    const converted = await filesToProjectAttachments(files, uploadedBy);
    onChange([...attachments, ...converted]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || readOnly) return;
    if (e.dataTransfer.files) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-2.5">
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-all cursor-pointer ${
            disabled
              ? 'opacity-60 cursor-not-allowed border-divider bg-ivory/40'
              : isDragging
                ? 'border-forest bg-sage-pale/40'
                : 'border-divider bg-ivory/40 hover:border-forest/60 hover:bg-sage-pale/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest mb-2">
            <UploadCloud className="h-4.5 w-4.5" />
          </div>
          <p className="text-xs font-semibold text-ink-primary">
            Click to upload or drag & drop project attachments
          </p>
          <p className="text-[11px] text-ink-muted mt-0.5">
            Supports PDF, Word (.doc, .docx), Excel (.xls, .xlsx, .csv), PowerPoint, Images, TXT, ZIP (Max 25 MB each)
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-2.5 h-7 text-[11px] border-forest/30 text-forest hover:bg-forest hover:text-sage"
          >
            <Paperclip className="h-3 w-3 mr-1" />
            Choose Files
          </Button>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center space-x-1.5 rounded-md border border-red-200 bg-rose-50 px-3 py-2 text-[11px] text-status-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-secondary">
            <span>Attached Files ({attachments.length})</span>
          </div>
          <div className="divide-y divide-divider/60 rounded-lg border border-divider bg-white overflow-hidden">
            {attachments.map((att) => {
              const style = getAttachmentBadgeStyle(att.extension);
              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-ivory/40 transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {style.icon}
                    <div className="min-w-0">
                      <p className="font-medium text-ink-primary truncate">{att.name}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-ink-muted">
                        <span
                          className={`inline-block rounded px-1.5 py-0.2 font-mono font-semibold border ${style.bg}`}
                        >
                          {att.extension}
                        </span>
                        <span>{formatFileSize(att.size)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    {att.data_url && (
                      <a
                        href={att.data_url}
                        download={att.name}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-ink-secondary hover:text-forest hover:bg-sage-pale/40 transition-colors"
                        title="Download file"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {!readOnly && !disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemove(att.id)}
                        className="p-1.5 rounded-md text-ink-muted hover:text-status-danger hover:bg-rose-50 transition-colors"
                        title="Remove attachment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
