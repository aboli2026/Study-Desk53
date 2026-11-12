import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Flame,
  BookOpen,
  Coffee,
  Sparkles,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Search,
  Zap,
  FileText,
  Target,
  SunMedium,
  Moon,
  ChevronDown,
  Award,
  Layers,
  ArrowUpRight,
  Filter,
  Activity,
  BarChart2,
  ListTodo,
  Plus,
} from 'lucide-react';
import { PomodoroSession, NoteItem, StudyTask } from '../types';
import { getAllTasksFromStorage, saveAllTasksToStorage } from '../utils/fileStorage';
import { playTaskCompleteSound, playTaskUndoSound } from '../utils/pomodoroAudio';

interface AnalyticsViewProps {
  sessions: PomodoroSession[];
  notes: NoteItem[];
  onClearHistory: () => void;
  onLoadSampleData?: () => void;
}

type MainAnalyticsTab = 'daily' | 'weekly' | 'circadian' | 'topics' | 'journal';
type SessionFilter = 'all' | 'focus' | 'file' | 'break' | 'tasks';

interface PersianWeekDay {
  dayIndex: number; // 0 = شنبه, 6 = جمعه
  name: string;
  shortName: string;
  focusMinutes: number;
  breakMinutes: number;
  sessionCount: number;
  isToday: boolean;
  sessions: PomodoroSession[];
}

