import {
  StudyFile,
  FileEdits,
  NoteItem,
  NoteFolder,
  PomodoroSession,
  FileCategory,
  StudyTask,
  EyeComfortSettings,
  PomodoroSettings,
  ToolShortcuts,
  PerformanceSettings,
} from '../types';
import {
  getAllStudyFiles,
  saveStudyFileToStorage,
  getFileEditsFromStorage,
  saveFileEditsToStorage,
  getAllNotesFromStorage,
  saveAllNotesToStorage,
  getAllTasksFromStorage,
  saveAllTasksToStorage,
  clearStudyFilesAndEditsStorage,
} from './fileStorage';

export const BACKUP_SIGNATURE = 'STUDY_DESK_WORKSPACE_BACKUP_V1';

export interface BackupFileItem {
  id: string;
  name: string;
  size: number;
  uploadDate: string;
  lastModified?: string;
  currentPage?: number;
  pageCount?: number;
  scale?: number;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
  // Base64 encoded binary PDF array buffer (preserves 100% of original clean PDF)
  dataBase64?: string;
  // Complete unflattened edits
  edits: FileEdits;
}

export interface WorkspaceFullBackup {
  signature: string;
  version: string;
  exportedAt: string;
  appVersion: string;
  stats: {
    filesCount: number;
    stickyNotesCount: number;
    notesCount: number;
    sessionsCount: number;
    totalSizeBytes: number;
    foldersCount?: number;
  };
  files: BackupFileItem[];
  notes: NoteItem[];
  folders?: NoteFolder[];
  noteFolders?: NoteFolder[];
  sessions: PomodoroSession[];
  categories: FileCategory[];
  tasks: StudyTask[];
  settings: {
    eyeComfortSettings?: EyeComfortSettings;
    pomodoroSettings?: PomodoroSettings;
    shortcuts?: ToolShortcuts;
    performanceSettings?: PerformanceSettings;
    preferences?: Record<string, any>;
  };
}

export interface BackupInspectionResult {
  isValid: boolean;
  version: string;
  exportedAt: string;
  stats: {
    filesCount: number;
    stickyNotesCount: number;
    notesCount: number;
    sessionsCount: number;
    totalSizeBytes: number;
  };
  filesPreview: {
    id: string;
    name: string;
    size: number;
    stickyNotesCount: number;
    strokesCount: number;
    currentPage?: number;
    pageCount?: number;
  }[];
  errorMessage?: string;
}

/**
/**
 * High-performance, memory-safe ArrayBuffer to Base64 encoder.
 * Uses native browser FileReader when available (handled in C++ thread, zero JS heap explosion),
 * falling back to 32KB chunking.
 */
export async function arrayBufferToBase64Async(buffer: ArrayBuffer): Promise<string> {
  if (!buffer || buffer.byteLength === 0) return '';
  return new Promise((resolve) => {
    try {
      const blob = new Blob([buffer]);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => {
        resolve(arrayBufferToBase64Fallback(buffer));
      };
      reader.readAsDataURL(blob);
    } catch {
      resolve(arrayBufferToBase64Fallback(buffer));
    }
  });
}

function arrayBufferToBase64Fallback(buffer: ArrayBuffer): string {
  if (!buffer || buffer.byteLength === 0) return '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000; // 32KB
  let binary = '';
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return arrayBufferToBase64Fallback(buffer);
}

/**
 * High-performance Base64 string to ArrayBuffer decoder.
 * Uses native fetch on DataURL when available for instant C++ decoding,
 * falling back to charCodeAt array decoding.
 */
export async function base64ToArrayBufferAsync(base64: string): Promise<ArrayBuffer> {
  if (!base64) return new ArrayBuffer(0);
  try {
    const res = await fetch(`data:application/octet-stream;base64,${base64}`);
    return await res.arrayBuffer();
  } catch {
    return base64ToArrayBuffer(base64);
  }
}

