import Dexie, { Table } from 'dexie';

export interface Subject {
  id?: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SystemStatus = 'Strong' | 'Average' | 'Weak';

export interface StudySystem {
  id?: number;
  subjectId: number;
  name: string;
  contentDone: boolean;
  qbankDone: boolean;
  pyqsDone: boolean;
  revision1: boolean;
  revision2: boolean;
  revision3: boolean;
  weakAreas: string;
  status: SystemStatus;
  updatedAt: Date;
}

export interface HistoryEntry {
  id?: number;
  subjectId: number;
  subjectName: string;
  systemId: number;
  systemName: string;
  taskKey: string;
  taskLabel: string;
  completedAt: Date;
}

export class AtlasDB extends Dexie {
  subjects!: Table<Subject, number>;
  systems!: Table<StudySystem, number>;
  history!: Table<HistoryEntry, number>;

  constructor() {
    super('AtlasDB');
    this.version(1).stores({
      subjects: '++id, name',
      systems: '++id, subjectId, name, updatedAt'
    });
    this.version(2).stores({
      subjects: '++id, name',
      systems: '++id, subjectId, name, updatedAt',
      history: '++id, subjectId, systemId, completedAt'
    });
  }
}

export const db = new AtlasDB();

// DB Helpers for imports/exports
export async function exportData() {
  const subjects = await db.subjects.toArray();
  const systems = await db.systems.toArray();
  const history = await db.history.toArray();
  return { subjects, systems, history };
}

export async function importData(data: { subjects: Subject[], systems: StudySystem[], history?: HistoryEntry[] }) {
  await db.transaction('rw', db.subjects, db.systems, db.history, async () => {
    await db.subjects.clear();
    await db.systems.clear();
    await db.history.clear();
    if (data.subjects?.length) {
      const parsedSubjects = data.subjects.map(s => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt)
      }));
      await db.subjects.bulkAdd(parsedSubjects);
    }
    if (data.systems?.length) {
      const parsedSystems = data.systems.map(s => ({
        ...s,
        updatedAt: new Date(s.updatedAt)
      }));
      await db.systems.bulkAdd(parsedSystems);
    }
    if (data.history?.length) {
      const parsedHistory = data.history.map(h => ({
        ...h,
        completedAt: new Date(h.completedAt)
      }));
      await db.history.bulkAdd(parsedHistory);
    }
  });
}
