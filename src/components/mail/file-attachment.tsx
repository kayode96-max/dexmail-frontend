'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, File, Image, FileText, FileArchive, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  cid?: string; // IPFS CID after upload
  url?: string; // Local preview URL
  uploading?: boolean;
  error?: string;
}

interface FileAttachmentProps {
  attachments: FileAttachment[];
  onChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
  maxFileSize?: number; // in bytes, default 10MB
  maxFiles?: number; // default 5
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;

// Get appropriate icon for file type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return FileArchive;
  return File;
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentInput({
  attachments,
  onChange,
  disabled = false,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxFiles = DEFAULT_MAX_FILES
}: FileAttachmentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  // Keep a ref to track current attachments for async operations
  const attachmentsRef = useRef(attachments);
  
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const uploadFile = async (file: File): Promise<{ cid: string } | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return { cid: data.cid };
    } catch (error) {
      console.error('File upload error:', error);
      return null;
    }
  };

  const updateAttachment = useCallback((id: string, updates: Partial<FileAttachment>) => {
    const currentAttachments = attachmentsRef.current;
    const updatedAttachments = currentAttachments.map(a => 
      a.id === id ? { ...a, ...updates } : a
    );
    onChange(updatedAttachments);
  }, [onChange]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Check max files limit
    if (attachments.length + fileArray.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `You can only attach up to ${maxFiles} files.`,
        variant: 'destructive',
      });
      return;
    }

    // Process each file
    const newAttachments: FileAttachment[] = [];
    const filesToUpload: { file: File; attachment: FileAttachment }[] = [];

    for (const file of fileArray) {
      // Check file size
      if (file.size > maxFileSize) {
        toast({
          title: 'File too large',
          description: `"${file.name}" exceeds the ${formatFileSize(maxFileSize)} limit.`,
          variant: 'destructive',
        });
        continue;
      }

      const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      // Add file with uploading state
      const attachment: FileAttachment = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: previewUrl,
        uploading: true,
      };

      newAttachments.push(attachment);
      filesToUpload.push({ file, attachment });
    }

    // Update state with all new attachments (uploading state)
    const updatedAttachments = [...attachments, ...newAttachments];
    onChange(updatedAttachments);

    // Upload files sequentially to properly track state
    for (const { file, attachment } of filesToUpload) {
      const result = await uploadFile(file);
      updateAttachment(attachment.id, {
        cid: result?.cid,
        uploading: false,
        error: result ? undefined : 'Upload failed',
      });
    }
  }, [attachments, maxFileSize, maxFiles, onChange, toast, updateAttachment]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const removeAttachment = useCallback((id: string) => {
    const attachment = attachments.find(a => a.id === id);
    if (attachment?.url) {
      URL.revokeObjectURL(attachment.url);
    }
    onChange(attachments.filter(a => a.id !== id));
  }, [attachments, onChange]);

  return (
    <div className="space-y-3">
      {/* File Input Button and Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
        />
        <Paperclip className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {isDragging ? (
            'Drop files here...'
          ) : (
            <>
              <span className="font-medium text-primary">Click to upload</span> or drag and drop
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {maxFiles} files, up to {formatFileSize(maxFileSize)} each
        </p>
      </div>

      {/* Attached Files List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.type);
            
            return (
              <div
                key={attachment.id}
                className={`
                  flex items-center gap-3 p-2 rounded-lg border bg-card
                  ${attachment.error ? 'border-destructive' : 'border-border'}
                `}
              >
                {/* File Preview/Icon */}
                {attachment.url && attachment.type.startsWith('image/') ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                    {attachment.cid && (
                      <span className="text-green-600 ml-2">✓ Uploaded</span>
                    )}
                    {attachment.error && (
                      <span className="text-destructive ml-2">{attachment.error}</span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {attachment.uploading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {attachment.error && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Note: We'd need to store the original File object to retry
                        // For now, user needs to remove and re-add
                      }}
                    >
                      <span className="sr-only">Retry</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(attachment.id);
                    }}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
