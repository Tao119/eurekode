"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FileAttachment, FileMediaType } from "@/types/chat";

// Supported file types and their MIME types
const SUPPORTED_FILE_TYPES: Record<string, FileMediaType> = {
  // Images
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
  // Documents
  "application/pdf": "application/pdf",
  // Text files
  "text/plain": "text/plain",
  "text/html": "text/html",
  "text/css": "text/css",
  "text/javascript": "text/javascript",
  "application/javascript": "application/javascript",
  "text/typescript": "text/typescript",
  "application/json": "application/json",
  "text/markdown": "text/markdown",
  "text/csv": "text/csv",
  "application/xml": "application/xml",
  "text/xml": "text/xml",
  "text/x-python": "text/x-python",
  "text/x-java": "text/x-java",
  "text/x-c": "text/x-c",
  "text/x-cpp": "text/x-cpp",
  "text/x-csharp": "text/x-csharp",
  "text/x-go": "text/x-go",
  "text/x-rust": "text/x-rust",
  "text/x-ruby": "text/x-ruby",
  "text/x-php": "text/x-php",
  "text/x-swift": "text/x-swift",
  "text/x-kotlin": "text/x-kotlin",
  "text/x-scala": "text/x-scala",
  "text/x-shellscript": "text/x-shellscript",
  "text/x-sql": "text/x-sql",
  "text/x-yaml": "text/x-yaml",
  "application/x-yaml": "application/x-yaml",
  "text/x-toml": "text/x-toml",
  "application/toml": "application/toml",
};

// File size limits
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images
const MAX_FILES = 5;

// Extension to MIME type mapping (module-level to avoid recreation)
const EXTENSION_TO_MIME: Record<string, FileMediaType> = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  // Documents
  pdf: "application/pdf",
  // Text/markup
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  xml: "application/xml",
  json: "application/json",
  // JavaScript/TypeScript
  js: "text/javascript",
  jsx: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  ts: "text/typescript",
  tsx: "text/typescript",
  mts: "text/typescript",
  cts: "text/typescript",
  // Python
  py: "text/x-python",
  pyw: "text/x-python",
  pyx: "text/x-python",
  pyi: "text/x-python",
  // Java/JVM
  java: "text/x-java",
  kt: "text/x-kotlin",
  kts: "text/x-kotlin",
  scala: "text/x-scala",
  groovy: "text/plain",
  // C/C++
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-cpp",
  cc: "text/x-cpp",
  cxx: "text/x-cpp",
  hpp: "text/x-cpp",
  hh: "text/x-cpp",
  hxx: "text/x-cpp",
  // C#/F#
  cs: "text/x-csharp",
  fs: "text/plain",
  fsx: "text/plain",
  // Go
  go: "text/x-go",
  // Rust
  rs: "text/x-rust",
  // Ruby
  rb: "text/x-ruby",
  rake: "text/x-ruby",
  gemspec: "text/x-ruby",
  // PHP
  php: "text/x-php",
  phtml: "text/x-php",
  // Swift/Objective-C
  swift: "text/x-swift",
  m: "text/plain",
  mm: "text/plain",
  // Shell scripts
  sh: "text/x-shellscript",
  bash: "text/x-shellscript",
  zsh: "text/x-shellscript",
  fish: "text/x-shellscript",
  ps1: "text/plain",
  psm1: "text/plain",
  bat: "text/plain",
  cmd: "text/plain",
  // SQL
  sql: "text/x-sql",
  // Config/Data files
  yaml: "text/x-yaml",
  yml: "text/x-yaml",
  toml: "text/x-toml",
  ini: "text/plain",
  conf: "text/plain",
  cfg: "text/plain",
  env: "text/plain",
  properties: "text/plain",
  // Markup/Templates
  vue: "text/plain",
  svelte: "text/plain",
  astro: "text/plain",
  ejs: "text/plain",
  erb: "text/plain",
  hbs: "text/plain",
  pug: "text/plain",
  jade: "text/plain",
  twig: "text/plain",
  // Other languages
  lua: "text/plain",
  r: "text/plain",
  R: "text/plain",
  pl: "text/plain",
  pm: "text/plain",
  ex: "text/plain",
  exs: "text/plain",
  erl: "text/plain",
  hrl: "text/plain",
  clj: "text/plain",
  cljs: "text/plain",
  cljc: "text/plain",
  hs: "text/plain",
  lhs: "text/plain",
  elm: "text/plain",
  ml: "text/plain",
  mli: "text/plain",
  nim: "text/plain",
  zig: "text/plain",
  d: "text/plain",
  dart: "text/plain",
  v: "text/plain",
  sv: "text/plain",
  vhd: "text/plain",
  vhdl: "text/plain",
  // Build/Config
  makefile: "text/plain",
  dockerfile: "text/plain",
  // Misc
  graphql: "text/plain",
  gql: "text/plain",
  proto: "text/plain",
  thrift: "text/plain",
  lock: "text/plain",
  log: "text/plain",
  diff: "text/plain",
  patch: "text/plain",
};

