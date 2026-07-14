import { useState, useMemo } from 'react';
import { useSubjects, useAllSystems } from '@/db/hooks';
import { Link } from 'wouter';
import { Search as SearchIcon, BookOpen, LayoutList, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function Search() {
  const [query, setQuery] = useState('');
  const subjects = useSubjects();
  const systems = useAllSystems();

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { subjects: [], systems: [] };

    const matchedSubjects = subjects.filter(s => s.name.toLowerCase().includes(q));
    
    const matchedSystems = systems
      .filter(s => s.name.toLowerCase().includes(q))
      .map(sys => {
        const sub = subjects.find(s => s.id === sys.subjectId);
        return { ...sys, subjectName: sub?.name || 'Unknown' };
      });

    return { subjects: matchedSubjects, systems: matchedSystems };
  }, [query, subjects, systems]);

  return (
    <div className="min-h-[100dvh] bg-background px-4 pt-8 pb-24 max-w-3xl mx-auto flex flex-col">
      <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-4 -mx-4 px-4 mb-4">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects or systems..."
            className="w-full pl-12 py-6 text-lg rounded-2xl bg-card border-card-border shadow-sm focus-visible:ring-primary placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex-1">
        {!query.trim() ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground mt-20">
            <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>Type to find subjects and systems</p>
          </div>
        ) : results.subjects.length === 0 && results.systems.length === 0 ? (
          <div className="text-center mt-20 text-muted-foreground">
            <p>No results found for "{query}"</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Subjects Results */}
            {results.subjects.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Subjects
                </h3>
                <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y">
                  {results.subjects.map(sub => (
                    <Link key={sub.id} href={`/subjects/${sub.id}`}>
                      <div className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group">
                        <span className="font-semibold text-foreground">{sub.name}</span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Systems Results */}
            {results.systems.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <LayoutList className="w-4 h-4" /> Systems
                </h3>
                <div className="bg-card rounded-2xl border shadow-sm overflow-hidden divide-y">
                  {results.systems.map(sys => (
                    <Link key={sys.id} href={`/subjects/${sys.subjectId}`}>
                      <div className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between cursor-pointer group">
                        <div>
                          <div className="font-medium text-foreground mb-1">{sys.name}</div>
                          <div className="text-xs text-muted-foreground font-medium">{sys.subjectName}</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
