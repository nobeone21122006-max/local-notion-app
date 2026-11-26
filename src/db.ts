import Dexie, { type EntityTable } from 'dexie';

export interface Page {
  id?: number;
  title: string;
  content: any[];
  parentId: number | null;
  isPinned: boolean;
  tags: string[];
  updatedAt: number;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CalendarEvent {
  id?: number;
  date: string;
  title: string;
  tags: string[];
  note?: string;
  todos?: TodoItem[];
}

export type MoodType = 'focused' | 'great' | 'neutral' | 'tired';

export interface JournalEntry {
  id?: number;
  date: string;
  mood: MoodType;
  sleepHours: number;
  highlights: string;
  content: string;
  updatedAt: number;
}

export interface Habit {
  id?: number;
  name: string;
  category: string;
  completedDates: string[];
  createdAt: number;
}

export interface GoalMilestone {
  id: string;
  text: string;
  done: boolean;
}

export interface Goal {
  id?: number;
  title: string;
  category: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  milestones: GoalMilestone[];
  updatedAt: number;
}

export interface QuickNote {
  id?: number;
  text: string;
  createdAt: number;
}

// --- HỒ SƠ CÁ NHÂN: MÔN HỌC, THÀNH TÍCH, KÉT SẮT ---
export interface Course {
  id?: number;
  semester: string; // vd: HK1 2026-2027
  name: string;
  credits: number;
  score10: number | null; // null nếu đang học chưa có điểm tổng kết
  status: 'studying' | 'completed';
  // Các đầu điểm thành phần phục vụ chế độ giả lập điểm cuối kỳ
  regularScore?: number; // Điểm thường xuyên
  regularWeight?: number; // % trọng số (mặc định 10)
  projectScore?: number; // Điểm bài tập lớn
  projectWeight?: number; // % trọng số (mặc định 20)
  midtermScore?: number; // Điểm giữa kỳ
  midtermWeight?: number; // % trọng số (mặc định 20)
  targetGpa?: number; // GPA mục tiêu môn đó (vd: 3.7, 4.0)
}

export type AchievementType = 'award' | 'activity' | 'project';

export interface Achievement {
  id?: number;
  type: AchievementType;
  title: string;
  time: string;
  organization: string;
  description: string;
  link?: string;
  createdAt: number;
}

export interface VaultConfig {
  id: string; // 'main'
  salt: string;
  checkIv: string;
  checkCiphertext: string;
}

export interface EncryptedVaultItem {
  id?: number;
  iv: string;
  ciphertext: string;
  updatedAt: number;
}

export const MOOD_META: Record<MoodType, { emoji: string; label: string }> = {
  focused: { emoji: '🔥', label: 'Tập trung' },
  great: { emoji: '😄', label: 'Tốt' },
  neutral: { emoji: '😐', label: 'Bình thường' },
  tired: { emoji: '😴', label: 'Mệt mỏi' },
};

export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const db = new Dexie('LocalNotionDB') as Dexie & {
  pages: EntityTable<Page, 'id'>;
  events: EntityTable<CalendarEvent, 'id'>;
  journals: EntityTable<JournalEntry, 'id'>;
  habits: EntityTable<Habit, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  quickNotes: EntityTable<QuickNote, 'id'>;
  courses: EntityTable<Course, 'id'>;
  achievements: EntityTable<Achievement, 'id'>;
  vaultConfig: EntityTable<VaultConfig, 'id'>;
  vaultItems: EntityTable<EncryptedVaultItem, 'id'>;
};

db.version(1).stores({
  pages: '++id, title, updatedAt',
});

db.version(2)
  .stores({
    pages: '++id, title, parentId, isPinned, *tags, updatedAt',
  })
  .upgrade((tx) => {
    return tx
      .table('pages')
      .toCollection()
      .modify((page) => {
        if (page.parentId === undefined) page.parentId = null;
        if (page.isPinned === undefined) page.isPinned = false;
        if (!Array.isArray(page.tags)) page.tags = [];
      });
  });

db.version(3).stores({
  pages: '++id, title, parentId, isPinned, *tags, updatedAt',
  events: '++id, date, title',
});

db.version(4)
  .stores({
    pages: '++id, title, parentId, isPinned, *tags, updatedAt',
    events: '++id, date, title, *tags',
  })
  .upgrade((tx) => {
    return tx
      .table('events')
      .toCollection()
      .modify((ev) => {
        if (!Array.isArray(ev.tags)) ev.tags = [];
        if (ev.note === undefined) ev.note = '';
      });
  });

db.version(5)
  .stores({
    pages: '++id, title, parentId, isPinned, *tags, updatedAt',
    events: '++id, date, title, *tags',
  })
  .upgrade((tx) => {
    return tx
      .table('events')
      .toCollection()
      .modify((ev) => {
        if (!Array.isArray(ev.todos)) ev.todos = [];
      });
  });

db.version(6).stores({
  pages: '++id, title, parentId, isPinned, *tags, updatedAt',
  events: '++id, date, title, *tags',
  journals: '++id, &date, mood, updatedAt',
  habits: '++id, name, category',
  goals: '++id, title, category, updatedAt',
  quickNotes: '++id, createdAt',
});

db.version(7).stores({
  pages: '++id, title, parentId, isPinned, *tags, updatedAt',
  events: '++id, date, title, *tags',
  journals: '++id, &date, mood, updatedAt',
  habits: '++id, name, category',
  goals: '++id, title, category, updatedAt',
  quickNotes: '++id, createdAt',
  courses: '++id, semester, name, status',
  achievements: '++id, type, title, createdAt',
  vaultConfig: 'id',
  vaultItems: '++id, updatedAt',
});

export { db };

export function extractTextFromBlocks(blocks: any[]): string {
  if (!Array.isArray(blocks)) return '';
  let text = '';
  for (const block of blocks) {
    if (Array.isArray(block.content)) {
      for (const item of block.content) {
        if (typeof item?.text === 'string') {
          text += item.text + ' ';
        }
      }
    }
    if (block.props?.formula) {
      text += block.props.formula + ' ';
    }
    if (Array.isArray(block.children) && block.children.length > 0) {
      text += extractTextFromBlocks(block.children) + ' ';
    }
  }
  return text;
}

const LAST_BACKUP_KEY = 'local_notion_last_backup';

export function getDaysSinceLastBackup(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  const diffMs = Date.now() - Number(raw);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function markBackupDone() {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
}

async function buildFullBackupPayload() {
  const [
    pages,
    events,
    journals,
    habits,
    goals,
    quickNotes,
    courses,
    achievements,
    vaultConfig,
    vaultItems,
  ] = await Promise.all([
    db.pages.toArray(),
    db.events.toArray(),
    db.journals.toArray(),
    db.habits.toArray(),
    db.goals.toArray(),
    db.quickNotes.toArray(),
    db.courses.toArray(),
    db.achievements.toArray(),
    db.vaultConfig.toArray(),
    db.vaultItems.toArray(),
  ]);
  return {
    pages,
    events,
    journals,
    habits,
    goals,
    quickNotes,
    courses,
    achievements,
    vaultConfig,
    vaultItems,
  };
}

export async function exportDatabase() {
  const payload = await buildFullBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `local-notion-backup-${getTodayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  markBackupDone();
}

export async function syncToLocalFolder(): Promise<string> {
  const picker = (window as any).showDirectoryPicker;
  if (typeof picker !== 'function') {
    await exportDatabase();
    return 'Trình duyệt hiện tại chưa hỗ trợ ghi trực tiếp thư mục, đã tự động tải file Backup JSON về máy.';
  }

  const dirHandle = await picker({ mode: 'readwrite' });
  const payload = await buildFullBackupPayload();

  const jsonHandle = await dirHandle.getFileHandle('local-notion-backup.json', {
    create: true,
  });
  const jsonWritable = await jsonHandle.createWritable();
  await jsonWritable.write(JSON.stringify(payload, null, 2));
  await jsonWritable.close();

  if (payload.journals.length > 0) {
    const journalDir = await dirHandle.getDirectoryHandle('journals', {
      create: true,
    });
    for (const j of payload.journals) {
      const mdHandle = await journalDir.getFileHandle(`${j.date}.md`, {
        create: true,
      });
      const mdWritable = await mdHandle.createWritable();
      const moodInfo = MOOD_META[j.mood] || MOOD_META.neutral;
      const mdText = [
        `# Nhật ký ngày ${j.date}`,
        `- **Tâm trạng:** ${moodInfo.emoji} ${moodInfo.label}`,
        `- **Giấc ngủ:** ${j.sleepHours} giờ`,
        '',
        '## Điểm sáng trong ngày',
        j.highlights || '_(Chưa ghi)_',
        '',
        '## Nhật ký tự do',
        j.content || '_(Chưa ghi)_',
        '',
      ].join('\n');
      await mdWritable.write(mdText);
      await mdWritable.close();
    }
  }

  markBackupDone();
  return `Đã đồng bộ thành công backup.json và ${payload.journals.length} file nhật ký (.md) vào thư mục đã chọn!`;
}

