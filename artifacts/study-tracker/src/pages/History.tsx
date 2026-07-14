import { useState, useRef, useMemo } from 'react';
import { useHistoryByMonth, useEarliestHistoryDate, clearHistory } from '@/db/hooks';
import { HistoryEntry } from '@/db/database';
import {
  ChevronLeft, ChevronRight, History as HistoryIcon, Trash2, BookOpen, ChevronDown,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Stage config (matches SubjectDetail donut colours) ──────────────────────
const STAGES = [
  { key: 'contentDone', label: 'Content', color: '#3b82f6', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'qbankDone',   label: 'QBank',   color: '#10b981', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { key: 'pyqsDone',    label: 'PYQs',    color: '#8b5cf6', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { key: 'revision1',  label: 'R1',      color: '#f97316', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { key: 'revision2',  label: 'R2',      color: '#06b6d4', chip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { key: 'revision3',  label: 'R3',      color: '#6b7280', chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400' },
] as const;
type StageKey = typeof STAGES[number]['key'];

const stageByKey = Object.fromEntries(STAGES.map(s => [s.key, s]));

// ── Calendar helpers ─────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_ABBR = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

// Generate list of {year, month} from earliest to now, newest first
function buildMonthRange(earliest: Date | null): { year: number; month: number }[] {
  const now = new Date();
  const endY = now.getFullYear();
  const endM = now.getMonth();
  const startDate = earliest ?? new Date(endY - 1, endM, 1);
  const startY = startDate.getFullYear();
  const startM = startDate.getMonth();
  const list: { year: number; month: number }[] = [];
  let y = endY, m = endM;
  while (y > startY || (y === startY && m >= startM)) {
    list.push({ year: y, month: m });
    m--;
    if (m < 0) { m = 11; y--; }
  }
  return list;
}

// ── Heatmap colour based on activity count ───────────────────────────────────
function heatClass(count: number) {
  if (count === 0) return 'bg-muted';
  if (count <= 2)  return 'bg-primary/20';
  if (count <= 5)  return 'bg-primary/40';
  if (count <= 10) return 'bg-primary/65';
  return 'bg-primary/90';
}

// ── Day-label helper ─────────────────────────────────────────────────────────
function dayLabel(day: number, month: number, year: number): string {
  const now = new Date();
  const d = new Date(year, month, day);
  if (d.toDateString() === now.toDateString()) return 'Today';
  return `${day} ${MONTH_NAMES[month].slice(0, 3)}`;
}

// ── Group entries by day, then by subject within the day ─────────────────────
interface DayGroup {
  day: number;
  label: string;
  subjects: { name: string; entries: HistoryEntry[] }[];
}
function groupEntries(entries: HistoryEntry[], year: number, month: number): DayGroup[] {
  // entries arrive newest-first; build day → subject → entries map
  const dayMap = new Map<number, Map<string, HistoryEntry[]>>();
  for (const e of entries) {
    const d = new Date(e.completedAt).getDate();
    if (!dayMap.has(d)) dayMap.set(d, new Map());
    const subjMap = dayMap.get(d)!;
    if (!subjMap.has(e.subjectName)) subjMap.set(e.subjectName, []);
    subjMap.get(e.subjectName)!.push(e);
  }
  return Array.from(dayMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([day, subjMap]) => ({
      day,
      label: dayLabel(day, month, year),
      subjects: Array.from(subjMap.entries()).map(([name, entries]) => ({ name, entries })),
    }));
}

// ════════════════════════════════════════════════════════════════════════════
export default function History() {
  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [filters, setFilters]     = useState<StageKey[]>([]);   // empty = All
  const [showPicker, setShowPicker]   = useState(false);
  const [pickerLevel, setPickerLevel] = useState<'months' | 'years'>('months');
  const [pickerYear, setPickerYear]   = useState<number | null>(null);

  const earliest = useEarliestHistoryDate();
  const monthEntries = useHistoryByMonth(viewYear, viewMonth);

  // Refs for heatmap → scroll-to-day
  const dayRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Filtered entries ────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filters.length === 0
      ? monthEntries
      : monthEntries.filter(e => filters.includes(e.taskKey as StageKey)),
    [monthEntries, filters],
  );

  // ── Summary stats (always unfiltered for the month) ─────────────────────
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of monthEntries) {
      counts[e.taskKey] = (counts[e.taskKey] ?? 0) + 1;
    }
    return counts;
  }, [monthEntries]);

  // ── Heatmap data: count per calendar day (unfiltered) ───────────────────
  const heatmap = useMemo(() => {
    const map: Record<number, number> = {};
    for (const e of monthEntries) {
      const d = new Date(e.completedAt).getDate();
      map[d] = (map[d] ?? 0) + 1;
    }
    return map;
  }, [monthEntries]);

  // ── Grouped timeline ────────────────────────────────────────────────────
  const dayGroups = useMemo(
    () => groupEntries(filtered, viewYear, viewMonth),
    [filtered, viewYear, viewMonth],
  );

  // ── Month navigation ────────────────────────────────────────────────────
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
  const goPrev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const jumpTo = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    setShowPicker(false);
  };

  // ── Filter chip toggle ──────────────────────────────────────────────────
  const toggleFilter = (key: StageKey) => {
    setFilters(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  };

  // ── Picker month list ───────────────────────────────────────────────────
  const monthRange = useMemo(() => buildMonthRange(earliest), [earliest]);
  const years = useMemo(
    () => [...new Set(monthRange.map(m => m.year))],
    [monthRange],
  );
  const pickerMonths = pickerYear != null
    ? monthRange.filter(m => m.year === pickerYear)
    : monthRange;

  const openPicker = () => {
    setPickerLevel('months');
    setPickerYear(null);
    setShowPicker(true);
  };

  // ── Clear history ───────────────────────────────────────────────────────
  const handleClear = () => {
    if (confirm('Clear all history? This cannot be undone.')) clearHistory();
  };

  // ── Heatmap grid builder ────────────────────────────────────────────────
  const totalDays  = daysInMonth(viewYear, viewMonth);
  const startDow   = firstDayOfWeek(viewYear, viewMonth); // 0-6
  const heatCells  = Array.from({ length: startDow }, (_, i) => ({ day: 0, key: `pad-${i}` }))
    .concat(Array.from({ length: totalDays }, (_, i) => ({ day: i + 1, key: `d-${i + 1}` })));

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">

      {/* ── Page title + clear ── */}
      <header className="flex items-start justify-between mb-6">
        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight">History</h1>
        {monthEntries.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors mt-2 px-3 py-2 rounded-lg hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </header>

      {/* ── Month navigator ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goPrev}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={openPicker}
          className="flex items-center gap-1.5 font-semibold text-foreground text-base hover:text-primary transition-colors"
        >
          {MONTH_NAMES[viewMonth]} {viewYear}
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        <button
          onClick={goNext}
          disabled={isCurrentMonth}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
            isCurrentMonth
              ? 'text-muted-foreground/30 cursor-default'
              : 'hover:bg-muted text-muted-foreground',
          )}
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ── Filter chips ── */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => setFilters([])}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
            filters.length === 0
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-muted-foreground border-border hover:border-muted-foreground',
          )}
        >
          All
        </button>
        {STAGES.map(s => {
          const active = filters.includes(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleFilter(s.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                active
                  ? `${s.chip} border-transparent`
                  : 'bg-card text-muted-foreground border-border hover:border-muted-foreground',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── No history at all ── */}
      {monthEntries.length === 0 && (
        <div className="text-center py-20 px-4 bg-muted/20 rounded-3xl border border-dashed mt-8 flex flex-col items-center">
          <div className="bg-muted text-muted-foreground rounded-full p-5 mb-5">
            <HistoryIcon className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No activity</h2>
          <p className="text-muted-foreground text-sm max-w-[260px]">
            Nothing was completed in {MONTH_NAMES[viewMonth]} {viewYear}.
          </p>
        </div>
      )}

      {monthEntries.length > 0 && (
        <>
          {/* ── Month summary ── */}
          <div className="bg-card border rounded-2xl px-4 py-3.5 mb-5 shadow-sm">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-bold text-foreground leading-none">{monthEntries.length}</span>
              <span className="text-sm text-muted-foreground font-medium">
                {monthEntries.length === 1 ? 'Activity' : 'Activities'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
              {STAGES.map(s => {
                const count = summary[s.key] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-xs font-semibold text-foreground ml-auto">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Heatmap ── */}
          <div className="bg-card border rounded-2xl px-4 py-3.5 mb-6 shadow-sm">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {MONTH_NAMES[viewMonth]} Activity
            </p>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_ABBR.map(d => (
                <div key={d} className="text-center text-[9px] font-medium text-muted-foreground/60">
                  {d}
                </div>
              ))}
            </div>

            {/* Day squares */}
            <div className="grid grid-cols-7 gap-1">
              {heatCells.map(({ day, key }) => {
                if (day === 0) {
                  return <div key={key} className="aspect-square rounded-[4px]" />;
                }
                const count = heatmap[day] ?? 0;
                const hasRef = dayGroups.some(g => g.day === day);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (!hasRef) return;
                      const el = dayRefs.current.get(day);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    title={`${day} ${MONTH_NAMES[viewMonth]}: ${count} activit${count === 1 ? 'y' : 'ies'}`}
                    className={cn(
                      'aspect-square rounded-[4px] transition-opacity',
                      heatClass(count),
                      hasRef ? 'cursor-pointer hover:opacity-70' : 'cursor-default',
                    )}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Timeline ── */}
          {dayGroups.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No entries match the selected filter.
            </div>
          ) : (
            <div className="space-y-7">
              {dayGroups.map(({ day, label, subjects }) => (
                <div
                  key={day}
                  ref={el => { if (el) dayRefs.current.set(day, el); }}
                >
                  {/* Day heading */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-foreground whitespace-nowrap">{label}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {subjects.reduce((n, s) => n + s.entries.length, 0)} done
                    </span>
                  </div>

                  {/* Subject groups */}
                  <div className="space-y-3">
                    {subjects.map(({ name: subjectName, entries }) => (
                      <div key={subjectName} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                        {/* Subject label */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-semibold text-muted-foreground">{subjectName}</span>
                        </div>

                        {/* Entries */}
                        <div className="divide-y">
                          {entries.map(entry => {
                            const stage = stageByKey[entry.taskKey];
                            return (
                              <div
                                key={entry.id}
                                className="flex items-center gap-3 px-4 py-3"
                              >
                                {/* Stage badge */}
                                <span
                                  className={cn(
                                    'text-[10px] font-semibold px-2 py-1 rounded-full shrink-0',
                                    stage?.chip ?? 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {stage?.label ?? entry.taskLabel}
                                </span>

                                {/* System name */}
                                <span className="flex-1 text-sm font-medium text-foreground truncate">
                                  {entry.systemName}
                                </span>

                                {/* Time */}
                                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                  {new Date(entry.completedAt).toLocaleTimeString([], {
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           Month picker dialog
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl mx-4 w-[calc(100%-2rem)] max-h-[80dvh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {pickerLevel === 'years' ? 'Select Year' : 'Select Month'}
            </DialogTitle>
          </DialogHeader>

          {/* Year pills — always visible in month level */}
          {pickerLevel === 'months' && (
            <div className="flex gap-2 px-5 py-3 border-b shrink-0 overflow-x-auto">
              <button
                onClick={() => setPickerYear(null)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                  pickerYear === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                All
              </button>
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setPickerYear(y === pickerYear ? null : y)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                    pickerYear === y
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1">
            {pickerLevel === 'months'
              ? pickerMonths.map(({ year, month }) => {
                  const isSelected = year === viewYear && month === viewMonth;
                  return (
                    <button
                      key={`${year}-${month}`}
                      onClick={() => jumpTo(year, month)}
                      className={cn(
                        'w-full flex items-center justify-between px-5 py-3.5 text-sm transition-colors',
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-muted/50 text-foreground',
                      )}
                    >
                      <span>{MONTH_NAMES[month]}</span>
                      <span className={cn(
                        'text-xs',
                        isSelected ? 'text-primary' : 'text-muted-foreground',
                      )}>{year}</span>
                    </button>
                  );
                })
              : years.map(y => (
                  <button
                    key={y}
                    onClick={() => { setPickerYear(y); setPickerLevel('months'); }}
                    className={cn(
                      'w-full px-5 py-3.5 text-sm text-left transition-colors',
                      pickerYear === y
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted/50 text-foreground',
                    )}
                  >
                    {y}
                  </button>
                ))
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
