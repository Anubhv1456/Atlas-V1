import { useRef, useState, useMemo } from 'react';
import { useSubjects, useAllSystems, addSubject } from '@/db/hooks';
import { SubjectCard } from '@/components/SubjectCard';
import { AddDialog } from '@/components/AddDialog';
import { Plus, BookOpen, Layers, Search as SearchIcon, X, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { runSearch } from '@/lib/searchUtils';
import { isRevisionDue, isRevisionOverdue } from '@/db/revisionEngine';
import { format } from 'date-fns';
import { StudySystem } from '@/db/database';

// ── Inline result sub-components ──────────────────────────────────────────────

function StatusBadge({ sys }: { sys: StudySystem }) {
  const colors = {
    Strong:  'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400',
    Average: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400',
    Weak:    'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400',
  };
  return (
    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0', colors[sys.status])}>
      {sys.status}
    </span>
  );
}

function RevisionPill({ sys }: { sys: StudySystem }) {
  if (!sys.completionDate) return null;
  if (isRevisionOverdue(sys)) return (
    <span className="flex items-center gap-0.5 text-[10px] text-destructive font-semibold shrink-0">
      <AlertCircle className="w-2.5 h-2.5" />Overdue
    </span>
  );
  if (isRevisionDue(sys)) return (
    <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-500 font-semibold shrink-0">
      <Clock className="w-2.5 h-2.5" />Due today
    </span>
  );
  if (sys.nextRevisionDate) return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
      <Clock className="w-2.5 h-2.5" />{format(new Date(sys.nextRevisionDate), 'MMM d')}
    </span>
  );
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const subjects = useSubjects();
  const systems  = useAllSystems();
  const [, setLocation] = useLocation();
  const [showAddSubject, setShowAddSubject] = useState(false);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]           = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const openSearch = () => {
    setSearchOpen(true);
    // tiny delay so the input is mounted before we focus
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  // Live search results
  const results = useMemo(
    () => runSearch(query, subjects, systems),
    [query, subjects, systems],
  );

  const hasQuery   = query.trim().length > 0;
  const noResults  = hasQuery && results.subjects.length === 0 && results.systems.length === 0;

  // Overall stats
  const totalTasks = systems.length * 2;
  const completedTasks = systems.reduce((acc, sys) => {
    let done = 0;
    if (sys.contentCompleted) done++;
    if (sys.qbankDone) done++;
    return acc + done;
  }, 0);
  const overallProgress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const pendingTasks    = totalTasks - completedTasks;

  // Navigate to a system (open its parent subject with highlight)
  const goToSystem = (subjectId: number, systemId: number) => {
    closeSearch();
    setLocation(`/subjects/${subjectId}?highlight=${systemId}`);
  };

  const goToSubject = (subjectId: number) => {
    closeSearch();
    setLocation(`/subjects/${subjectId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {/* Title — hidden when search open */}
          <div className={cn(
            'flex-1 overflow-hidden transition-all duration-200',
            searchOpen ? 'max-w-0 opacity-0' : 'max-w-full opacity-100',
          )}>
            <h1 className="text-[44px] leading-tight font-bold text-foreground tracking-tight whitespace-nowrap">
              Atlas
            </h1>
          </div>

          {/* Search input — shown when open */}
          <div className={cn(
            'overflow-hidden transition-all duration-200',
            searchOpen ? 'flex-1 opacity-100' : 'w-0 opacity-0 pointer-events-none',
          )}>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') closeSearch(); }}
                placeholder="medicine, weak, overdue…"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-muted/60 border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
              />
            </div>
          </div>

          {/* Icon toggle */}
          <button
            onClick={searchOpen ? closeSearch : openSearch}
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
            aria-label={searchOpen ? 'Close search' : 'Open search'}
          >
            {searchOpen
              ? <X className="w-5 h-5" />
              : <SearchIcon className="w-5 h-5 text-gold" />
            }
          </button>
        </div>

        {/* Subtitle — hidden when search open */}
        <div className={cn(
          'transition-all duration-200 overflow-hidden',
          searchOpen ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100',
        )}>
          <p className="text-base text-muted-foreground">Welcome back. Stay focused, stay consistent.</p>
        </div>
      </header>

      {/* ── Search results ─────────────────────────────────────────────────── */}
      {searchOpen ? (
        <div className="space-y-6">
          {!hasQuery && (
            <div className="text-center py-16 text-muted-foreground">
              <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Start typing to search subjects and systems</p>
              <p className="text-xs mt-1 opacity-60">Try: weak, overdue, strong medicine…</p>
            </div>
          )}

          {noResults && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="font-medium">No matching results found.</p>
            </div>
          )}

          {/* Subject results */}
          {results.subjects.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" /> Subjects
              </h3>
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y divide-border">
                {results.subjects.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => goToSubject(sub.id!)}
                    className="w-full p-4 hover:bg-muted/50 transition-colors flex items-center justify-between text-left group"
                  >
                    <span className="font-semibold text-foreground">{sub.name}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* System results */}
          {results.systems.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Systems
                <span className="ml-auto text-xs font-normal normal-case tracking-normal">{results.systems.length}</span>
              </h3>
              <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y divide-border">
                {results.systems.map(sys => (
                  <button
                    key={sys.id}
                    onClick={() => goToSystem(sys.subjectId, sys.id!)}
                    className="w-full p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{sys.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sys.subjectName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge sys={sys} />
                      <RevisionPill sys={sys} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <>
          {/* ── Stats ────────────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-3 mb-10">
            <div className="col-span-2 bg-primary/10 rounded-2xl p-5 border border-primary/20">
              <div className="flex justify-between items-end mb-2">
                <h2 className="font-semibold text-primary/80">Overall Progress</h2>
                <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
              </div>
              <ProgressBar progress={overallProgress} className="h-3 bg-primary/20" />
              <p className="text-xs text-primary/70 mt-3 font-medium">{completedTasks} of {totalTasks} tasks completed</p>
            </div>

            <div className="bg-card rounded-2xl p-4 border shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Subjects</span>
              </div>
              <span className="text-3xl font-bold text-foreground">{subjects.length}</span>
            </div>

            <div className="bg-card rounded-2xl p-4 border shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <Layers className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
              </div>
              <span className="text-3xl font-bold text-foreground">{pendingTasks}</span>
            </div>
          </section>

          {/* ── Subjects list ─────────────────────────────────────────────── */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-xl font-bold text-foreground tracking-tight">Your Subjects</h2>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-16 px-4 bg-muted/30 rounded-3xl border border-dashed">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Ready to begin?</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-[250px] mx-auto">
                  Create your first subject to start organizing your study material.
                </p>
                <button
                  onClick={() => setShowAddSubject(true)}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Add Subject
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {subjects.map(subject => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    systems={systems.filter(s => s.subjectId === subject.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {subjects.length > 0 && (
            <button
              onClick={() => setShowAddSubject(true)}
              className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
              aria-label="Add Subject"
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
        </>
      )}

      <AddDialog
        open={showAddSubject}
        onOpenChange={setShowAddSubject}
        title="New Subject"
        placeholder="e.g. Internal Medicine"
        onSave={addSubject}
      />
    </div>
  );
}