// Common text file extensions for permissive acceptance
const TEXT_FILE_EXTENSIONS = new Set([
  // Already in EXTENSION_TO_MIME, plus more
  "txt", "text", "log", "readme", "license", "authors", "changelog",
  "gitignore", "gitattributes", "editorconfig", "prettierrc", "eslintrc",
  "babelrc", "npmrc", "nvmrc", "dockerignore", "browserslistrc",
]);

interface ChatInputProps {
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function getMimeTypeFromExtension(ext: string): FileMediaType | null {
  // Check explicit mapping first
  if (EXTENSION_TO_MIME[ext]) {
    return EXTENSION_TO_MIME[ext];
  }
  // Accept common text file extensions as text/plain
  if (TEXT_FILE_EXTENSIONS.has(ext.toLowerCase())) {
    return "text/plain";
  }
  return null;
}

// Check if a file is likely a text file based on MIME type
function isTextBasedMimeType(mimeType: string): boolean {
  return mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript" ||
    mimeType === "application/x-yaml" ||
    mimeType === "application/toml";
}

// Check if a file is likely a binary file (images, PDFs, etc.)
function isBinaryFile(mimeType: string): boolean {
  return mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("application/octet-stream");
}

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  isLoading = false,
  placeholder = "メッセージを入力...",
  maxLength = 4000,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => setUploadError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);

  const processFile = useCallback(async (file: File): Promise<FileAttachment | null> => {
    // Determine MIME type
    let mimeType: FileMediaType | null = SUPPORTED_FILE_TYPES[file.type] || null;

    if (!mimeType) {
      // Try to determine from extension
      const ext = getFileExtension(file.name);
      const extMime = getMimeTypeFromExtension(ext);
      if (extMime) {
        mimeType = extMime;
      } else if (ext && !isBinaryFile(file.type)) {
        // For unknown extensions that aren't binary, treat as text/plain
        // This allows any text-like file to be uploaded
        mimeType = "text/plain";
      } else if (isTextBasedMimeType(file.type)) {
        // If browser reports a text-based MIME type, use text/plain
        mimeType = "text/plain";
      } else {
        setUploadError(`サポートされていないファイル形式です: ${file.name}`);
        return null;
      }
    }

    // Check file size
    const maxSize = isImageType(mimeType) ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      setUploadError(`ファイルサイズが大きすぎます（最大${maxSizeMB}MB）: ${file.name}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = base64.split(",")[1];

        const attachment: FileAttachment = {
          id: generateId(),
          name: file.name,
          type: mimeType,
          size: file.size,
          data: base64Data,
          previewUrl: isImageType(mimeType) ? base64 : undefined,
        };
        resolve(attachment);
      };
      reader.onerror = () => {
        setUploadError(`ファイルの読み込みに失敗しました: ${file.name}`);
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_FILES - attachments.length;

    if (fileArray.length > remainingSlots) {
      setUploadError(`最大${MAX_FILES}ファイルまでアップロードできます`);
      return;
    }

    const newAttachments: FileAttachment[] = [];
    for (const file of fileArray) {
      const attachment = await processFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  }, [attachments.length, processFile]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [handleFiles]);

  const handleSend = () => {
    const trimmed = input.trim();
    if ((trimmed || attachments.length > 0) && !disabled && !isLoading) {
      onSend(trimmed, attachments.length > 0 ? attachments : undefined);
      setInput("");
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME変換中（日本語入力の確定など）はスキップ
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleButtonClick = () => {
    if (isLoading && onStop) {
      onStop();
    } else {
      handleSend();
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Paste handler for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      const files: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }

      if (files.length > 0) {
        handleFiles(files);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFiles]);

  // Accept all text files, images, and PDFs
  // Using text/* allows any text-based file including code files
  const acceptedTypes = "image/jpeg,image/png,image/gif,image/webp,application/pdf,text/*,application/json,application/xml,application/javascript,application/x-yaml,application/toml,.py,.js,.ts,.jsx,.tsx,.go,.rs,.rb,.java,.c,.cpp,.h,.hpp,.cs,.php,.swift,.kt,.scala,.sh,.bash,.sql,.yaml,.yml,.toml,.vue,.svelte";

  return (
    <div
      className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mx-auto max-w-4xl px-3 sm:px-4 py-3 sm:py-4">
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-xl">
            <div className="text-center">
              <span className="material-symbols-outlined text-4xl text-primary">upload_file</span>
              <p className="text-sm text-primary mt-2">ファイルをドロップ</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="mb-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {uploadError}
          </div>
        )}

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-2 sm:mb-3 flex flex-wrap gap-1.5 sm:gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-muted rounded-lg border border-border"
              >
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-primary/10 rounded">
                    <span className="material-symbols-outlined text-primary text-base sm:text-lg">
                      {attachment.type === "application/pdf" ? "picture_as_pdf" : "description"}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0 max-w-[80px] sm:max-w-[120px]">
                  <p className="text-[10px] sm:text-xs font-medium truncate">{attachment.name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-destructive text-destructive-foreground rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  title="削除"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-1.5 sm:gap-2">
          {/* File upload button */}
          <Button
            type="button"
            onClick={handleFileButtonClick}
            disabled={disabled || isLoading || attachments.length >= MAX_FILES}
            size="icon"
            variant="ghost"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl shrink-0"
            title="ファイルを添付（画像、PDF、コード）"
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">attach_file</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl border border-border bg-card",
                "px-3 py-2.5 pr-10 sm:px-4 sm:py-3 sm:pr-12",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "min-h-[44px] sm:min-h-[48px] max-h-[150px] sm:max-h-[200px]"
              )}
            />
            <div className="absolute right-2 sm:right-3 bottom-2.5 sm:bottom-3 text-[10px] sm:text-xs text-muted-foreground">
              {input.length}/{maxLength}
            </div>
          </div>

          {/* Send/Stop Button */}
          <Button
            onClick={handleButtonClick}
            disabled={!isLoading && (disabled || (!input.trim() && attachments.length === 0))}
            size="icon"
            variant={isLoading ? "destructive" : "default"}
            className={cn(
              "h-10 w-10 sm:h-12 sm:w-12 rounded-xl shrink-0 transition-all",
              isLoading && "animate-pulse"
            )}
            title={isLoading ? "生成を停止" : "送信"}
          >
            <span className="material-symbols-outlined text-xl sm:text-2xl">
              {isLoading ? "stop" : "send"}
            </span>
          </Button>
        </div>

        <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-center text-muted-foreground">
          {isLoading
            ? "生成中... タップで停止"
            : <>
                <span className="hidden sm:inline">Shift + Enter で改行、Enter で送信 | 画像・PDF・コード対応</span>
                <span className="sm:hidden">Enter で送信 | 画像・PDF・コード対応</span>
              </>
          }
        </p>
      </div>
    </div>
  );
}
