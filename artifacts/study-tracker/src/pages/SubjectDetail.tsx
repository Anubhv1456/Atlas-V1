import { useState } from 'react';
import { useParams, Link, useLocation, useSearch } from 'wouter';
import {
  useSubject, useSystemsBySubject, usePYQsBySubject,
  addSystem, updateSubject, deleteSubject,
  addPYQYear, updatePYQYear, deletePYQYear, togglePYQYear,
} from '@/db/hooks';
import { SystemCard } from '@/components/SystemCard';
import { AddDialog } from '@/components/AddDialog';
import { ProgressBar } from '@/components/ProgressBar';
import { StageDonut } from '@/components/StageDonut';
import { PYQYear } from '@/db/database';
import {
  ChevronLeft, ChevronDown, ChevronRight, Plus, Trash2, Edit2,
  LayoutList, Lock, Check, BookOpen,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StudySystem } from '@/db/database';
import { cn } from '@/lib/utils';

type StageKey = 'contentCompleted' | 'qbankDone';

const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: 'contentCompleted', label: 'Content', color: '#3b82f6' },
  { key: 'qbankDone',        label: 'QBank',   color: '#10b981' },
];

// ── PYQ section component ──────────────────────────────────────────────────────

interface PYQSectionProps {
  subjectId:   number;
  subjectName: string;
  years:       PYQYear[];
}

