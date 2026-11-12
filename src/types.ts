export type ActiveTab = 'open-file' | 'library' | 'notes' | 'pomodoro' | 'analytics' | 'settings';

export interface NoteFolder {
  id: string;
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  createdAt?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  category?: string;
  tags?: string[];
  isPinned?: boolean;
  attachedFileId?: string;
  attachedFileName?: string;
}

export type PomodoroMode = 'focus' | 'short-break' | 'long-break';

export type StudySessionType = PomodoroMode | 'file-study' | 'app-usage';

export type PomodoroSound = 'crystal' | 'zen' | 'marimba' | 'bell';

export interface PomodoroSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  roundsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundType: PomodoroSound;
  soundVolume: number; // 0 to 1
  browserNotifications: boolean;
}

export interface PomodoroSession {
  id: string;
  type: StudySessionType | string;
  durationMinutes: number;
  timestamp: string;
  createdAt?: number;
  date?: string;
  fileName?: string;
  source?: 'pomodoro' | 'file' | 'app';
}

export interface FileCategory {
  id: string;
  name: string;
  color: string; // 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan' | 'indigo' | 'orange'
  createdAt?: string;
}

export interface StudyFile {
  id: string;
  name: string;
  size: number;
  data: ArrayBuffer;
  originalData?: ArrayBuffer;
  fileHandle?: any;
  uploadDate: string;
  pageCount?: number;
  currentPage?: number;
  pageStrokes?: Record<number, DrawingStroke[]>;
  stickyNotes?: StickyNoteItem[];
  scale?: number;
  lastModified?: string;
  category?: string; // ID of category or empty/undefined
  tags?: string[];
  isFavorite?: boolean;
}

export interface FileEdits {
  fileId: string;
  pageStrokes: Record<number, DrawingStroke[]>;
  stickyNotes: StickyNoteItem[];
  currentPage?: number;
  pageCount?: number;
  scale?: number;
  updatedAt: string;
}

export interface DrawingStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool?: 'pen' | 'highlighter' | 'ruler';
  opacity?: number;
}

export interface StickyNoteItem {
  id: string;
  pageNumber: number;
  x: number; // scaled to 1.0 base
  y: number;
  title: string;
  content: string;
  color: string;
  textColor: string;
  isBold: boolean;
  createdAt: string;
  imageUrl?: string;
  images?: string[];
}

export type EyeComfortMode = 'normal' | 'yellow' | 'dark-gray' | 'soft-gray';

export interface EyeComfortSettings {
  brightness: number; // 30 to 100 (default 100)
  colorMode: EyeComfortMode;
  warmth: number; // 20 to 80 (default 50)
}

export interface ToolShortcuts {
  hand: string;
  select: string;
  pen: string;
  highlighter: string;
  ruler: string;
  eraser: string;
  stickyNote: string;
  quickNotes?: string;
}

export type CapsulePosition =
  | 'bottom-center'
  | 'top-center'
  | 'right-center'
  | 'left-center'
  | 'right-top'
  | 'left-top'
  | 'right-bottom'
  | 'left-bottom'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export const isCapsuleVertical = (pos: CapsulePosition): boolean => {
  return (
    pos === 'right-center' ||
    pos === 'left-center' ||
    pos === 'right-top' ||
    pos === 'left-top' ||
    pos === 'right-bottom' ||
    pos === 'left-bottom' ||
    pos === 'bottom-right' ||
    pos === 'bottom-left' ||
    pos === 'top-right' ||
    pos === 'top-left'
  );
};

export type RenderQuality = 'eco' | 'balanced' | 'high';

export interface PerformanceSettings {
  ecoMode: boolean; // Economic / Low-spec hardware mode
  renderQuality: RenderQuality; // 'eco' = 1x DPR, 'balanced' = 1.3x DPR, 'high' = 2x DPR
  virtualization: boolean; // Release offscreen canvas memory for multi-page documents
  simplifyStrokes: boolean; // Optimize high-frequency drawing points
  hardwareAcceleration: boolean; // GPU compositing layers
  reduceAnimations: boolean; // Disable heavy blur and complex physics
}

export const detectEconomicHardware = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  return cores <= 4 || mem <= 4;
};

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  ecoMode: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) <= 4 : false,
  renderQuality: typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4 ? 'eco' : 'balanced',
  virtualization: true,
  simplifyStrokes: true,
  hardwareAcceleration: true,
  reduceAnimations: false,
};