interface HourlyTimeBlock {
  key: string;
  label: string;
  periodName: string;
  timeRange: string;
  focusMinutes: number;
  sessionCount: number;
  description: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  sessions,
  notes,
  onClearHistory,
  onLoadSampleData,
}) => {
  // Navigation tabs
  const [activeMainTab, setActiveMainTab] = useState<MainAnalyticsTab>('daily');

  // Filters & State
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [copiedReportToast, setCopiedReportToast] = useState<boolean>(false);
  const [expandedLogCount, setExpandedLogCount] = useState<number>(12);

  // Daily Goal (persisted in localStorage)
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('study_daily_goal_minutes');
      return saved ? Number(saved) : 120;
    } catch {
      return 120;
    }
  });

  const handleSetDailyGoal = (mins: number) => {
    setDailyGoalMinutes(mins);
    try {
      localStorage.setItem('study_daily_goal_minutes', String(mins));
    } catch {
      // ignore
    }
  };

  // Study Tasks State (همگام‌سازی لحظه‌ای با تسک‌های برنامه)
  const [tasks, setTasks] = useState<StudyTask[]>(() => getAllTasksFromStorage());

  useEffect(() => {
    const handleStorageChange = () => {
      setTasks(getAllTasksFromStorage());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);
  const activeTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const highPriorityTasks = useMemo(
    () => tasks.filter((t) => !t.completed && t.priority === 'high'),
    [tasks]
  );
  const taskCompletionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((completedTasks.length / tasks.length) * 100);
  }, [tasks, completedTasks]);

  const handleToggleTask = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    const willBeCompleted = !target.completed;
    if (willBeCompleted) {
      playTaskCompleteSound(0.6);
    } else {
      playTaskUndoSound(0.35);
    }

    const updated = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            completed: willBeCompleted,
            completedAt: willBeCompleted
              ? new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
              : undefined,
          }
        : t
    );
    setTasks(updated);
    saveAllTasksToStorage(updated);
  };

  // Safe Date parsing
  const getSessionDate = (session: PomodoroSession): Date => {
    if (session.createdAt) return new Date(session.createdAt);
    if (session.timestamp) {
      const d = new Date(session.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  // Study session identifier
  const isStudySession = (s: PomodoroSession) =>
    s.type === 'focus' ||
    s.type === 'file-study' ||
    s.type === 'app-usage' ||
    (s.type !== 'short-break' && s.type !== 'long-break');

  // Convert JS Day (0=Sun, 6=Sat) to Persian index (0=Sat, 6=Fri)
  const jsDayToPersianIndex = (jsDay: number): number => {
    return (jsDay + 1) % 7;
  };

  const currentJsDay = new Date().getDay();
  const currentPersianDayIndex = jsDayToPersianIndex(currentJsDay);

  // Persian date formatted for today
  const todayPersianDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return 'امروز';
    }
  }, []);

  // Countdown until midnight reset
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours} ساعت و ${mins} دقیقه تا بازنشانی`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  // All-time session categorization
  const studySessions = useMemo(() => sessions.filter(isStudySession), [sessions]);
  const pomodoroSessions = useMemo(() => sessions.filter((s) => s.type === 'focus'), [sessions]);
  const fileStudySessions = useMemo(() => sessions.filter((s) => s.type === 'file-study'), [sessions]);
  const breakSessions = useMemo(
    () => sessions.filter((s) => s.type === 'short-break' || s.type === 'long-break'),
    [sessions]
  );

  const totalFocusMinutes = useMemo(
    () => studySessions.reduce((acc, s) => acc + (s.durationMinutes ?? 25), 0),
    [studySessions]
  );

  const totalBreakMinutes = useMemo(
    () => breakSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 5), 0),
    [breakSessions]
  );

  const totalStudyHours = Math.floor(totalFocusMinutes / 60);
  const remainingStudyMins = totalFocusMinutes % 60;

  const totalWordsInNotes = useMemo(
    () =>
      notes.reduce((acc, n) => {
        const words = (n.content || '').trim().split(/\s+/).filter(Boolean);
        return acc + words.length;
      }, 0),
    [notes]
  );

  // =========================================================================
  // 1. TODAY'S METRICS (STRICT 00:00:00 TO 23:59:59.999 CALENDAR DAY)
  // Automatically resets to 0 every day at midnight!
  // =========================================================================
  const todayBounds = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.getTime(), end: end.getTime() };
  }, []);

  const todaySessions = useMemo(() => {
    return sessions.filter((s) => {
      const time = getSessionDate(s).getTime();
      return time >= todayBounds.start && time < todayBounds.end;
    });
  }, [sessions, todayBounds]);

  const todayStudySessions = useMemo(
    () => todaySessions.filter(isStudySession),
    [todaySessions]
  );

  const todayBreakSessions = useMemo(
    () => todaySessions.filter((s) => s.type === 'short-break' || s.type === 'long-break'),
    [todaySessions]
  );

  const todayFocusMinutes = useMemo(() => {
    return todayStudySessions.reduce((acc, s) => acc + (s.durationMinutes ?? 25), 0);
  }, [todayStudySessions]);

  const todayBreakMinutes = useMemo(() => {
    return todayBreakSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 5), 0);
  }, [todayBreakSessions]);

  const todayHours = Math.floor(todayFocusMinutes / 60);
  const todayRemainingMins = todayFocusMinutes % 60;

  const todayGoalPercent = Math.min(
    Math.round((todayFocusMinutes / (dailyGoalMinutes || 1)) * 100),
    100
  );
  const isTodayGoalAchieved = todayFocusMinutes >= dailyGoalMinutes && dailyGoalMinutes > 0;
  const minutesUntilGoal = Math.max(0, dailyGoalMinutes - todayFocusMinutes);

  const todayTotalTime = todayFocusMinutes + todayBreakMinutes;
  const todayRatio = todayTotalTime > 0
    ? Math.round((todayFocusMinutes / todayTotalTime) * 100)
    : 100;

  // Files studied specifically today
  const todayFiles = useMemo(() => {
    const map = new Map<string, number>();
    todayStudySessions.forEach((s) => {
      const name = s.fileName && s.fileName.trim() ? s.fileName.trim() : 'مطالعه آزاد و پومودورو';
      map.set(name, (map.get(name) || 0) + (s.durationMinutes ?? 25));
    });
    return Array.from(map.entries())
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [todayStudySessions]);

  // Today circadian distribution
  const todayCircadian = useMemo(() => {
    const slots = [
      { id: 'morning', label: 'صبحگاه', range: '۰۶:۰۰ الی ۱۲:۰۰', minutes: 0 },
      { id: 'noon', label: 'نیمروز', range: '۱۲:۰۰ الی ۱۷:۰۰', minutes: 0 },
      { id: 'evening', label: 'عصرگاه', range: '۱۷:۰۰ الی ۲۲:۰۰', minutes: 0 },
      { id: 'night', label: 'شبانگاهی', range: '۲۲:۰۰ الی ۰۶:۰۰', minutes: 0 },
    ];

    todayStudySessions.forEach((s) => {
      const h = getSessionDate(s).getHours();
      const mins = s.durationMinutes ?? 25;
      if (h >= 6 && h < 12) slots[0].minutes += mins;
      else if (h >= 12 && h < 17) slots[1].minutes += mins;
      else if (h >= 17 && h < 22) slots[2].minutes += mins;
      else slots[3].minutes += mins;
    });

    const maxSlotMinutes = Math.max(...slots.map((s) => s.minutes), 1);
    return slots.map((s) => ({
      ...s,
      percentage: Math.round((s.minutes / maxSlotMinutes) * 100),
    }));
  }, [todayStudySessions]);

  // =========================================================================
  // 2. WEEKLY DATA
  // =========================================================================
  const persianWeekTemplate = useMemo(
    () => [
      { dayIndex: 0, name: 'شنبه', shortName: 'ش' },
      { dayIndex: 1, name: 'یکشنبه', shortName: 'ی' },
      { dayIndex: 2, name: 'دوشنبه', shortName: 'د' },
      { dayIndex: 3, name: 'سه‌شنبه', shortName: 'س' },
      { dayIndex: 4, name: 'چهارشنبه', shortName: 'چ' },
      { dayIndex: 5, name: 'پنجشنبه', shortName: 'پ' },
      { dayIndex: 6, name: 'جمعه', shortName: 'ج' },
    ],
    []
  );

  const weeklyData: PersianWeekDay[] = useMemo(() => {
    const days: PersianWeekDay[] = persianWeekTemplate.map((pwd) => ({
      dayIndex: pwd.dayIndex,
      name: pwd.name,
      shortName: pwd.shortName,
      focusMinutes: 0,
      breakMinutes: 0,
      sessionCount: 0,
      isToday: pwd.dayIndex === currentPersianDayIndex,
      sessions: [],
    }));

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    sessions.forEach((s) => {
      const sDate = getSessionDate(s);
      if (sDate.getTime() >= sevenDaysAgo || sessions.length <= 15) {
        const pIndex = jsDayToPersianIndex(sDate.getDay());
        const target = days.find((d) => d.dayIndex === pIndex);
        if (target) {
          if (isStudySession(s)) {
            target.focusMinutes += s.durationMinutes ?? 25;
            target.sessionCount += 1;
            target.sessions.push(s);
          } else {
            target.breakMinutes += s.durationMinutes ?? 5;
          }
        }
      }
    });

    return days;
  }, [sessions, persianWeekTemplate, currentPersianDayIndex]);

  const maxWeeklyMinutes = useMemo(() => {
    const maxVal = Math.max(...weeklyData.map((d) => d.focusMinutes), 0);
    return Math.max(maxVal, 60);
  }, [weeklyData]);

  const weeklyTotalMinutes = useMemo(
    () => weeklyData.reduce((acc, d) => acc + d.focusMinutes, 0),
    [weeklyData]
  );

  const activeDaysThisWeek = useMemo(
    () => weeklyData.filter((d) => d.focusMinutes > 0).length,
    [weeklyData]
  );

  const averageDailyMinutes = Math.round(weeklyTotalMinutes / (activeDaysThisWeek || 1));

  const peakDay = useMemo(() => {
    let best = weeklyData[0];
    weeklyData.forEach((d) => {
      if (d.focusMinutes > best.focusMinutes) best = d;
    });
    return best && best.focusMinutes > 0 ? best : null;
  }, [weeklyData]);

  // Selected Day Drill-down in Weekly Tab
  const selectedDayData = useMemo(() => {
    if (selectedDayIndex === null) return null;
    return weeklyData.find((d) => d.dayIndex === selectedDayIndex) || null;
  }, [selectedDayIndex, weeklyData]);

  // =========================================================================
  // 3. CIRCADIAN HOURLY DATA (6 BLOCKS)
  // =========================================================================
  const hourlyBlocks: HourlyTimeBlock[] = useMemo(() => {
    const blocks: HourlyTimeBlock[] = [
      {
        key: 'h1',
        label: 'صبح زود',
        periodName: 'سحرخیز',
        timeRange: '۰۶:۰۰ الی ۰۹:۰۰',
        focusMinutes: 0,
        sessionCount: 0,
        description: 'هوشیاری اولیه پس از بیداری و بازدهی بالا در مفاهیم جدید',
      },
      {
        key: 'h2',
        label: 'پیش از ظهر',
        periodName: 'اوج تمرکز تحلیلی',
        timeRange: '۰۹:۰۰ الی ۱۲:۰۰',
        focusMinutes: 0,
        sessionCount: 0,
        description: 'پیک دوپامین و هوشیاری شناختی؛ ایده‌آل برای مباحث سخت و ریاضیات',
      },
      {
        key: 'h3',
        label: 'نیمروز',
        periodName: 'میانه روز و افت ملایم',
        timeRange: '۱۲:۰۰ الی ۱۵:۰۰',
        focusMinutes: 0,
        sessionCount: 0,
        description: 'زمان مناسب برای استراحت، مرور سریع خلاصه یادداشت‌ها یا خواندن سبک',
      },
      {
        key: 'h4',
        label: 'عصرگاه',
        periodName: 'تمرکز عمیق پایدار',
        timeRange: '۱۵:۰۰ الی ۱۸:۰۰',
        focusMinutes: 0,
        sessionCount: 0,
        description: 'موج دوم انرژی مغزی؛ مناسب برای حل مسئله و تمرین‌های فشرده',
      },
      {
        key: 'h5',
        label: 'شامگاه',
        periodName: 'جمع‌بندی و آرامش',
        timeRange: '۱۸:۰۰ الی ۲۱:۰۰',
        focusMinutes: 0,
        sessionCount: 0,
        description: 'مرور فعال آموخته‌های روز و نوشتن نکات نهایی',
      },
      {
        key: 'h6',
        label: 'شبانگاهی',
        periodName: 'سکوت و تمرکز انفرادی',
        timeRange: '۲۱:۰۰ الی ۲۴:۰۰',
        focusMinutes: 0,
        sessionCount: 0,
        description: 'مطالعه در سکوت شب؛ مراقب خستگی بینایی و نور آبی باشید',
      },
    ];

    studySessions.forEach((s) => {
      const sDate = getSessionDate(s);
      const hour = sDate.getHours();
      let idx = 0;
      if (hour >= 6 && hour < 9) idx = 0;
      else if (hour >= 9 && hour < 12) idx = 1;
      else if (hour >= 12 && hour < 15) idx = 2;
      else if (hour >= 15 && hour < 18) idx = 3;
      else if (hour >= 18 && hour < 21) idx = 4;
      else idx = 5;

      blocks[idx].focusMinutes += s.durationMinutes ?? 25;
      blocks[idx].sessionCount += 1;
    });

    return blocks;
  }, [studySessions]);

  const maxHourlyMinutes = useMemo(() => {
    const maxVal = Math.max(...hourlyBlocks.map((b) => b.focusMinutes), 0);
    return Math.max(maxVal, 40);
  }, [hourlyBlocks]);

  const peakHourlyBlock = useMemo(() => {
    let best = hourlyBlocks[0];
    hourlyBlocks.forEach((b) => {
      if (b.focusMinutes > best.focusMinutes) best = b;
    });
    return best && best.focusMinutes > 0 ? best : null;
  }, [hourlyBlocks]);

  // =========================================================================
  // 4. TOPIC & DOCUMENT BREAKDOWN
  // =========================================================================
  const fileBreakdown = useMemo(() => {
    const map = new Map<string, { minutes: number; count: number; isFile: boolean }>();
    studySessions.forEach((s) => {
      const isFile = Boolean(s.fileName && s.fileName.trim());
      const name = isFile ? s.fileName!.trim() : 'مطالعه آزاد و پومودورو';
      const existing = map.get(name) || { minutes: 0, count: 0, isFile };
      map.set(name, {
        minutes: existing.minutes + (s.durationMinutes ?? 0),
        count: existing.count + 1,
        isFile,
      });
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        minutes: data.minutes,
        count: data.count,
        isFile: data.isFile,
        percentage:
          totalFocusMinutes > 0 ? Math.round((data.minutes / totalFocusMinutes) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [studySessions, totalFocusMinutes]);

  const filteredFileBreakdown = useMemo(() => {
    if (!topicSearchQuery.trim()) return fileBreakdown;
    const q = topicSearchQuery.trim().toLowerCase();
    return fileBreakdown.filter((f) => f.name.toLowerCase().includes(q));
  }, [fileBreakdown, topicSearchQuery]);

  // Deep work ratio
  const focusBreakTotal = totalFocusMinutes + totalBreakMinutes;
  const focusRatio = focusBreakTotal > 0 ? Math.round((totalFocusMinutes / focusBreakTotal) * 100) : 85;

  // =========================================================================
  // 5. SESSION JOURNAL TIMELINE
  // =========================================================================
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const isBreak = s.type === 'short-break' || s.type === 'long-break';
      const isFile = Boolean(s.fileName && s.fileName.trim());

      if (sessionFilter === 'focus' && (isBreak || isFile)) return false;
      if (sessionFilter === 'file' && !isFile) return false;
      if (sessionFilter === 'break' && !isBreak) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const nameMatch = (s.fileName || '').toLowerCase().includes(query);
        const typeMatch = (s.type || '').toLowerCase().includes(query);
        const dateMatch = (s.date || '').toLowerCase().includes(query);
        if (!nameMatch && !typeMatch && !dateMatch) return false;
      }

      return true;
    });
  }, [sessions, sessionFilter, searchQuery]);

  // Copy structured study report to clipboard
  const handleCopyStudyReport = () => {
    const reportText = `📊 کارنامه و گزارش عملکرد مطالعه