export async function importDatabase(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  const pages: Page[] = Array.isArray(parsed) ? parsed : parsed.pages || [];
  const events: CalendarEvent[] = Array.isArray(parsed?.events) ? parsed.events : [];
  const journals: JournalEntry[] = Array.isArray(parsed?.journals) ? parsed.journals : [];
  const habits: Habit[] = Array.isArray(parsed?.habits) ? parsed.habits : [];
  const goals: Goal[] = Array.isArray(parsed?.goals) ? parsed.goals : [];
  const quickNotes: QuickNote[] = Array.isArray(parsed?.quickNotes) ? parsed.quickNotes : [];
  const courses: Course[] = Array.isArray(parsed?.courses) ? parsed.courses : [];
  const achievements: Achievement[] = Array.isArray(parsed?.achievements) ? parsed.achievements : [];
  const vaultConfig: VaultConfig[] = Array.isArray(parsed?.vaultConfig) ? parsed.vaultConfig : [];
  const vaultItems: EncryptedVaultItem[] = Array.isArray(parsed?.vaultItems) ? parsed.vaultItems : [];

  await db.transaction(
    'rw',
    [
      db.pages,
      db.events,
      db.journals,
      db.habits,
      db.goals,
      db.quickNotes,
      db.courses,
      db.achievements,
      db.vaultConfig,
      db.vaultItems,
    ],
    async () => {
      for (const page of pages) {
        const { id, ...rest } = page;
        await db.pages.add({
          title: rest.title || 'Không tiêu đề',
          content: Array.isArray(rest.content) ? rest.content : [],
          parentId: rest.parentId ?? null,
          isPinned: Boolean(rest.isPinned),
          tags: Array.isArray(rest.tags) ? rest.tags : [],
          updatedAt: rest.updatedAt || Date.now(),
        });
      }
      for (const ev of events) {
        const { id, ...rest } = ev;
        if (rest.date && rest.title) {
          await db.events.add({
            date: rest.date,
            title: rest.title,
            tags: Array.isArray(rest.tags) ? rest.tags : [],
            note: rest.note || '',
            todos: Array.isArray(rest.todos) ? rest.todos : [],
          });
        }
      }
      for (const j of journals) {
        const { id, ...rest } = j;
        if (rest.date) {
          const exists = await db.journals.where('date').equals(rest.date).first();
          if (!exists) {
            await db.journals.add({
              date: rest.date,
              mood: rest.mood || 'neutral',
              sleepHours: rest.sleepHours ?? 7,
              highlights: rest.highlights || '',
              content: rest.content || '',
              updatedAt: rest.updatedAt || Date.now(),
            });
          }
        }
      }
      for (const h of habits) {
        const { id, ...rest } = h;
        if (rest.name) {
          await db.habits.add({
            name: rest.name,
            category: rest.category || 'Chung',
            completedDates: Array.isArray(rest.completedDates) ? rest.completedDates : [],
            createdAt: rest.createdAt || Date.now(),
          });
        }
      }
      for (const g of goals) {
        const { id, ...rest } = g;
        if (rest.title) {
          await db.goals.add({
            title: rest.title,
            category: rest.category || 'Cá nhân',
            currentValue: rest.currentValue ?? 0,
            targetValue: rest.targetValue ?? 100,
            unit: rest.unit || '',
            milestones: Array.isArray(rest.milestones) ? rest.milestones : [],
            updatedAt: rest.updatedAt || Date.now(),
          });
        }
      }
      for (const qn of quickNotes) {
        const { id, ...rest } = qn;
        if (rest.text) {
          await db.quickNotes.add({
            text: rest.text,
            createdAt: rest.createdAt || Date.now(),
          });
        }
      }
      for (const c of courses) {
        const { id, ...rest } = c;
        if (rest.name) await db.courses.add(rest);
      }
      for (const a of achievements) {
        const { id, ...rest } = a;
        if (rest.title) await db.achievements.add(rest);
      }
      if (vaultConfig.length > 0) {
        const existingCfg = await db.vaultConfig.get('main');
        if (!existingCfg) {
          await db.vaultConfig.put(vaultConfig[0]);
          for (const vi of vaultItems) {
            const { id, ...rest } = vi;
            await db.vaultItems.add(rest);
          }
        }
      }
    }
  );
}