export interface StudyTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy > 979 ? 1600 : 621;
  let remainingJy = jy > 979 ? jy - 979 : jy;
  let days =
    365 * remainingJy +
    Math.floor(remainingJy / 33) * 8 +
    Math.floor(((remainingJy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 0; gm < 13; gm++) {
    const v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return [gy, gm, gd];
}

export function extractTimestampFromAny(id?: string, dateStr?: string): number {
  // 1. Try parsing dateStr first (clean invisible Unicode characters & normalize Persian/Arabic digits)
  if (dateStr) {
    const cleanStr = String(dateStr)
      .replace(/[\u200B-\u200F\u061C\u202A-\u202E\uFEFF]/g, '')
      .trim();

    if (cleanStr) {
      // Direct ISO 8601 or standard Gregorian string (starts with 19xx, 20xx, 21xx or contains 'T')
      if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr) || cleanStr.includes('T')) {
        const parsed = Date.parse(cleanStr);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }

      // Convert Persian (۰-۹) and Arabic (٠-٩) digits to English (0-9)
      const normalized = cleanStr
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

      // Direct milliseconds timestamp or 10-digit unix seconds timestamp
      if (/^\d{10,14}$/.test(normalized)) {
        let num = Number(normalized);
        if (!isNaN(num) && num > 1000000000) {
          if (num < 10000000000) num = num * 1000;
          return num;
        }
      }

      // Extract numeric components: year, month, day, and optional hour, min, sec
      const numbers = normalized.match(/\d+/g)?.map(Number) || [];
      if (numbers.length >= 3) {
        let year = numbers[0];
        let month = numbers[1];
        let day = numbers[2];
        const hour = numbers[3] !== undefined ? numbers[3] : 12;
        const min = numbers[4] !== undefined ? numbers[4] : 0;
        const sec = numbers[5] !== undefined ? numbers[5] : 0;

        // Handle DD/MM/YYYY or D/M/YYYY (year is at index 2)
        if ((day >= 1200 && day <= 1600) || (day >= 1970 && day <= 2100)) {
          const tempYear = day;
          day = year;
          year = tempYear;
        }

        if (year >= 1200 && year <= 1600) {
          // Solar Hijri / Shamsi calendar (e.g. 1403, 1405)
          const safeMonth = Math.min(Math.max(month, 1), 12);
          const safeDay = Math.min(Math.max(day, 1), 31);
          const [gy, gm, gd] = jalaliToGregorian(year, safeMonth, safeDay);
          const d = new Date(gy, gm - 1, gd, hour, min, sec).getTime();
          if (!isNaN(d) && d > 0) return d;
        } else if (year >= 1970 && year <= 2100) {
          const safeMonth = Math.min(Math.max(month, 1), 12);
          const safeDay = Math.min(Math.max(day, 1), 31);
          const d = new Date(year, safeMonth - 1, safeDay, hour, min, sec).getTime();
          if (!isNaN(d) && d > 0) return d;
        }
      }
    }
  }

  // 2. If dateStr is empty or didn't yield a valid timestamp, check if ID contains a 10-14 digit timestamp (such as Date.now())
  if (id) {
    const match = String(id).match(/(\d{10,14})/);
    if (match) {
      let num = Number(match[1]);
      if (!isNaN(num) && num > 1000000000) {
        if (num < 10000000000) num = num * 1000;
        return num;
      }
    }
  }

  // 3. Fallback: numeric ID
  if (id) {
    let num = Number(id);
    if (!isNaN(num) && num > 1000000000) {
      if (num < 10000000000) num = num * 1000;
      return num;
    }
  }

  return 0;
}

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const cleanStr = String(dateStr)
    .replace(/[\u200B-\u200F\u061C\u202A-\u202E\uFEFF]/g, '')
    .trim();

  // If ISO 8601 or standard Gregorian string with time/timezone
  if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr) || cleanStr.includes('T')) {
    const parsed = Date.parse(cleanStr);
    if (!isNaN(parsed) && parsed > 0) {
      try {
        return new Date(parsed).toLocaleDateString('fa-IR');
      } catch {}
    }
  }

  // Convert Persian/Arabic digits to English digits for analysis
  const normalizedDigits = cleanStr
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  const parts = normalizedDigits.match(/\d+/g)?.map(Number) || [];
  if (parts.length >= 3) {
    let y = parts[0];
    let m = parts[1];
    let d = parts[2];
    if (d >= 1200 && d <= 1600) {
      const tmp = y;
      y = d;
      d = tmp;
    }
    if (y >= 1200 && y <= 1600) {
      return `${y}/${m}/${d}`.replace(/\d/g, (ch) => '۰۱۲۳۴۵۶۷۸۹'[Number(ch)]);
    }
  }

  const parsed = Date.parse(cleanStr);
  if (!isNaN(parsed) && parsed > 0) {
    try {
      return new Date(parsed).toLocaleDateString('fa-IR');
    } catch {}
  }
  return cleanStr;
}