function PYQSection({ subjectId, subjectName, years }: PYQSectionProps) {
  const [expanded,    setExpanded]    = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [addValue,    setAddValue]    = useState('');
  const [editTarget,  setEditTarget]  = useState<PYQYear | null>(null);
  const [editValue,   setEditValue]   = useState('');

  const completed = years.filter(y => y.completed).length;
  const total     = years.length;

  const handleAdd = async () => {
    const v = addValue.trim();
    if (!v) return;
    await addPYQYear(subjectId, v);
    setAddValue(''); setShowAdd(false);
  };

  const handleEditSave = async () => {
    if (!editTarget || !editValue.trim()) return;
    await updatePYQYear(editTarget.id!, editValue.trim());
    setEditTarget(null); setEditValue('');
  };

  const handleDelete = async (year: PYQYear) => {
    if (confirm(`Delete "${year.year}"? This cannot be undone.`)) {
      await deletePYQYear(year.id!);
    }
  };

  const handleToggle = (year: PYQYear) => {
    togglePYQYear(year.id!, subjectId, subjectName, year.year, year.completed);
  };

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-muted/30 transition-colors focus:outline-none"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="font-semibold text-foreground text-sm">PYQs</p>
          </div>
          <p className={cn(
            'text-xs mt-0.5',
            total === 0
              ? 'text-muted-foreground'
              : completed === total
                ? 'text-green-600 dark:text-green-400 font-medium'
                : 'text-muted-foreground',
          )}>
            {total === 0
              ? 'No years added yet'
              : completed === total
                ? `${total} / ${total} Years Completed`
                : `${completed} / ${total} Years Completed`}
          </p>
        </div>
      </button>

      {/* Expanded body */}
      <div className={cn(
        'grid transition-all duration-300 ease-in-out',
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-2">
            {years.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                No years added yet. Add one to get started.
              </p>
            ) : (
              years.map(year => (
                <div key={year.id} className="flex items-center gap-3 py-1.5">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(year)}
                    className={cn(
                      'shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150',
                      year.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-muted-foreground/30 hover:border-primary',
                    )}
                  >
                    {year.completed && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Year label */}
                  <span className={cn(
                    'flex-1 text-sm font-medium',
                    year.completed ? 'line-through text-muted-foreground' : 'text-foreground',
                  )}>
                    {year.year}
                  </span>

                  {/* Edit */}
                  <button
                    onClick={() => { setEditTarget(year); setEditValue(year.year); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(year)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            {/* Add year inline */}
            {showAdd ? (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  autoFocus
                  value={addValue}
                  onChange={e => setAddValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowAdd(false); setAddValue(''); } }}
                  placeholder="e.g. 2024"
                  className="flex-1 h-9 text-sm bg-muted/50 border-transparent focus-visible:ring-primary"
                />
                <Button size="sm" onClick={handleAdd} disabled={!addValue.trim()} className="rounded-xl h-9 px-4">Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddValue(''); }} className="rounded-xl h-9">Cancel</Button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full mt-1 flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors py-1"
              >
                <Plus className="w-4 h-4" />Add Year
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit year dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[320px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Edit Year</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input
              autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); }}
              className="text-lg py-6 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleEditSave} disabled={!editValue.trim()} className="rounded-xl font-semibold px-8">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SubjectDetail() {
  const { id }  = useParams<{ id: string }>();
  const search  = useSearch();
  const subjectId = parseInt(id || '0', 10);
  const [, setLocation] = useLocation();

  const subject  = useSubject(subjectId);
  const systems  = useSystemsBySubject(subjectId);
  const pyqYears = usePYQsBySubject(subjectId);

  const [showAddSystem, setShowAddSystem] = useState(false);
  const [showEdit,      setShowEdit]      = useState(false);
  const [editName,      setEditName]      = useState('');
  const [activeFilter,  setActiveFilter]  = useState<StageKey | null>(null);

  // Read highlight param — passed from search results
  const highlightId = (() => {
    const params = new URLSearchParams(search);
    const v = params.get('highlight');
    return v ? parseInt(v, 10) : null;
  })();

  if (!subject && id) {
    return <div className="p-8 text-center text-muted-foreground mt-20">Loading or subject not found.</div>;
  }
  if (!subject) return null;

  // Overall progress (2 steps per system)
  const totalTasks     = systems.length * 2;
  const completedTasks = systems.reduce((acc, sys) => {
    let done = 0;
    if (sys.contentCompleted) done++;
    if (sys.qbankDone) done++;
    return acc + done;
  }, 0);
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // PYQ unlock: every system must have content + qbank complete
  const pyqUnlocked = systems.length > 0 && systems.every(s => s.contentCompleted && s.qbankDone);

  const stagePct = (key: StageKey) => {
    if (systems.length === 0) return 0;
    return Math.round((systems.filter(s => s[key]).length / systems.length) * 100);
  };

  const visibleSystems: StudySystem[] = activeFilter
    ? systems.filter(s => !s[activeFilter])
    : systems;

  const handleDonutClick = (key: StageKey) => {
    setActiveFilter(prev => (prev === key ? null : key));
  };

  const handleSaveEdit = async () => {
    if (editName.trim()) {
      await updateSubject(subject.id!, editName.trim());
      setShowEdit(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this subject and all its systems? This cannot be undone.')) {
      await deleteSubject(subject.id!);
      setLocation('/');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-6 pb-24 max-w-3xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/">
            <button className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors focus:outline-none">
              <div className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onClick={() => { setEditName(subject.name); setShowEdit(true); }} className="gap-2 py-3 cursor-pointer">
                <Edit2 className="w-4 h-4" /> Rename Subject
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive gap-2 py-3 cursor-pointer">
                <Trash2 className="w-4 h-4" /> Delete Subject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h1 className="text-[35px] leading-tight font-bold text-foreground tracking-tight mb-4">{subject.name}</h1>

        {/* Overall progress card */}
        <div className="bg-card border shadow-sm p-4 rounded-2xl flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2 text-sm">
              <span className="font-semibold text-foreground">Progress</span>
              <span className="font-bold text-primary">{progress}%</span>
            </div>
            <ProgressBar progress={progress} className="h-2.5" />
          </div>
          <div className="h-10 w-px bg-border mx-2" />
          <div className="text-center min-w-[3rem]">
            <div className="text-xl font-bold text-foreground leading-none mb-1">{systems.length}</div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Systems</div>
          </div>
        </div>

        {/* Stage donuts */}
        {systems.length > 0 && (
          <div className="mt-3 bg-card border rounded-2xl px-3 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Learning Progress
            </p>
            <div className="grid grid-cols-2 gap-y-1">
              {STAGES.map(({ key, label, color }) => (
                <StageDonut
                  key={key}
                  label={label}
                  pct={stagePct(key)}
                  color={color}
                  active={activeFilter === key}
                  onClick={() => handleDonutClick(key)}
                />
              ))}
            </div>
            {activeFilter && (
              <p className="text-[11px] text-muted-foreground text-center mt-2 pb-0.5">
                Showing{' '}
                <span className="font-semibold text-foreground">{visibleSystems.length}</span>
                {' '}system{visibleSystems.length !== 1 ? 's' : ''} without{' '}
                <span className="font-medium" style={{ color: STAGES.find(s => s.key === activeFilter)!.color }}>
                  {STAGES.find(s => s.key === activeFilter)!.label}
                </span>
                {' '}— tap again to clear
              </p>
            )}
          </div>
        )}
      </header>

      {/* Systems list */}
      <section>
        {systems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-dashed mt-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No systems yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-[250px] mx-auto">
              Break down {subject.name} into smaller, manageable systems or topics.
            </p>
            <button
              onClick={() => setShowAddSystem(true)}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors"
            >
              Add First System
            </button>
          </div>
        ) : visibleSystems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-muted/30 rounded-3xl border border-dashed">
            <p className="text-foreground font-semibold mb-1">All systems complete</p>
            <p className="text-sm text-muted-foreground">
              Every system has{' '}
              <span className="font-medium" style={{ color: STAGES.find(s => s.key === activeFilter)!.color }}>
                {STAGES.find(s => s.key === activeFilter)!.label}
              </span>{' '}
              done.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleSystems.map(system => (
              <SystemCard
                key={system.id}
                system={system}
                subjectName={subject.name}
                highlighted={system.id === highlightId}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── PYQ Section ─────────────────────────────────────────────────────── */}
      <section className="mt-6">
        {systems.length > 0 && (
          pyqUnlocked ? (
            <PYQSection
              subjectId={subject.id!}
              subjectName={subject.name}
              years={pyqYears}
            />
          ) : (
            <div className="bg-muted/20 rounded-2xl border border-dashed p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-muted-foreground/60" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">PYQs</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete Content and QBank for all systems to unlock PYQs
                </p>
              </div>
            </div>
          )
        )}
      </section>

      {/* FAB */}
      {systems.length > 0 && (
        <button
          onClick={() => setShowAddSystem(true)}
          className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
          aria-label="Add System"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <AddDialog
        open={showAddSystem}
        onOpenChange={setShowAddSystem}
        title="New System"
        placeholder="e.g. Cardiology"
        onSave={(name) => addSystem(subject.id!, name)}
      />

      {/* Rename dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl mx-4 w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Rename Subject</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              autoFocus value={editName} onChange={e => setEditName(e.target.value)}
              className="text-lg py-6 px-4 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEdit(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim() || editName === subject.name}
              className="rounded-xl font-semibold px-8 shadow-sm"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
