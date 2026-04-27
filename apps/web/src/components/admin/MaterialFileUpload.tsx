'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Upload, FileCheck, AlertCircle, Loader2 } from 'lucide-react';
import {
  MATERIAL_ALLOWED_MIME_TYPES,
  MATERIAL_MAX_FILE_SIZE,
  type MaterialTypeValue,
} from '@mpstats/shared';
import { toast } from 'sonner';

const ACCEPT = MATERIAL_ALLOWED_MIME_TYPES.join(',');

export function MaterialFileUpload({
  type,
  currentPath,
  onUploaded,
}: {
  type: MaterialTypeValue;
  currentPath: string | null;
  onUploaded: (path: string, size: number, mime: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const requestUploadUrlMut = trpc.material.requestUploadUrl.useMutation();

  const handleFile = async (file: File) => {
    setError(null);

    if (file.size > MATERIAL_MAX_FILE_SIZE) {
      const msg = `Файл больше 25 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
      setError(msg);
      return;
    }
    if (!(MATERIAL_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      const msg = `Тип файла "${file.type || 'неизвестен'}" не поддерживается. Разрешены: PDF, XLSX, DOCX, CSV`;
      setError(msg);
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const { storagePath, uploadUrl } = await requestUploadUrlMut.mutateAsync({
        type,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      // Direct PUT to Supabase Storage (bypasses Next.js body limit, D-11)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      onUploaded(storagePath, file.size, file.type);
      toast.success('Файл загружен');
      setProgress(100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error('Ошибка загрузки: ' + msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-mp-blue-500 bg-mp-blue-50'
            : 'border-mp-gray-300 hover:border-mp-blue-500 hover:bg-mp-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-mp-blue-600" />
            <p className="text-mp-gray-600">Загрузка… {progress}%</p>
            <div className="w-full bg-mp-gray-200 rounded-full h-2 mt-2 max-w-xs mx-auto">
              <div
                className="bg-mp-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : currentPath ? (
          <>
            <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-mp-gray-700 text-sm font-medium">
              Файл загружен: {currentPath.split('/').pop()}
            </p>
            <p className="text-xs text-mp-gray-500 mt-1">
              Перетащите новый, чтобы заменить
            </p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-mp-gray-400" />
            <p className="text-mp-gray-700">
              Перетащите файл сюда или кликните для выбора
            </p>
            <p className="text-xs text-mp-gray-500 mt-1">
              PDF, XLSX, DOCX, CSV — до 25 MB
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