📅 تاریخ: ${new Date().toLocaleDateString('fa-IR')}
⏱️ مجموع زمان مطالعه و تمرکز: ${totalStudyHours} ساعت و ${remainingStudyMins} دقیقه (${totalFocusMinutes} دقیقه)
🎯 تعداد جلسات مطالعه: ${studySessions.length} نشست
☕ زمان استراحت: ${totalBreakMinutes} دقیقه
📝 تعداد یادداشت‌ها: ${notes.length} یادداشت (${totalWordsInNotes} کلمه)
${peakDay ? `🔥 روز اوج تمرکز: ${peakDay.name} (${peakDay.focusMinutes} دقیقه)` : ''}
${peakHourlyBlock ? `⚡ ساعت اوج هوشیاری: ${peakHourlyBlock.label} (${peakHourlyBlock.timeRange})` : ''}

📚 سهم کتاب‌ها و مباحث:
${fileBreakdown.map((f) => `• ${f.name}: ${f.minutes} دقیقه (${f.percentage}%)`).join('\n') || 'ثبت نشده'}
`;
    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedReportToast(true);
      setTimeout(() => setCopiedReportToast(false), 2500);
    });
  };

  const handleConfirmReset = () => {
    onClearHistory();
    setShowResetConfirm(false);
    setSelectedDayIndex(null);
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50/60 overflow-hidden select-none" dir="rtl">
      {/* Toast Notification */}
      {copiedReportToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>خلاصه کارنامه مطالعه در کلیپ‌بورد کپی شد</span>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-neutral-800" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-neutral-900">بازنشانی تاریخچه آمار مطالعه</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                آیا مایلید کلیه تاریخچه نشست‌های پومودورو و نمودارهای مطالعه پاک شوند؟ فایل‌ها و
                یادداشت‌های شما دست‌نخورده باقی می‌مانند.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 px-3 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 px-3 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تایید و پاک‌سازی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOP HEADER & DEDICATED TABS BAR (سربرگ‌های مدرن و تمام‌صفحه)
          ===================================================================== */}
      <header className="bg-white border-b border-neutral-200/70 px-4 sm:px-7 py-4 shrink-0 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Quick Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                  <span>تحلیل و پایش عملکرد</span>
                  <span className="text-[11px] font-normal text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-lg">
                    {todayPersianDate}
                  </span>
                </h1>
                <p className="text-xs text-neutral-400 mt-0.5">
                  پایش متمرکز ریتم یادگیری، اهداف روزانه و پایش زمانی مباحث
                </p>
              </div>
            </div>
          </div>

          {/* Global Quick Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {sessions.length === 0 && onLoadSampleData && (
              <button
                type="button"
                onClick={onLoadSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer transition-all shadow-2xs"
                title="بارگذاری داده‌های فرضی برای مشاهده نمودارها"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>داده نمونه</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyStudyReport}
              disabled={sessions.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                sessions.length > 0
                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 shadow-2xs'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-50'
              }`}
              title="کپی متن کارنامه مطالعه"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>خلاصه کارنامه</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              disabled={sessions.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                sessions.length > 0
                  ? 'bg-red-50 hover:bg-red-100 text-red-600 shadow-2xs'
                  : 'bg-neutral-100 text-neutral-300 cursor-not-allowed opacity-50'
              }`}
              title="پاک‌سازی تاریخچه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ریست</span>
            </button>
          </div>
        </div>

        {/* ===================================================================
            SEGMENTED FULL-PAGE TABS (سربرگ‌های اختصاصی با کلیک تمام صفحه)
            =================================================================== */}
        <div className="max-w-6xl mx-auto mt-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* Tab 1: Today Daily Hub */}
            <button
              type="button"
              onClick={() => setActiveMainTab('daily')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeMainTab === 'daily'
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <Target className={`w-4 h-4 ${activeMainTab === 'daily' ? 'text-amber-300' : 'text-neutral-500'}`} />
              <span>عملکرد امروز</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  activeMainTab === 'daily'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-200/80 text-neutral-600'
                }`}
              >
                {todayFocusMinutes}m
              </span>
            </button>

            {/* Tab 2: Weekly Rhythm */}
            <button
              type="button"
              onClick={() => setActiveMainTab('weekly')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeMainTab === 'weekly'
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>ریتم هفتگی</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  activeMainTab === 'weekly'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-200/80 text-neutral-600'
                }`}
              >
                {weeklyTotalMinutes}m
              </span>
            </button>

            {/* Tab 3: Circadian Alertness */}
            <button
              type="button"
              onClick={() => setActiveMainTab('circadian')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeMainTab === 'circadian'
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <Zap className={`w-4 h-4 ${activeMainTab === 'circadian' ? 'text-amber-300' : 'text-neutral-500'}`} />
              <span>ساعات اوج و شبانه‌روز</span>
            </button>

            {/* Tab 4: Topics & Documents */}
            <button
              type="button"
              onClick={() => setActiveMainTab('topics')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeMainTab === 'topics'
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>سهم مباحث و کتاب‌ها</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  activeMainTab === 'topics'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-200/80 text-neutral-600'
                }`}
              >
                {fileBreakdown.length}
              </span>
            </button>

            {/* Tab 5: Journal & Session Log */}
            <button
              type="button"
              onClick={() => setActiveMainTab('journal')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeMainTab === 'journal'
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>دفترچه نشست‌ها</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  activeMainTab === 'journal'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-200/80 text-neutral-600'
                }`}
              >
                {sessions.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN FULL-VIEW CONTENT CONTAINER
          Each tab renders its own dedicated, modern, uncluttered full-page view!
          ===================================================================== */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-7 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* =================================================================
              TAB 1: DEDICATED FULL-VIEW: TODAY'S DAILY PERFORMANCE
              ================================================================= */}
          {activeMainTab === 'daily' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Daily Top Strip & Reset Banner (Slim / Thin Design) */}
              <div className="bg-white px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-2xl shadow-2xs border border-neutral-100/80 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-neutral-900 truncate">پایش زنده عملکرد امروز</span>
                  <span className="text-neutral-300 text-xs hidden sm:inline">·</span>
                  <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline truncate">
                    {todayPersianDate}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-100/90 px-2.5 py-1 rounded-xl text-[11px] text-neutral-500 shrink-0">
                  <RotateCcw className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span className="font-medium text-neutral-600">بازنشانی بامداد ۰۰:۰۰</span>
                  <span className="text-neutral-400 font-mono text-[10px] hidden sm:inline">({timeUntilReset})</span>
                </div>
              </div>

              {/* Today Hero Focus & Daily Goal Command Deck */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Hero Time & Circular Goal Progress Card (7 cols) */}
                <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between space-y-6">
                  {/* Top Header & Session Quick Info */}
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="font-medium">زمان کل تمرکز امروز</span>
                    <span className="font-semibold text-neutral-800 bg-neutral-100/90 px-2.5 py-1 rounded-xl">
                      {todayFocusMinutes} دقیقه خالص
                    </span>
                  </div>

                  {/* Circular Progress & Time Display in Unified Deck */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 py-1">
                    {/* Circle with sleek black progress ring */}
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90 transform-gpu" viewBox="0 0 120 120">
                        {/* Background Track */}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="currentColor"
                          className="text-neutral-100"
                          strokeWidth="8.5"
                        />
                        {/* Black Progress Stroke */}
                        <circle
                          cx="60"
                          cy="60"
                          r="50"
                          fill="none"
                          stroke="currentColor"
                          className="text-neutral-900 transition-all duration-700 ease-out"
                          strokeWidth="8.5"
                          strokeLinecap="round"
                          strokeDasharray={314.16}
                          strokeDashoffset={314.16 - (todayGoalPercent / 100) * 314.16}
                        />
                      </svg>
                      {/* Center Content in Elegant Persian Typography */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                        <span className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                          ٪{todayGoalPercent}
                        </span>
                        <span className="text-[11px] font-medium text-neutral-500 mt-0.5">
                          {isTodayGoalAchieved ? 'هدف تکمیل شد' : 'پیشرفت هدف'}
                        </span>
                      </div>
                    </div>

                    {/* Stats alongside circular ring */}
                    <div className="flex-1 min-w-0 text-center sm:text-right space-y-2">
                      <div className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight">
                        {todayHours > 0 ? `${todayHours} ساعت و ` : ''}{todayRemainingMins} دقیقه
                      </div>

                      <div className="text-xs text-neutral-600 leading-relaxed">
                        {isTodayGoalAchieved ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            تبریک! هدف مطالعه امروز تکمیل شد 🎉
                          </span>
                        ) : todayFocusMinutes > 0 ? (
                          <span className="text-neutral-600 font-medium">
                            <strong className="text-neutral-900 font-bold">{minutesUntilGoal} دقیقه</strong> تا تکمیل هدف روزانه
                          </span>
                        ) : (
                          <span className="text-neutral-400">هنوز جلسه تمرکزی برای امروز ثبت نشده است</span>
                        )}
                      </div>

                      <div className="text-[11px] text-neutral-400 pt-1">
                        هدف تعیین‌شده:{' '}
                        <strong className="text-neutral-700 font-bold">
                          {dailyGoalMinutes >= 60 ? `${dailyGoalMinutes / 60} ساعت` : `${dailyGoalMinutes} دقیقه`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Goal Presets Selector (Clean Persian Typography) */}
                  <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-neutral-500 font-medium">تنظیم هدف روزانه:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { mins: 60, label: '۱ ساعت' },
                        { mins: 90, label: '۱.۵ ساعت' },
                        { mins: 120, label: '۲ ساعت' },
                        { mins: 180, label: '۳ ساعت' },
                        { mins: 240, label: '۴ ساعت' },
                      ].map((preset) => (
                        <button
                          key={preset.mins}
                          type="button"
                          onClick={() => handleSetDailyGoal(preset.mins)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            dailyGoalMinutes === preset.mins
                              ? 'bg-neutral-900 text-white font-bold shadow-xs'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 hover:text-neutral-900'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Today 4-Metric Grid (5 cols) */}
                <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                  {/* Metric 1: Sessions */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 text-xs">
                      <span>نشست‌های امروز</span>
                      <span className="p-1.5 rounded-xl bg-neutral-100 text-neutral-800">
                        <Activity className="w-4 h-4" />
                      </span>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-neutral-900 tabular-nums">
                        {todayStudySessions.length}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1">
                        {todayStudySessions.length > 0 ? 'جلسه تمرکز ثبت‌شده' : 'در انتظار شروع'}
                      </div>
                    </div>
                  </div>

                  {/* Metric 2: Completed Tasks (ادغام تسک‌های انجام‌شده در عملکرد) */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 text-xs">
                      <span>تسک‌های انجام‌شده</span>
                      <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-neutral-900 tabular-nums flex items-baseline gap-1.5">
                        <span>{completedTasks.length}</span>
                        {tasks.length > 0 && (
                          <span className="text-xs font-normal text-neutral-400">
                            از {tasks.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1">
                        {completedTasks.length > 0
                          ? `٪${taskCompletionRate} نرخ پیشرفت`
                          : 'در انتظار تکمیل'}
                      </div>
                    </div>
                  </div>

                  {/* Metric 3: Break Time */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 text-xs">
                      <span>استراحت امروز</span>
                      <span className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
                        <Coffee className="w-4 h-4" />
                      </span>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-neutral-900 tabular-nums">
                        {todayBreakMinutes}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1">دقیقه آرامش ذهن</div>
                    </div>
                  </div>

                  {/* Metric 4: Focus Ratio */}
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 text-xs">
                      <span>راندمان تمرکز</span>
                      <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                        <Award className="w-4 h-4" />
                      </span>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-neutral-900 tabular-nums">
                        ٪{todayRatio}
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1">نسبت مطالعه مفید</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Daylight Circadian Rhythm */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">
                      توزیع ریتم زمانی مطالعه در طول روز
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      دقایق تمرکز انجام‌شده در فازهای مختلف امروز
                    </p>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">
                    مجموع امروز: {todayFocusMinutes} دقیقه
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {todayCircadian.map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-800">{slot.label}</span>
                        <span className="text-xs font-mono font-bold text-neutral-900">
                          {slot.minutes} دقیقه
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-200/70 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${slot.percentage}%` }}
                          className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                        />
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono block text-left">
                        {slot.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's Studied Books & Topics */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">
                      کتاب‌ها و فایل‌های مطالعه‌شده در امروز
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      سرفصل‌هایی که از بامداد امروز روی آن‌ها وقت گذاشته‌اید
                    </p>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">
                    {todayFiles.length} مبحث
                  </span>
                </div>

                {todayFiles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {todayFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="p-2 rounded-xl bg-white text-neutral-700 shadow-2xs shrink-0">
                            <BookOpen className="w-4 h-4" />
                          </span>
                          <span className="text-xs font-bold text-neutral-900 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-neutral-900 bg-white px-2.5 py-1 rounded-xl shadow-2xs shrink-0">
                          {file.minutes}m
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200 text-xs text-neutral-400 space-y-1">
                    <BookOpen className="w-6 h-6 text-neutral-300 mx-auto" />
                    <p>هنوز برای امروز جلسه‌ای ثبت نشده است.</p>
                    <p className="text-[11px] text-neutral-400">
                      با فعال کردن تایمر پومودورو یا باز کردن هر کتاب، گزارش عملکرد امروز شما بلافاصله تکمیل می‌شود.
                    </p>
                  </div>
                )}
              </div>

              {/* Completed Tasks in Performance Card (ادغام تسک‌های انجام‌شده در عملکرد) */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <h2 className="text-sm sm:text-base font-bold text-neutral-900">
                        تسک‌های تکمیل‌شده در عملکرد امروز
                      </h2>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      اهداف و اقدامات مطالعاتی که در طول جلسات امروز با موفقیت تیک خورده و به سرانجام رسیده‌اند
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100/80 px-3 py-1.5 rounded-xl font-bold">
                      {completedTasks.length} تسک تکمیل‌شده
                    </span>
                    {tasks.length > 0 && (
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1.5 rounded-xl font-medium">
                        از کل {tasks.length} تسک (٪{taskCompletionRate})
                      </span>
                    )}
                  </div>
                </div>

                {/* Completed Tasks List */}
                <div className="space-y-2 pt-1">
                  {completedTasks.length === 0 ? (
                    <div className="py-7 text-center bg-neutral-50/60 rounded-2xl border border-dashed border-neutral-200 text-xs text-neutral-400 space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-neutral-300 mx-auto" />
                      <p className="font-semibold text-neutral-600">هنوز تسکی تکمیل نشده است</p>
                      <p className="text-[11px] text-neutral-400">
                        با تیک زدن تسک‌ها در بخش یادداشت‌ها، سوابق اقدامات انجام‌شده شما به صورت زنده در این قسمت ثبت می‌شود.
                      </p>
                    </div>
                  ) : (
                    completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border border-neutral-200/90 bg-white hover:bg-neutral-50/60 transition-all shadow-2xs group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task.id)}
                            className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs cursor-pointer hover:bg-emerald-600 transition-colors"
                            title="تکمیل‌شده (کلیک برای بازگردانی)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-semibold text-neutral-900 block truncate">
                              {task.title}
                            </span>
                            {task.completedAt && (
                              <span className="text-[11px] text-emerald-600 block mt-0.5">
                                انجام شد در ساعت {task.completedAt}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {task.priority === 'high' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100">
                              فوری
                            </span>
                          )}
                          {task.priority === 'medium' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                              مهم
                            </span>
                          )}
                          {task.priority === 'low' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                              عادی
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: DEDICATED FULL-VIEW: WEEKLY RHYTHM & TRENDS
              ================================================================= */}
          {activeMainTab === 'weekly' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Weekly Hero Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                  <div className="text-xs text-neutral-400">مجموع مطالعه هفتگی</div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 tabular-nums">
                    {Math.floor(weeklyTotalMinutes / 60) > 0 ? `${Math.floor(weeklyTotalMinutes / 60)} ساعت و ` : ''}{weeklyTotalMinutes % 60} دقیقه
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">{weeklyTotalMinutes} دقیقه خالص</div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                  <div className="text-xs text-neutral-400">میانگین روزهای فعال</div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 tabular-nums">
                    {averageDailyMinutes} دقیقه
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">در هر روز با مطالعه</div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                  <div className="text-xs text-neutral-400">روز اوج تمرکز</div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 flex items-center gap-1.5">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <span>{peakDay ? peakDay.name : '—'}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    {peakDay ? `${peakDay.focusMinutes} دقیقه تمرکز` : 'در انتظار ثبت'}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between">
                  <div className="text-xs text-neutral-400">تداوم در هفته</div>
                  <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 tabular-nums">
                    {activeDaysThisWeek} <span className="text-base text-neutral-400 font-normal">از ۷ روز</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">روزهای فعال هفته جاری</div>
                </div>
              </div>

              {/* Interactive Weekly Bar Visualizer */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-neutral-900">
                      نمودار توزیع زمان مطالعه در روزهای هفته (شنبه تا جمعه)
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      روی هر روز کلیک کنید تا جزئیات و نشست‌های ثبت‌شده آن روز را ببینید
                    </p>
                  </div>
                  <div className="text-xs text-neutral-400 font-mono">
                    سقف مقیاس: {maxWeeklyMinutes} دقیقه
                  </div>
                </div>

                {/* Bars Area */}
                <div className="pt-8 pb-4">
                  <div className="h-56 sm:h-64 flex items-end justify-between gap-2 sm:gap-6 px-2 sm:px-6 relative">
                    {/* Dashed Target Line */}
                    <div className="absolute inset-x-2 sm:inset-x-6 top-0 border-b border-dashed border-neutral-200 pointer-events-none flex justify-end">
                      <span className="text-[10px] text-neutral-400 font-mono -mt-3.5 bg-white px-1">
                        {maxWeeklyMinutes}m
                      </span>
                    </div>
                    <div className="absolute inset-x-2 sm:inset-x-6 top-1/2 border-b border-dashed border-neutral-100 pointer-events-none flex justify-end">
                      <span className="text-[10px] text-neutral-400 font-mono -mt-3.5 bg-white px-1">
                        {Math.round(maxWeeklyMinutes / 2)}m
                      </span>
                    </div>

                    {weeklyData.map((day) => {
                      const heightPercent =
                        maxWeeklyMinutes > 0
                          ? Math.min(Math.round((day.focusMinutes / maxWeeklyMinutes) * 100), 100)
                          : 0;
                      const isSelected = selectedDayIndex === day.dayIndex;

                      return (
                        <div
                          key={day.dayIndex}
                          onClick={() => setSelectedDayIndex(isSelected ? null : day.dayIndex)}
                          className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        >
                          {/* Floating Tooltip */}
                          <div
                            className={`absolute -top-12 z-20 bg-neutral-900 text-white text-[11px] px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap pointer-events-none transition-all duration-150 flex items-center gap-1.5 ${
                              isSelected
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
                            }`}
                          >
                            <span className="font-bold">{day.name}:</span>
                            <span className="font-mono text-amber-300">{day.focusMinutes}m</span>
                            {day.sessionCount > 0 && (
                              <span className="text-neutral-400 text-[10px]">
                                ({day.sessionCount} نشست)
                              </span>
                            )}
                          </div>

                          {/* Column Track */}
                          <div
                            className={`w-8 sm:w-12 md:w-14 h-full rounded-2xl p-1 flex flex-col justify-end transition-all ${
                              isSelected
                                ? 'bg-neutral-200 ring-2 ring-neutral-900'
                                : 'bg-neutral-100 hover:bg-neutral-200/70'
                            }`}
                          >
                            <div
                              style={{
                                height: `${Math.max(heightPercent, day.focusMinutes > 0 ? 10 : 0)}%`,
                              }}
                              className={`w-full rounded-xl transition-all duration-300 ${
                                day.isToday
                                  ? 'bg-neutral-900 shadow-sm'
                                  : day.focusMinutes > 0
                                  ? 'bg-neutral-700 group-hover:bg-neutral-900'
                                  : 'bg-transparent'
                              }`}
                            />
                          </div>

                          {/* Day Label */}
                          <div className="mt-3 text-center">
                            <span
                              className={`text-xs block font-medium transition-colors ${
                                day.isToday
                                  ? 'font-bold text-neutral-900'
                                  : isSelected
                                  ? 'text-neutral-900 font-bold'
                                  : 'text-neutral-500 group-hover:text-neutral-800'
                              }`}
                            >
                              {day.name}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                              {day.focusMinutes > 0 ? `${day.focusMinutes}m` : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Day Drill-down Drawer */}
                {selectedDayData && (
                  <div className="mt-4 p-5 rounded-2xl bg-neutral-50 border border-neutral-200/80 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-neutral-900" />
                        <h3 className="text-xs font-bold text-neutral-900">
                          گزارش نشست‌های {selectedDayData.name}
                        </h3>
                        <span className="text-[11px] font-mono text-neutral-500">
                          ({selectedDayData.focusMinutes} دقیقه تمرکز · {selectedDayData.breakMinutes} دقیقه استراحت)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDayIndex(null)}
                        className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      >
                        بستن
                      </button>
                    </div>

                    {selectedDayData.sessions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                        {selectedDayData.sessions.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className="bg-white p-3 rounded-xl border border-neutral-100 text-xs flex items-center justify-between"
                          >
                            <span className="truncate max-w-[140px] text-neutral-700 font-medium">
                              {s.fileName || 'تمرکز آزاد'}
                            </span>
                            <span className="font-mono text-neutral-900 font-bold">
                              {s.durationMinutes ?? 25} دقیقه
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400">در این روز فعالیتی ثبت نشده است.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: DEDICATED FULL-VIEW: CIRCADIAN ALERTNESS & PEAK HOURS
              ================================================================= */}
          {activeMainTab === 'circadian' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Peak Hour Banner */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>شناسایی ساعت اوج هوشیاری و کرونوتایپ شناختی</span>
                  </div>
                  <p className="text-xs text-neutral-500 max-w-2xl leading-relaxed">
                    مغز انسان در چرخه‌های ۲۴ ساعته تغییرات قابل توجهی در ترشح کورتیزول و دوپامین دارد. مطالعه در ساعات اوج تمرکز باعث پایداری ۲ برابری حافظه با خستگی کمتر می‌شود.
                  </p>
                </div>

                {peakHourlyBlock && (
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 text-left shrink-0">
                    <span className="text-[11px] text-neutral-400 block mb-0.5">پربازده‌ترین ساعت شما:</span>
                    <span className="text-sm font-bold text-neutral-900 block font-mono">
                      {peakHourlyBlock.label} ({peakHourlyBlock.timeRange})
                    </span>
                    <span className="text-[11px] text-amber-600 font-mono font-bold block mt-1">
                      {peakHourlyBlock.focusMinutes} دقیقه تمرکز خالص
                    </span>
                  </div>
                )}
              </div>

              {/* 6 Circadian Blocks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hourlyBlocks.map((block) => {
                  const percent =
                    maxHourlyMinutes > 0
                      ? Math.round((block.focusMinutes / maxHourlyMinutes) * 100)
                      : 0;
                  const isPeak = peakHourlyBlock?.key === block.key && block.focusMinutes > 0;

                  return (
                    <div
                      key={block.key}
                      className={`bg-white p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                        isPeak
                          ? 'border-neutral-900 shadow-md ring-1 ring-neutral-900'
                          : 'border-neutral-100 shadow-sm'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            {isPeak && <Flame className="w-3.5 h-3.5 text-amber-500" />}
                            {block.label}
                          </span>
                          <span className="text-[11px] font-mono font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-lg">
                            {block.timeRange}
                          </span>
                        </div>

                        <div className="text-xs font-medium text-neutral-500">
                          {block.periodName}
                        </div>

                        <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                          {block.description}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-neutral-400">{block.sessionCount} نشست</span>
                          <span className="font-bold text-neutral-900">{block.focusMinutes} دقیقه</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${percent}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${
                              isPeak ? 'bg-neutral-900' : 'bg-neutral-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 4: DEDICATED FULL-VIEW: TOPICS & DOCUMENTS BREAKDOWN
              ================================================================= */}
          {activeMainTab === 'topics' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header & Topic Search */}
              <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-neutral-900">
                    سهم‌بندی زمانی کتاب‌ها، مقالات و مباحث
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    بررسی تفکیکی زمان سرمایه‌گذاری‌شده روی هر سند و کتاب
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={topicSearchQuery}
                    onChange={(e) => setTopicSearchQuery(e.target.value)}
                    placeholder="جستجوی عنوان کتاب یا فایل..."
                    className="w-full pr-10 pl-3 py-2 text-xs bg-neutral-100 rounded-2xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-neutral-50 border border-transparent focus:border-neutral-300"
                  />
                </div>
              </div>

              {/* Topics List / Grid */}
              {filteredFileBreakdown.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredFileBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-5 rounded-3xl shadow-sm border border-neutral-100 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="p-2 rounded-xl bg-neutral-100 text-neutral-800 shrink-0">
                            {item.isFile ? (
                              <BookOpen className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </span>
                          <span className="text-xs font-bold text-neutral-900 truncate" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-neutral-900 shrink-0">
                          {item.minutes} دقیقه ({item.percentage}%)
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${item.percentage}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.isFile ? 'bg-neutral-900' : 'bg-neutral-400'
                          }`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                        <span>{item.count} جلسه مطالعه</span>
                        <span>
                          {Math.floor(item.minutes / 60) > 0
                            ? `${Math.floor(item.minutes / 60)} ساعت و ${item.minutes % 60} دقیقه`
                            : `${item.minutes} دقیقه`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-neutral-200 text-xs text-neutral-400 space-y-2">
                  <BookOpen className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p>هیچ فایل یا مبحثی با این نام یافت نشد.</p>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 5: DEDICATED FULL-VIEW: JOURNAL & SESSION LOG
              ================================================================= */}
          {activeMainTab === 'journal' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Journal Filter & Search Header */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-neutral-900">
                    دفترچه زمانی و سوابق نشست‌ها
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    فهرست زمان‌بندی‌شده کلیه جلسات تمرکز، استراحت و بازه‌های کار با فایل
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="جستجو در سرفصل‌ها..."
                      className="w-full pr-8 pl-3 py-1.5 text-xs bg-neutral-100 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-neutral-50"
                    />
                  </div>

                  {/* Filter Types */}
                  <div className="inline-flex items-center p-1 bg-neutral-100 rounded-xl text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSessionFilter('all')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionFilter === 'all'
                          ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      همه
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionFilter('focus')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionFilter === 'focus'
                          ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      تمرکز
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionFilter('file')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionFilter === 'file'
                          ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      فایل‌ها
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionFilter('break')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionFilter === 'break'
                          ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      استراحت
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionFilter('tasks')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        sessionFilter === 'tasks'
                          ? 'bg-white text-neutral-900 font-bold shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      تسک‌های انجام‌شده ({completedTasks.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Sessions & Completed Tasks List */}
              {sessionFilter === 'tasks' ? (
                completedTasks.length > 0 ? (
                  <div className="space-y-2.5">
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white p-4 rounded-2xl shadow-2xs border border-neutral-100 flex items-center justify-between gap-4 hover:border-neutral-200 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="p-2 rounded-xl text-xs shrink-0 bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-neutral-900 block truncate">
                              {task.title}
                            </span>
                            <span className="text-[11px] text-neutral-400 mt-0.5 block">
                              {task.completedAt ? `انجام شد در ساعت ${task.completedAt}` : 'تکمیل‌شده'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {task.priority === 'high' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                              فوری
                            </span>
                          )}
                          {task.priority === 'medium' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                              مهم
                            </span>
                          )}
                          {task.priority === 'low' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-600">
                              عادی
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium bg-emerald-50 text-emerald-700">
                            تسک انجام‌شده
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-neutral-200 text-xs text-neutral-400 space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-neutral-300 mx-auto" />
                    <p>هیچ تسک تکمیل‌شده‌ای یافت نشد.</p>
                  </div>
                )
              ) : filteredSessions.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredSessions.slice(0, expandedLogCount).map((s, idx) => {
                    const isBreak = s.type === 'short-break' || s.type === 'long-break';
                    const isFile = Boolean(s.fileName && s.fileName.trim());
                    const sDate = getSessionDate(s);
                    const timeString = sDate.toLocaleTimeString('fa-IR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const dateString = sDate.toLocaleDateString('fa-IR', {
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div
                        key={s.id || idx}
                        className="bg-white p-4 rounded-2xl shadow-2xs border border-neutral-100 flex items-center justify-between gap-4 hover:border-neutral-200 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`p-2 rounded-xl text-xs shrink-0 ${
                              isBreak
                                ? 'bg-amber-50 text-amber-600'
                                : isFile
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'bg-neutral-900 text-white'
                            }`}
                          >
                            {isBreak ? (
                              <Coffee className="w-4 h-4" />
                            ) : isFile ? (
                              <BookOpen className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </span>

                          <div className="min-w-0">
                            <span className="text-xs font-bold text-neutral-900 block truncate">
                              {isFile ? s.fileName : isBreak ? 'استراحت و آرامش' : 'جلسه پومودورو'}
                            </span>
                            <span className="text-[11px] text-neutral-400 font-mono mt-0.5 block">
                              {dateString} · ساعت {timeString}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono font-bold text-neutral-900">
                            {s.durationMinutes ?? 25} دقیقه
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${
                              isBreak
                                ? 'bg-amber-50 text-amber-700'
                                : isFile
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {isBreak ? 'استراحت' : isFile ? 'مطالعه فایل' : 'تمرکز عمیق'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {filteredSessions.length > expandedLogCount && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedLogCount((c) => c + 15)}
                        className="px-5 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 rounded-2xl border border-neutral-200 cursor-pointer shadow-2xs transition-all"
                      >
                        نمایش نشست‌های بیشتر ({filteredSessions.length - expandedLogCount} مورد باقی‌مانده)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-neutral-200 text-xs text-neutral-400 space-y-1">
                  <Activity className="w-6 h-6 text-neutral-300 mx-auto" />
                  <p>نشستی مطابق با فیلتر فعلی یافت نشد.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
