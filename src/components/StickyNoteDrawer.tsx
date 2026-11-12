import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Trash2,
  Check,
  Bold,
  Palette,
  Clock,
  FileText,
  Bookmark,
  Image as ImageIcon,
  Upload,
  Maximize2,
  Loader2,
  ZoomIn,
  Plus,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { StickyNoteItem, formatDisplayDate } from '../types';
function cleanPastedMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z0-9_-]*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
import { ImageZoomLightbox } from './ImageZoomLightbox';

interface StickyNoteDrawerProps {
  note: StickyNoteItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (note: StickyNoteItem) => void;
  onDelete: (id: string) => void;
  allNotes?: StickyNoteItem[];
  onSelectNote?: (note: StickyNoteItem) => void;
  onNavigateToPage?: (pageNumber: number) => void;
  fileName?: string;
}

const PRESET_COLORS = [
  { bg: '#fef08a', text: '#000000', name: 'زرد کلاسیک' },
  { bg: '#bbf7d0', text: '#000000', name: 'سبز نعنایی' },
  { bg: '#fed7aa', text: '#000000', name: 'هلویی' },
  { bg: '#bae6fd', text: '#000000', name: 'آبی آسمانی' },
  { bg: '#e9d5ff', text: '#000000', name: 'یاسی' },
  { bg: '#fecdd3', text: '#000000', name: 'صورتی روشن' },
  { bg: '#f5f5f5', text: '#000000', name: 'طوسی خنثی' },
];

/**
 * Compresses an image file before storing as base64 string
 */