/**
 * Synchronous Base64 string to ArrayBuffer decoder.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (!base64) return new ArrayBuffer(0);
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Formats byte size to human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes === 0) return '۰ بایت';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i]}`;
}

/**
 * Triggers browser download of the full backup archive (.studybackup).
 * 
 * ARCHITECTURAL SAFEGUARD:
 * Instead of generating one monolithic JSON string with JSON.stringify (which would hit
 * V8's maximum string length or exhaust heap memory on large libraries), this streams
 * the archive in sequential chunks directly into a browser Blob.
 * Between each file, it yields control via setTimeout(0) to allow garbage collection and
 * prevent the browser UI thread from freezing.
 */
export async function downloadFullWorkspaceBackupFile(
  onProgress?: (status: string, current: number, total: number) => void
): Promise<{ fileName: string; sizeBytes: number; stats: WorkspaceFullBackup['stats'] }> {
  onProgress?.('در حال آماده‌سازی و بررسی فایل‌ها...', 0, 100);

  const files = await getAllStudyFiles();
  const totalFiles = files.length;
  let totalStickyNotes = 0;
  let totalSizeBytes = 0;

  // Blob parts stream
  const blobParts: BlobPart[] = [];
  blobParts.push('{\n  "signature": "STUDY_DESK_WORKSPACE_BACKUP_V1",\n  "version": "1.0.0",\n');
  blobParts.push(`  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n`);
  blobParts.push(`  "appVersion": "2.5.0",\n`);
  blobParts.push('  "files": [\n');

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const percent = Math.round(((i + 1) / (totalFiles + 2)) * 100);
    onProgress?.(`در حال بسته‌بندی فایل (${i + 1} از ${totalFiles}): ${file.name} (${percent}٪)`, i + 1, totalFiles + 2);

    // Yield to the event loop so the UI updates and GC can reclaim memory
    await new Promise((r) => setTimeout(r, 0));

    // Fetch latest fresh edits from storage to guarantee sticky notes are 100% up to date
    let storedEdits: FileEdits | null = null;
    try {
      storedEdits = await getFileEditsFromStorage(file.id);
    } catch (err) {
      console.warn(`Could not read edits for file ${file.id}`, err);
    }

    const stickyNotes = storedEdits?.stickyNotes || file.stickyNotes || [];
    const pageStrokes = storedEdits?.pageStrokes || file.pageStrokes || {};
    const currentPage = storedEdits?.currentPage || file.currentPage || 1;
    const pageCount = storedEdits?.pageCount || file.pageCount;
    const scale = storedEdits?.scale || file.scale || 1.2;

    totalStickyNotes += stickyNotes.length;

    // Convert PDF binary buffer to Base64 using native async FileReader
    const buffer =
      file.originalData && file.originalData.byteLength > 0
        ? file.originalData
        : file.data;

    let dataBase64 = '';
    if (buffer && buffer.byteLength > 0) {
      try {
        dataBase64 = await arrayBufferToBase64Async(buffer);
        totalSizeBytes += buffer.byteLength;
      } catch (err) {
        console.warn(`Failed encoding buffer for file ${file.name}`, err);
        totalSizeBytes += file.size || 0;
      }
    } else {
      totalSizeBytes += file.size || 0;
    }

    const item: BackupFileItem = {
      id: file.id,
      name: file.name,
      size: file.size || buffer?.byteLength || 0,
      uploadDate: file.uploadDate || new Date().toISOString(),
      lastModified: file.lastModified || storedEdits?.updatedAt || new Date().toISOString(),
      currentPage,
      pageCount,
      scale,
      category: file.category,
      tags: file.tags,
      isFavorite: file.isFavorite,
      dataBase64,
      edits: {
        fileId: file.id,
        stickyNotes,
        pageStrokes,
        currentPage,
        pageCount,
        scale,
        updatedAt: storedEdits?.updatedAt || new Date().toISOString(),
      },
    };

    // Serialize each file independently into the Blob stream
    blobParts.push(JSON.stringify(item));
    if (i < totalFiles - 1) {
      blobParts.push(',\n');
    } else {
      blobParts.push('\n');
    }
  }

  blobParts.push('  ],\n');

  onProgress?.('در حال جمع‌آوری یادداشت‌ها، دسته‌بندی‌ها و تنظیمات...', totalFiles + 1, totalFiles + 2);
  await new Promise((r) => setTimeout(r, 0));

  // Text notes & note categories/folders
  const rawNotes = await getAllNotesFromStorage();

  let folders: NoteFolder[] = [];
  try {
    const rawFolders = localStorage.getItem('study_workspace_folders');
    if (rawFolders) {
      const parsed = JSON.parse(rawFolders);
      if (Array.isArray(parsed)) folders = parsed;
    }
  } catch {}

  // Ensure every note with a folderId has its human-readable category name attached
  const folderNameMap = new Map<string, string>();
  folders.forEach((f) => folderNameMap.set(f.id, f.name));
  const notes = rawNotes.map((note) => {
    if (note.folderId && !note.category && folderNameMap.has(note.folderId)) {
      return { ...note, category: folderNameMap.get(note.folderId) };
    }
    return note;
  });

  // Sessions
  let sessions: PomodoroSession[] = [];
  try {
    const rawSessions = localStorage.getItem('study_workspace_sessions');
    if (rawSessions) sessions = JSON.parse(rawSessions);
  } catch {}

  // Categories (file categories)
  let categories: FileCategory[] = [];
  try {
    const rawCats = localStorage.getItem('study_file_categories');
    if (rawCats) categories = JSON.parse(rawCats);
  } catch {}

  // Tasks
  const tasks = getAllTasksFromStorage();

  // Settings & preferences
  let eyeComfortSettings: EyeComfortSettings | undefined;
  try {
    const raw = localStorage.getItem('study_eye_comfort_settings');
    if (raw) eyeComfortSettings = JSON.parse(raw);
  } catch {}

  let pomodoroSettings: PomodoroSettings | undefined;
  try {
    const raw = localStorage.getItem('pomodoro_settings');
    if (raw) pomodoroSettings = JSON.parse(raw);
  } catch {}

  let shortcuts: ToolShortcuts | undefined;
  try {
    const raw = localStorage.getItem('study_capsule_shortcuts');
    if (raw) shortcuts = JSON.parse(raw);
  } catch {}

  let performanceSettings: PerformanceSettings | undefined;
  try {
    const raw = localStorage.getItem('study_performance_settings');
    if (raw) performanceSettings = JSON.parse(raw);
  } catch {}

  const preferences: Record<string, any> = {
    straighten: localStorage.getItem('study_pref_straighten'),
    ruler90: localStorage.getItem('study_pref_ruler90'),
    autosave: localStorage.getItem('study_pref_autosave'),
    capsulePosition: localStorage.getItem('study_capsule_position'),
    sortBy: localStorage.getItem('study_file_sort_by'),
  };

  const settings = {
    eyeComfortSettings,
    pomodoroSettings,
    shortcuts,
    performanceSettings,
    preferences,
  };

  const stats = {
    filesCount: totalFiles,
    stickyNotesCount: totalStickyNotes,
    notesCount: notes.length,
    sessionsCount: sessions.length,
    totalSizeBytes,
    foldersCount: folders.length,
  };

  blobParts.push(`  "notes": ${JSON.stringify(notes)},\n`);
  blobParts.push(`  "folders": ${JSON.stringify(folders)},\n`);
  blobParts.push(`  "noteFolders": ${JSON.stringify(folders)},\n`);
  blobParts.push(`  "sessions": ${JSON.stringify(sessions)},\n`);
  blobParts.push(`  "categories": ${JSON.stringify(categories)},\n`);
  blobParts.push(`  "tasks": ${JSON.stringify(tasks)},\n`);
  blobParts.push(`  "settings": ${JSON.stringify(settings)},\n`);
  blobParts.push(`  "stats": ${JSON.stringify(stats)}\n}`);

  onProgress?.('در حال ساخت فایل دانلود...', totalFiles + 2, totalFiles + 2);
  await new Promise((r) => setTimeout(r, 0));

  // Construct final native browser Blob directly from parts
  const blob = new Blob(blobParts, { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const fileName = `StudyDesk_Complete_Backup_${dateStr}.studybackup`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  onProgress?.('پشتیبان‌گیری کامل شد!', totalFiles + 2, totalFiles + 2);

  return {
    fileName,
    sizeBytes: blob.size,
    stats,
  };
}

/**
 * Downloads a lightweight backup containing 100% of sticky notes, pen strokes,
 * bookmarks, notes, pomodoro sessions, and settings, WITHOUT the heavy raw PDF binaries.
 * File size is typically only a few kilobytes and generates instantly.
 */
export async function downloadLightweightNotesAndEditsBackup(
  onProgress?: (status: string, current: number, total: number) => void
): Promise<{ fileName: string; sizeBytes: number; stats: WorkspaceFullBackup['stats'] }> {
  onProgress?.('در حال آماده‌سازی یادداشت‌ها و ادیت‌ها...', 0, 100);

  const files = await getAllStudyFiles();
  let totalStickyNotes = 0;

  const backupFiles: BackupFileItem[] = [];
  for (const file of files) {
    let storedEdits: FileEdits | null = null;
    try {
      storedEdits = await getFileEditsFromStorage(file.id);
    } catch {}

    const stickyNotes = storedEdits?.stickyNotes || file.stickyNotes || [];
    totalStickyNotes += stickyNotes.length;

    backupFiles.push({
      id: file.id,
      name: file.name,
      size: file.size || 0,
      uploadDate: file.uploadDate || new Date().toISOString(),
      lastModified: file.lastModified || storedEdits?.updatedAt || new Date().toISOString(),
      currentPage: storedEdits?.currentPage || file.currentPage || 1,
      pageCount: storedEdits?.pageCount || file.pageCount,
      scale: storedEdits?.scale || file.scale || 1.2,
      category: file.category,
      tags: file.tags,
      isFavorite: file.isFavorite,
      // No raw dataBase64 included in lightweight backup
      edits: {
        fileId: file.id,
        stickyNotes,
        pageStrokes: storedEdits?.pageStrokes || file.pageStrokes || {},
        currentPage: storedEdits?.currentPage || file.currentPage || 1,
        pageCount: storedEdits?.pageCount || file.pageCount,
        scale: storedEdits?.scale || file.scale || 1.2,
        updatedAt: storedEdits?.updatedAt || new Date().toISOString(),
      },
    });
  }

  const notes = await getAllNotesFromStorage();

  let sessions: PomodoroSession[] = [];
  try {
    const rawSessions = localStorage.getItem('study_workspace_sessions');
    if (rawSessions) sessions = JSON.parse(rawSessions);
  } catch {}

  let categories: FileCategory[] = [];
  try {
    const rawCats = localStorage.getItem('study_file_categories');
    if (rawCats) categories = JSON.parse(rawCats);
  } catch {}

  const tasks = getAllTasksFromStorage();

  let eyeComfortSettings: EyeComfortSettings | undefined;
  try {
    const raw = localStorage.getItem('study_eye_comfort_settings');
    if (raw) eyeComfortSettings = JSON.parse(raw);
  } catch {}

  let pomodoroSettings: PomodoroSettings | undefined;
  try {
    const raw = localStorage.getItem('pomodoro_settings');
    if (raw) pomodoroSettings = JSON.parse(raw);
  } catch {}

  let shortcuts: ToolShortcuts | undefined;
  try {
    const raw = localStorage.getItem('study_capsule_shortcuts');
    if (raw) shortcuts = JSON.parse(raw);
  } catch {}

  let performanceSettings: PerformanceSettings | undefined;
  try {
    const raw = localStorage.getItem('study_performance_settings');
    if (raw) performanceSettings = JSON.parse(raw);
  } catch {}

  const preferences: Record<string, any> = {
    straighten: localStorage.getItem('study_pref_straighten'),
    ruler90: localStorage.getItem('study_pref_ruler90'),
    autosave: localStorage.getItem('study_pref_autosave'),
    capsulePosition: localStorage.getItem('study_capsule_position'),
    sortBy: localStorage.getItem('study_file_sort_by'),
  };

  const backupObject: WorkspaceFullBackup = {
    signature: BACKUP_SIGNATURE,
    version: '1.0.0-light',
    exportedAt: new Date().toISOString(),
    appVersion: '2.5.0',
    stats: {
      filesCount: backupFiles.length,
      stickyNotesCount: totalStickyNotes,
      notesCount: notes.length,
      sessionsCount: sessions.length,
      totalSizeBytes: 0,
    },
    files: backupFiles,
    notes,
    folders: (() => {
      try {
        const raw = localStorage.getItem('study_workspace_folders');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })(),
    noteFolders: (() => {
      try {
        const raw = localStorage.getItem('study_workspace_folders');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })(),
    sessions,
    categories,
    tasks,
    settings: {
      eyeComfortSettings,
      pomodoroSettings,
      shortcuts,
      performanceSettings,
      preferences,
    },
  };

  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const fileName = `StudyDesk_Notes_Edits_Backup_${dateStr}.studybackup`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    sizeBytes: blob.size,
    stats: backupObject.stats,
  };
}


/**
 * Inspects a backup file before restoring, verifying its signature and summarizing contents.
 */
export async function inspectBackupFile(fileOrString: File | string): Promise<BackupInspectionResult> {
  try {
    let jsonContent = '';
    if (typeof fileOrString === 'string') {
      jsonContent = fileOrString;
    } else {
      jsonContent = await fileOrString.text();
    }

    const data = JSON.parse(jsonContent);

    // Verify format
    if (data.signature !== BACKUP_SIGNATURE && !Array.isArray(data.files)) {
      return {
        isValid: false,
        version: data.version || 'unknown',
        exportedAt: data.exportedAt || '',
        stats: {
          filesCount: 0,
          stickyNotesCount: 0,
          notesCount: 0,
          sessionsCount: 0,
          totalSizeBytes: 0,
        },
        filesPreview: [],
        errorMessage: 'ساختار فایل پشتیبان معتبر نیست یا با نسخه این برنامه سازگار نمی‌باشد.',
      };
    }

    const files: BackupFileItem[] = Array.isArray(data.files) ? data.files : [];
    let calculatedStickyNotes = 0;

    const filesPreview = files.map((f) => {
      const stickyCount = f.edits?.stickyNotes?.length || 0;
      calculatedStickyNotes += stickyCount;
      const strokesCount = Object.values(f.edits?.pageStrokes || {}).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0
      );
      return {
        id: f.id,
        name: f.name || 'بدون نام',
        size: f.size || 0,
        stickyNotesCount: stickyCount,
        strokesCount,
        currentPage: f.currentPage,
        pageCount: f.pageCount,
      };
    });

    return {
      isValid: true,
      version: data.version || '1.0.0',
      exportedAt: data.exportedAt || new Date().toISOString(),
      stats: {
        filesCount: files.length,
        stickyNotesCount: data.stats?.stickyNotesCount ?? calculatedStickyNotes,
        notesCount: Array.isArray(data.notes) ? data.notes.length : 0,
        sessionsCount: Array.isArray(data.sessions) ? data.sessions.length : 0,
        totalSizeBytes: data.stats?.totalSizeBytes || 0,
      },
      filesPreview,
    };
  } catch (err: any) {
    return {
      isValid: false,
      version: 'unknown',
      exportedAt: '',
      stats: {
        filesCount: 0,
        stickyNotesCount: 0,
        notesCount: 0,
        sessionsCount: 0,
        totalSizeBytes: 0,
      },
      filesPreview: [],
      errorMessage: `خطا در خواندن فایل پشتیبان: ${err?.message || 'قالب نامعتبر'}`,
    };
  }
}

export interface RestoreOptions {
  mode: 'merge' | 'replace';
  restoreSettings?: boolean;
}

/**
 * Restores a complete workspace from a backup file, reconstructing:
 * - PDF binary ArrayBuffers (100% exact, without rasterization or degradation)
 * - All sticky notes with exact positions, page numbers, text, colors and images
 * - All drawing strokes, pen/highlighter paths and highlights
 * - All text notes, Pomodoro sessions, categories, and settings.
 */
export async function restoreFullWorkspaceBackup(
  fileOrString: File | string,
  options: RestoreOptions,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<{
  filesRestored: number;
  stickyNotesRestored: number;
  notesRestored: number;
  sessionsRestored: number;
}> {
  let jsonContent = '';
  if (typeof fileOrString === 'string') {
    jsonContent = fileOrString;
  } else {
    onProgress?.('در حال بارگذاری فایل پشتیبان...', 0, 100);
    jsonContent = await fileOrString.text();
  }

  const backup: WorkspaceFullBackup = JSON.parse(jsonContent);

  if (backup.signature !== BACKUP_SIGNATURE && !Array.isArray(backup.files)) {
    throw new Error('فایل پشتیبان انتخاب‌شده نامعتبر است.');
  }

  const isReplace = options.mode === 'replace';
  if (isReplace) {
    onProgress?.('در حال پاک‌سازی و آماده‌سازی پایگاه‌داده...', 0, 100);
    await clearStudyFilesAndEditsStorage();
  }

  const backupFiles = Array.isArray(backup.files) ? backup.files : [];
  const totalFiles = backupFiles.length;

  let totalStickyNotesRestored = 0;

  // 1. Process and save each file
  for (let i = 0; i < totalFiles; i++) {
    const item = backupFiles[i];
    const percent = Math.round(((i + 1) / (totalFiles + 3)) * 100);
    onProgress?.(
      `در حال بازیابی فایل (${i + 1} از ${totalFiles}): ${item.name} (${percent}٪)`,
      i + 1,
      totalFiles + 3
    );

    // Yield to the event loop so progress updates smoothly and memory is managed
    await new Promise((r) => setTimeout(r, 0));

    // Decode Base64 array buffer asynchronously for high performance
    let dataBuffer: ArrayBuffer = new ArrayBuffer(0);
    if (item.dataBase64) {
      try {
        dataBuffer = await base64ToArrayBufferAsync(item.dataBase64);
      } catch (err) {
        console.warn(`Failed async base64 decoding for ${item.name}, using fallback`, err);
        dataBuffer = base64ToArrayBuffer(item.dataBase64);
      }
    }

    const reconstructedFile: StudyFile = {
      id: item.id,
      name: item.name,
      size: item.size || dataBuffer.byteLength,
      data: dataBuffer,
      originalData: dataBuffer.slice(0),
      uploadDate: item.uploadDate || new Date().toISOString(),
      lastModified: item.lastModified || new Date().toISOString(),
      currentPage: item.currentPage || item.edits?.currentPage || 1,
      pageCount: item.pageCount || item.edits?.pageCount,
      scale: item.scale || item.edits?.scale || 1.2,
      category: item.category,
      tags: item.tags,
      isFavorite: item.isFavorite,
      stickyNotes: item.edits?.stickyNotes || [],
      pageStrokes: item.edits?.pageStrokes || {},
    };

    // Save StudyFile to IndexedDB
    await saveStudyFileToStorage(reconstructedFile);

    // Save exact edits to EDITS_STORE and localStorage
    if (item.edits) {
      await saveFileEditsToStorage(item.id, {
        fileId: item.id,
        stickyNotes: item.edits.stickyNotes || [],
        pageStrokes: item.edits.pageStrokes || {},
        currentPage: item.edits.currentPage || item.currentPage || 1,
        pageCount: item.edits.pageCount || item.pageCount,
        scale: item.edits.scale || item.scale || 1.2,
        updatedAt: item.edits.updatedAt || new Date().toISOString(),
      });
      totalStickyNotesRestored += (item.edits.stickyNotes || []).length;
    }
  }

  onProgress?.('در حال بازیابی یادداشت‌ها و دسته‌بندی‌ها...', totalFiles + 1, totalFiles + 3);

  // 2. Restore Note Folders & Smart Category Auto-Recovery
  let restoredFolders: NoteFolder[] = [];
  if (Array.isArray((backup as any).folders) && (backup as any).folders.length > 0) {
    restoredFolders = [...(backup as any).folders];
  } else if (Array.isArray((backup as any).noteFolders) && (backup as any).noteFolders.length > 0) {
    restoredFolders = [...(backup as any).noteFolders];
  }

  // In merge mode, preserve pre-existing folders that don't collide
  if (!isReplace) {
    try {
      const existingRaw = localStorage.getItem('study_workspace_folders');
      if (existingRaw) {
        const parsed = JSON.parse(existingRaw);
        if (Array.isArray(parsed)) {
          const existingIds = new Set(restoredFolders.map((f) => f.id));
          parsed.forEach((f) => {
            if (!existingIds.has(f.id)) {
              restoredFolders.push(f);
              existingIds.add(f.id);
            }
          });
        }
      }
    } catch {}
  }

  // Build lookup maps for existing restored folders
  const folderIdMap = new Map<string, NoteFolder>();
  const folderNameMap = new Map<string, NoteFolder>();
  restoredFolders.forEach((f) => {
    folderIdMap.set(f.id, f);
    if (f.name) folderNameMap.set(f.name.trim().toLowerCase(), f);
  });

  const FOLDER_PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#059669', '#d97706'];
  let paletteIdx = 0;

  // SMART CATEGORY RECOVERY: If backup was exported without folders or has unmapped note categories,
  // automatically reconstruct all categories from note.category and note.folderId so categories are never lost!
  const incomingNotes = Array.isArray(backup.notes) ? [...backup.notes] : [];
  incomingNotes.forEach((note) => {
    // Case 1: Note has human-readable category name
    if (note.category && typeof note.category === 'string' && note.category.trim()) {
      const catName = note.category.trim();
      const existingByName = folderNameMap.get(catName.toLowerCase());
      const existingById = note.folderId ? folderIdMap.get(note.folderId) : undefined;
      const targetFolder = existingByName || existingById;

      if (targetFolder) {
        note.folderId = targetFolder.id;
        note.category = targetFolder.name;
      } else {
        // Automatically create a folder for this category!
        const newId = note.folderId || `f-auto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newFolder: NoteFolder = {
          id: newId,
          name: catName,
          color: FOLDER_PALETTE[paletteIdx % FOLDER_PALETTE.length],
          createdAt: note.createdAt || new Date().toISOString(),
        };
        paletteIdx++;
        restoredFolders.push(newFolder);
        folderIdMap.set(newId, newFolder);
        folderNameMap.set(catName.toLowerCase(), newFolder);
        note.folderId = newId;
      }
    }
    // Case 2: Note has folderId, but folder is missing in restoredFolders
    else if (note.folderId && !folderIdMap.has(note.folderId)) {
      // Check if file categories had this name/id
      const matchedCat = (backup.categories || []).find((c) => c.id === note.folderId || c.name === note.folderId);
      const name = matchedCat
        ? matchedCat.name
        : note.attachedFileName
        ? `یادداشت‌های ${note.attachedFileName}`
        : `دسته‌بندی ${restoredFolders.length + 1}`;
      const newFolder: NoteFolder = {
        id: note.folderId,
        name,
        color: FOLDER_PALETTE[paletteIdx % FOLDER_PALETTE.length],
        createdAt: note.createdAt || new Date().toISOString(),
      };
      paletteIdx++;
      restoredFolders.push(newFolder);
      folderIdMap.set(note.folderId, newFolder);
      folderNameMap.set(name.toLowerCase(), newFolder);
      note.category = name;
    }
    // Case 3: Note has folderId matching an existing folder, ensure category name is populated
    else if (note.folderId && folderIdMap.has(note.folderId)) {
      note.category = folderIdMap.get(note.folderId)?.name;
    }
  });

  // Save restored & reconstructed folders
  try {
    localStorage.setItem('study_workspace_folders', JSON.stringify(restoredFolders));
  } catch (err) {
    console.warn('Failed to save restored folders:', err);
  }

  // 2.2 Save Notes
  let notesRestoredCount = 0;
  if (incomingNotes.length > 0) {
    if (isReplace) {
      await saveAllNotesToStorage(incomingNotes);
      try {
        localStorage.setItem('study_workspace_notes', JSON.stringify(incomingNotes));
      } catch {}
      notesRestoredCount = incomingNotes.length;
    } else {
      // Merge mode
      const existing = await getAllNotesFromStorage();
      const existingIds = new Set(existing.map((n) => n.id));
      const merged = [...existing];
      for (const n of incomingNotes) {
        if (!existingIds.has(n.id)) {
          merged.push(n);
          existingIds.add(n.id);
        }
      }
      await saveAllNotesToStorage(merged);
      try {
        localStorage.setItem('study_workspace_notes', JSON.stringify(merged));
      } catch {}
      notesRestoredCount = merged.length;
    }
  }

  // Dispatch custom event to notify all active views immediately
  try {
    window.dispatchEvent(
      new CustomEvent('study_workspace_data_restored', {
        detail: { folders: restoredFolders, notes: incomingNotes },
      })
    );
  } catch {}

  onProgress?.('در حال بازیابی جلسات و تنظیمات...', totalFiles + 2, totalFiles + 3);

  // 3. Restore Sessions
  let sessionsRestoredCount = 0;
  if (Array.isArray(backup.sessions)) {
    if (isReplace) {
      try {
        localStorage.setItem('study_workspace_sessions', JSON.stringify(backup.sessions));
        sessionsRestoredCount = backup.sessions.length;
      } catch {}
    } else {
      let existingSessions: PomodoroSession[] = [];
      try {
        const raw = localStorage.getItem('study_workspace_sessions');
        if (raw) existingSessions = JSON.parse(raw);
      } catch {}
      const existingIds = new Set(existingSessions.map((s) => s.id));
      const merged = [...existingSessions];
      for (const s of backup.sessions) {
        if (!existingIds.has(s.id)) {
          merged.push(s);
          existingIds.add(s.id);
        }
      }
      try {
        localStorage.setItem('study_workspace_sessions', JSON.stringify(merged));
        sessionsRestoredCount = merged.length;
      } catch {}
    }
  }

  // 4. Restore Categories
  if (Array.isArray(backup.categories) && backup.categories.length > 0) {
    if (isReplace) {
      try {
        localStorage.setItem('study_file_categories', JSON.stringify(backup.categories));
      } catch {}
    } else {
      try {
        const raw = localStorage.getItem('study_file_categories');
        const existingCats: FileCategory[] = raw ? JSON.parse(raw) : [];
        const existingIds = new Set(existingCats.map((c) => c.id));
        const merged = [...existingCats];
        for (const c of backup.categories) {
          if (!existingIds.has(c.id)) {
            merged.push(c);
            existingIds.add(c.id);
          }
        }
        localStorage.setItem('study_file_categories', JSON.stringify(merged));
      } catch {}
    }
  }

  // 5. Restore Tasks
  if (Array.isArray(backup.tasks) && backup.tasks.length > 0) {
    saveAllTasksToStorage(backup.tasks);
  }

  // 6. Restore Settings if requested
  if (options.restoreSettings && backup.settings) {
    if (backup.settings.eyeComfortSettings) {
      try {
        localStorage.setItem(
          'study_eye_comfort_settings',
          JSON.stringify(backup.settings.eyeComfortSettings)
        );
      } catch {}
    }
    if (backup.settings.pomodoroSettings) {
      try {
        localStorage.setItem('pomodoro_settings', JSON.stringify(backup.settings.pomodoroSettings));
      } catch {}
    }
    if (backup.settings.shortcuts) {
      try {
        localStorage.setItem(
          'study_capsule_shortcuts',
          JSON.stringify(backup.settings.shortcuts)
        );
      } catch {}
    }
    if (backup.settings.performanceSettings) {
      try {
        localStorage.setItem(
          'study_performance_settings',
          JSON.stringify(backup.settings.performanceSettings)
        );
      } catch {}
    }
    if (backup.settings.preferences) {
      const p = backup.settings.preferences;
      if (p.straighten !== undefined && p.straighten !== null) {
        localStorage.setItem('study_pref_straighten', String(p.straighten));
      }
      if (p.ruler90 !== undefined && p.ruler90 !== null) {
        localStorage.setItem('study_pref_ruler90', String(p.ruler90));
      }
      if (p.autosave !== undefined && p.autosave !== null) {
        localStorage.setItem('study_pref_autosave', String(p.autosave));
      }
      if (p.capsulePosition) {
        localStorage.setItem('study_capsule_position', String(p.capsulePosition));
      }
      if (p.sortBy) {
        localStorage.setItem('study_file_sort_by', String(p.sortBy));
      }
    }
  }

  onProgress?.('بازیابی با موفقیت به پایان رسید!', totalFiles + 3, totalFiles + 3);

  return {
    filesRestored: totalFiles,
    stickyNotesRestored: totalStickyNotesRestored,
    notesRestored: notesRestoredCount,
    sessionsRestored: sessionsRestoredCount,
  };
}
