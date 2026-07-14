import { useState } from 'react';
import { StudySystem } from '@/db/database';
import { updateSystem, deleteSystem, logCompletion } from '@/db/hooks';
import { ProgressBar } from './ProgressBar';
import { ChevronDown, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

interface SystemCardProps {
  system: StudySystem;
  subjectName: string;
}

export function SystemCard({ system, subjectName }: SystemCardProps) {
  const [expanded, setExpanded] = useState(false);

  const tasks = [
    { key: 'contentDone' as const, label: 'Content' },
    { key: 'qbankDone' as const, label: 'Qbank' },
    { key: 'pyqsDone' as const, label: 'PYQs' },
    { key: 'revision1' as const, label: 'Revision 1' },
    { key: 'revision2' as const, label: 'Revision 2' },
    { key: 'revision3' as const, label: 'Revision 3' }
  ];

  const completedCount = tasks.filter(t => system[t.key]).length;
  const progress = (completedCount / 6) * 100;

  const toggleTask = (key: keyof StudySystem, label: string) => {
    const wasChecked = Boolean(system[key]);
    updateSystem(system.id!, { [key]: !wasChecked });

    // Only log when marking complete (false → true)
    if (!wasChecked) {
      logCompletion({
        subjectId: system.subjectId,
        subjectName,
        systemId: system.id!,
        systemName: system.name,
        taskKey: key,
        taskLabel: label,
        completedAt: new Date()
      });
    }
  };

  const handleStatusChange = (status: 'Strong' | 'Average' | 'Weak') => {
    updateSystem(system.id!, { status });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSystem(system.id!, { weakAreas: e.target.value });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this system?')) {
      deleteSystem(system.id!);
    }
  };

  const statusColors = {
    Strong: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50',
    Average: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
    Weak: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50'
  };

  return (
    <div className="bg-card rounded-2xl border border-card-border shadow-sm overflow-hidden transition-all duration-300">
      {/* Header (Always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors focus:outline-none"
      >
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-[23px] leading-tight text-foreground">{system.name}</h4>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border", statusColors[system.status])}>
              {system.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ProgressBar progress={progress} className="flex-1 h-1.5" />
            <span className="text-xs font-medium text-muted-foreground min-w-[3ch]">{completedCount}/6</span>
          </div>
        </div>
        <div className={cn("p-2 rounded-full bg-secondary/50 text-secondary-foreground transition-transform duration-300", expanded && "rotate-180")}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-0 border-t border-border/50 bg-card">

            {/* Checkboxes */}
            <div className="grid gap-2 py-4">
              {tasks.map(task => {
                const isChecked = Boolean(system[task.key]);
                return (
                  <button
                    key={task.key}
                    onClick={() => toggleTask(task.key, task.label)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 border-2",
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground shadow-sm scale-100"
                        : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
                    )}>
                      {isChecked && <Check className="w-4 h-4" />}
                    </div>
                    <span className={cn(
                      "text-sm font-medium transition-colors duration-200",
                      isChecked ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                      {task.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 pt-2">
              {/* Status Selector */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Confidence Level</label>
                <div className="flex gap-2">
                  {(['Strong', 'Average', 'Weak'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={cn(
                        "flex-1 py-2 px-3 text-sm font-medium rounded-xl border transition-all",
                        system.status === s
                          ? statusColors[s] + " ring-2 ring-offset-2 ring-background ring-offset-transparent shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weak Areas Notes */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Weak Areas / Notes</label>
                <Textarea
                  value={system.weakAreas}
                  onChange={handleNotesChange}
                  placeholder="Note down concepts you struggle with..."
                  className="min-h-[100px] resize-none rounded-xl bg-muted/30 border-transparent focus-visible:bg-background focus-visible:border-primary"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-4 mt-2 border-t border-border/50">
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 font-medium px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete System
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