async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('فایل انتخاب شده تصویر نیست.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const StickyNoteDrawer: React.FC<StickyNoteDrawerProps> = ({
  note,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  allNotes,
  onSelectNote,
  onNavigateToPage,
  fileName,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#fef08a');
  const [textColor, setTextColor] = useState('#000000');
  const [isBold, setIsBold] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);
  const [showDeleteAllImagesConfirm, setShowDeleteAllImagesConfirm] = useState(false);
  const [deleteImageIndexConfirm, setDeleteImageIndexConfirm] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentIndex = allNotes && note ? allNotes.findIndex((n) => n.id === note.id) : -1;
  const hasMultipleNotes = Boolean(allNotes && allNotes.length > 1);

  const handleNavigateNote = (direction: 'prev' | 'next') => {
    if (!allNotes || allNotes.length <= 1 || currentIndex === -1 || !note) return;
    // Auto-save current note changes first
    onUpdate({
      ...note,
      title: cleanPastedMarkdown(title).replace(/\n/g, ' ').trim() || 'یادداشت چسبان',
      content: content.trim(),
      color,
      textColor: '#000000',
      isBold,
      images,
      imageUrl: images[0] || undefined,
    });

    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % allNotes.length
        : (currentIndex - 1 + allNotes.length) % allNotes.length;
    const targetNote = allNotes[nextIndex];
    if (targetNote) {
      onSelectNote?.(targetNote);
      if (onNavigateToPage && targetNote.pageNumber) {
        onNavigateToPage(targetNote.pageNumber);
      }
    }
  };

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setColor(note.color || '#fef08a');
      setTextColor('#000000');
      setIsBold(Boolean(note.isBold));
      const initImages =
        note.images && note.images.length > 0
          ? note.images
          : note.imageUrl
          ? [note.imageUrl]
          : [];
      setImages(initImages);
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const handleClose = () => {
    if (note && (title !== note.title || content !== note.content || color !== note.color)) {
      onUpdate({
        ...note,
        title: cleanPastedMarkdown(title).replace(/\n/g, ' ').trim() || 'یادداشت چسبان',
        content: content.trim(),
        color,
        textColor: '#000000',
        isBold,
        images,
        imageUrl: images[0] || undefined,
      });
    }
    onClose();
  };

  const handleSave = () => {
    onUpdate({
      ...note,
      title: cleanPastedMarkdown(title).replace(/\n/g, ' ').trim() || 'یادداشت چسبان',
      content: content.trim(),
      color,
      textColor: '#000000',
      isBold,
      images,
      imageUrl: images[0] || undefined,
    });
    onClose();
  };

  const handleOpenDeleteConfirm = () => {
    setShowDeleteNoteConfirm(true);
  };

  const handleConfirmDeleteNote = () => {
    setShowDeleteNoteConfirm(false);
    onDelete(note.id);
    onClose();
  };

  const handleSelectColor = (bg: string, txt: string) => {
    setColor(bg);
    setTextColor('#000000');
  };

  const processMultipleImageFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    try {
      setIsUploadingImage(true);
      const compressedList = await Promise.all(
        imageFiles.map((file) => compressImage(file))
      );
      setImages((prev) => [...prev, ...compressedList]);
    } catch (err) {
      console.error('Failed to process images:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processMultipleImageFiles(files);
    }
    e.target.value = '';
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (lightboxIndex === indexToRemove) {
      setLightboxIndex(null);
    }
  };

  const handleContentPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        await processMultipleImageFiles(imageFiles);
        return;
      }
    }

    const pastedText = e.clipboardData?.getData('text/plain');
    if (pastedText) {
      e.preventDefault();
      const cleaned = cleanPastedMarkdown(pastedText);
      const target = e.currentTarget;

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, cleaned);
      } catch {}

      if (inserted) {
        setContent(target.value);
      } else {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const val = target.value;
        const updated = val.slice(0, start) + cleaned + val.slice(end);
        setContent(updated);
        const newCursorPos = start + cleaned.length;
        requestAnimationFrame(() => {
          if (target) {
            target.setSelectionRange(newCursorPos, newCursorPos);
          }
        });
      }
    }
  };

  const handleTitlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData?.getData('text/plain');
    if (pastedText) {
      e.preventDefault();
      const cleaned = cleanPastedMarkdown(pastedText).replace(/\n/g, ' ').trim();
      const target = e.currentTarget;

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, cleaned);
      } catch {}

      if (inserted) {
        setTitle(target.value);
      } else {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const val = target.value;
        const updated = val.slice(0, start) + cleaned + val.slice(end);
        setTitle(updated);
        const newCursorPos = start + cleaned.length;
        requestAnimationFrame(() => {
          if (target) {
            target.setSelectionRange(newCursorPos, newCursorPos);
          }
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processMultipleImageFiles(files);
    }
  };

  const drawerMarkup = (
    <>
      <div
        className="fixed inset-0 z-[9999] overflow-hidden select-none bg-black/50 backdrop-blur-2xs flex justify-end"
        onClick={handleClose}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        dir="rtl"
      >
        <div
          className={`w-full sm:w-[600px] md:w-[680px] lg:w-[740px] max-w-full h-full bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-250 transform-gpu ${
            isDraggingOver ? 'ring-4 ring-blue-500/50' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hidden Multi-File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70 shrink-0 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-xs shrink-0"
                style={{ backgroundColor: color }}
              />
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5 shrink-0">
                <Bookmark className="w-4 h-4 text-neutral-600" />
                <span>
                  {fileName ? `${fileName} - ` : ''}یادداشت صفحه {note.pageNumber}
                </span>
              </h3>

              {/* Navigation between notes in this document */}
              {hasMultipleNotes && currentIndex !== -1 && (
                <div className="flex items-center gap-1 mr-2 px-2 py-0.5 bg-white rounded-full border border-neutral-200 text-xs font-mono text-neutral-600 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleNavigateNote('prev')}
                    className="p-1 hover:text-neutral-900 hover:bg-neutral-100 rounded-full cursor-pointer transition-colors"
                    title="یادداشت قبلی"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="tabular-nums font-semibold px-1 text-[11px]">
                    {currentIndex + 1} از {allNotes!.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavigateNote('next')}
                    className="p-1 hover:text-neutral-900 hover:bg-neutral-100 rounded-full cursor-pointer transition-colors"
                    title="یادداشت بعدی"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleOpenDeleteConfirm}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 cursor-pointer ios-spring-btn"
                title="حذف یادداشت"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/25 ios-spring-btn transition-transform"
                title="خروج و بستن"
                aria-label="خروج و بستن"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Drawer Body Form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 flex flex-col">
            {/* Note Title */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                عنوان یادداشت
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onPaste={handleTitlePaste}
                placeholder="یک عنوان خلاصه..."
                className="w-full px-4 py-2.5 text-sm sm:text-base bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all font-semibold text-neutral-900 shadow-2xs text-right"
                dir="rtl"
              />
            </div>

            {/* Color Palettes */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                <span>رنگ برگه چسبان</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((preset) => {
                  const isSelected = color === preset.bg;
                  return (
                    <button
                      key={preset.bg}
                      onClick={() => handleSelectColor(preset.bg, preset.text)}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ios-spring-tool transition-transform ${
                        isSelected
                          ? 'border-neutral-900 scale-110 shadow-sm ring-2 ring-neutral-400'
                          : 'border-neutral-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.bg }}
                      title={preset.name}
                    >
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5"
                          style={{ color: preset.text }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note Tools Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBold(!isBold)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ios-spring-btn transition-colors ${
                    isBold
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                  }`}
                >
                  <Bold className="w-3.5 h-3.5" />
                  <span>متن بولد (ضخیم)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer ios-spring-btn transition-colors shadow-2xs"
                  title="انتخاب یا پیست چند عکس در استیکی‌نوت"
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>{images.length > 0 ? `افزودن عکس بیشتر (${images.length})` : 'افزودن عکس'}</span>
                </button>
              </div>

              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAllImagesConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors"
                  title="حذف تمام عکس‌ها"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف تمام عکس‌ها</span>
                </button>
              )}
            </div>

            {/* Unified Sticky Note Canvas (Text & Images directly together on the note paper) */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-[360px]">
              <label className="block text-xs font-semibold text-neutral-600 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>برگه یادداشت چسبان</span>
                </span>
                <span className="text-[11px] text-neutral-400 font-normal">
                  (متن و عکس‌ها درون یک برگه یکپارچه‌اند)
                </span>
              </label>

              <div
                className="rounded-2xl p-4 sm:p-5 shadow-md flex-1 flex flex-col justify-center min-h-[360px] transition-colors border border-black/5"
                style={{ backgroundColor: color }}
              >
                {/* Textarea inside the note - Spacious, fills note width cleanly without empty side bands */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handleContentPaste}
                  placeholder="متن یادداشت، نکته یا خلاصه درس را بنویسید (می‌توانید با Ctrl+V عکس پیست کنید)..."
                  className="w-full bg-transparent resize-none border-none focus:outline-none text-sm sm:text-base leading-relaxed font-sans placeholder:text-neutral-500/70 flex-1 min-h-[260px] h-full text-right px-1.5 py-1 my-auto"
                  dir="rtl"
                  style={{
                    color: '#000000',
                    fontWeight: isBold ? 700 : 400,
                  }}
                />

                {/* Compact Image Preset Thumbnail Strip - Small, space-saving preview */}
                {images.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-black/10 shrink-0">
                    <div
                      className="flex items-center justify-between mb-2 text-xs font-bold text-neutral-950"
                      style={{ color: '#000000' }}
                    >
                      <span className="flex items-center gap-1.5 opacity-90">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>تصاویر پیوست ({images.length})</span>
                        <span className="text-[10px] font-normal opacity-70">
                          (برای نمایش تمام‌صفحه و زوم کلیک کنید)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-bold opacity-80 hover:opacity-100 flex items-center gap-1 cursor-pointer transition-opacity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن عکس</span>
                      </button>
                    </div>

                    {/* Scrollable Compact Preset Thumbnails */}
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 custom-column-scroll">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-black/15 bg-white/80 group shadow-2xs shrink-0 cursor-pointer hover:ring-2 hover:ring-black/40 transition-all select-none"
                          onClick={() => setLightboxIndex(idx)}
                          title="کلیک برای باز شدن تمام‌صفحه با قابلیت زوم"
                        >
                          <img
                            src={img}
                            alt={`تصویر ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 pointer-events-none"
                            loading="lazy"
                          />
                          {/* Image Index Tag */}
                          <div className="absolute top-1 right-1 px-1.5 py-0.2 rounded-md bg-black/70 text-white text-[9px] font-mono font-bold backdrop-blur-xs">
                            {idx + 1}
                          </div>

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white">
                            <div className="p-1 rounded-md bg-black/50 text-white shadow-xs" title="زوم و بزرگ‌نمایی">
                              <ZoomIn className="w-3.5 h-3.5" />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteImageIndexConfirm(idx);
                              }}
                              className="p-1 rounded-md bg-rose-600/90 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
                              title="حذف این عکس"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add Image inline slot */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-dashed border-black/20 hover:border-black/50 hover:bg-black/5 transition-all flex flex-col items-center justify-center gap-1 text-xs font-semibold cursor-pointer shrink-0"
                        style={{ color: textColor }}
                        title="افزودن تصویر جدید"
                      >
                        <Plus className="w-4 h-4 opacity-70" />
                        <span className="text-[10px] opacity-80 font-bold">+ عکس</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Creation date info */}
            {note.createdAt && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono pt-1">
                <Clock className="w-3 h-3" />
                <span>ایجاد شده در: {formatDisplayDate(note.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={handleClose}
              className="flex-1 py-2 px-3 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
            >
              انصراف
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ios-spring-btn"
            >
              <Check className="w-4 h-4" />
              <span>ذخیره تغییرات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Interactive Lightbox Modal with Pan & Zoom In / Zoom Out */}
      <ImageZoomLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        title={title || 'تصاویر پیوست یادداشت'}
      />

      {/* Delete Sticky Note Confirmation Modal */}
      {showDeleteNoteConfirm && (
        <div
          className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowDeleteNoteConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-ios-modal text-center border border-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                حذف یادداشت چسبان
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                آیا از حذف این یادداشت چسبان ({fileName ? `${fileName} - ` : ''}صفحه {note.pageNumber}) اطمینان دارید؟ اطلاعات این یادداشت حذف شده و قابل بازیابی نخواهد بود.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteNoteConfirm(false)}
                className="flex-1 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteNote}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md shadow-rose-600/25 cursor-pointer ios-spring-btn transition-colors"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Images Confirmation Modal */}
      {showDeleteAllImagesConfirm && (
        <div
          className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowDeleteAllImagesConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-ios-modal text-center border border-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                حذف تمام عکس‌ها
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                آیا از حذف همه {images.length} تصویر پیوست‌شده به این یادداشت چسبان اطمینان دارید؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllImagesConfirm(false)}
                className="flex-1 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setImages([]);
                  setShowDeleteAllImagesConfirm(false);
                }}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md shadow-rose-600/25 cursor-pointer ios-spring-btn transition-colors"
              >
                بله، حذف همه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Image Confirmation Modal */}
      {deleteImageIndexConfirm !== null && images[deleteImageIndexConfirm] && (
        <div
          className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteImageIndexConfirm(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-ios-modal text-center border border-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image mini preview */}
            <div className="relative mx-auto w-24 h-24 rounded-2xl overflow-hidden border border-neutral-200 shadow-sm bg-neutral-100">
              <img
                src={images[deleteImageIndexConfirm]}
                alt="پیش‌نمایش تصویر جهت حذف"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-rose-950/20 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md">
                  <Trash2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-neutral-900">
                حذف تصویر
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                آیا از حذف این تصویر پیوست‌شده از برگه یادداشت اطمینان دارید؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteImageIndexConfirm(null)}
                className="flex-1 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteImageIndexConfirm !== null) {
                    removeImage(deleteImageIndexConfirm);
                    setDeleteImageIndexConfirm(null);
                  }
                }}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md shadow-rose-600/25 cursor-pointer ios-spring-btn transition-colors"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(drawerMarkup, document.body) : drawerMarkup;
};
