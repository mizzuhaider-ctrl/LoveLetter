import React, { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface CouplePhotoUploadProps {
  photoUrl?: string;
  onPhotoChange: (url?: string) => void;
}

export const CouplePhotoUpload: React.FC<CouplePhotoUploadProps> = ({
  photoUrl,
  onPhotoChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Downscale image to max 900px for high performance and low storage footprint
        const maxDimension = 900;
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          onPhotoChange(compressedDataUrl);
        } else {
          onPhotoChange(e.target?.result as string);
        }
        setIsLoading(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-rose-900/80 flex items-center gap-1.5">
          <span>Add Couple Photo 📸</span>
          <span className="text-rose-400 font-normal lowercase text-[11px]">(optional)</span>
        </label>
        {photoUrl && (
          <button
            type="button"
            id="remove-photo-text-btn"
            onClick={() => onPhotoChange(undefined)}
            className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Remove
          </button>
        )}
      </div>

      {photoUrl ? (
        <div className="space-y-2">
          <div className="relative group rounded-2xl overflow-hidden border-2 border-rose-200 bg-rose-50/50 shadow-sm flex items-center justify-center">
            <img
              id="couple-photo-preview-img"
              src={photoUrl}
              alt="Couple preview"
              className="w-full h-48 sm:h-52 object-cover rounded-2xl transition-transform duration-300 group-hover:scale-[1.01]"
            />
            {/* Desktop hover controls */}
            <div className="hidden sm:flex absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center gap-3 backdrop-blur-[2px]">
              <button
                type="button"
                id="desktop-change-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-white text-rose-800 text-xs font-semibold rounded-full shadow hover:bg-rose-50 cursor-pointer"
              >
                Change Photo 📸
              </button>
              <button
                type="button"
                id="desktop-remove-photo-btn"
                onClick={() => onPhotoChange(undefined)}
                className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-full shadow hover:bg-rose-700 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Accessible buttons for mobile/touch devices */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              id="mobile-change-photo-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200 shadow-2xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-rose-600" />
              <span>Change Photo</span>
            </button>
            <button
              type="button"
              id="mobile-remove-photo-btn"
              onClick={() => onPhotoChange(undefined)}
              className="py-2 px-3 bg-white hover:bg-rose-50 text-gray-600 hover:text-rose-700 text-xs font-medium rounded-xl border border-rose-200 transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          id="couple-photo-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-2xl p-4 text-center transition-all duration-200 ${
            isDragging
              ? 'border-rose-400 bg-rose-100/40 scale-[1.01]'
              : 'border-rose-200 hover:border-rose-300 bg-rose-50/30 hover:bg-rose-50/60'
          }`}
        >
          <div className="flex flex-col items-center justify-center py-2 text-rose-700/80">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center mb-2 text-rose-500 shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-rose-900">
              {isLoading ? 'Processing photo...' : 'Add Couple Photo 📸'}
            </p>
            <p className="text-xs text-rose-600/70 mt-0.5">
              Drag & drop or tap to select (JPG, PNG)
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
