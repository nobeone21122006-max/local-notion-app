import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sun,
  BookHeart,
  CheckSquare,
  Flame,
  StickyNote,
  Plus,
  X,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  db,
  getTodayKey,
  MOOD_META,
  type CalendarEvent,
  type Habit,
} from '../db';
import { calculateStreak } from './PlannerView';

interface DashboardProps {
  onNavigate: (view: 'journal' | 'planner' | 'calendar') => void;
}

export function DashboardView({ onNavigate }: DashboardProps) {
  const todayKey = getTodayKey();
  const [quickText, setQuickText] = useState('');

  const todayJournal = useLiveQuery(
    () => db.journals.where('date').equals(todayKey).first(),
    [todayKey]
  );
  const todayEvents =
    useLiveQuery(
      () => db.events.where('date').equals(todayKey).toArray(),
      [todayKey]
    ) ?? [];
  const habits = useLiveQuery(() => db.habits.toArray()) ?? [];
  const quickNotes =
    useLiveQuery(() =>
      db.quickNotes.orderBy('createdAt').reverse().toArray()
    ) ?? [];

  const formattedDate = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const toggleEventTodo = async (ev: CalendarEvent, todoId: string) => {
    if (!ev.id || !ev.todos) return;
    await db.events.update(ev.id, {
      todos: ev.todos.map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t
      ),
    });
  };

  const toggleHabitToday = async (habit: Habit) => {
    if (!habit.id) return;
    const exists = habit.completedDates.includes(todayKey);
    const updated = exists
      ? habit.completedDates.filter((d) => d !== todayKey)
      : [...habit.completedDates, todayKey];
    await db.habits.update(habit.id, { completedDates: updated });
  };

  const addQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    await db.quickNotes.add({
      text: quickText.trim(),
      createdAt: Date.now(),
    });
    setQuickText('');
  };

  const deleteQuickNote = async (id?: number) => {
    if (id) await db.quickNotes.delete(id);
  };

  const doneHabitsCount = habits.filter((h) =>
    h.completedDates.includes(todayKey)
  ).length;

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-hero">
        <div>
          <h1>
            <Sun size={26} /> Hôm nay
          </h1>
          <p className="guide-subtitle" style={{ marginBottom: 0 }}>
            {formattedDate}
          </p>
        </div>

        <button
          className="cal-btn primary"
          onClick={() => onNavigate('journal')}
        >
          <BookHeart size={15} />
          {todayJournal
            ? `Nhật ký hôm nay (${MOOD_META[todayJournal.mood].emoji})`
            : 'Viết nhật ký hôm nay'}
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Widget 1: Việc cần làm hôm nay (Đồng bộ từ Bảng Lịch) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>
              <CheckSquare size={16} /> Lịch & Việc hôm nay
            </h3>
            <button
              className="link-btn"
              onClick={() => onNavigate('calendar')}
            >
              Mở lịch <ArrowRight size={13} />
            </button>
          </div>

          {todayEvents.length === 0 ? (
            <p className="muted-hint">
              Không có sự kiện nào trong ngày hôm nay.
            </p>
          ) : (
            <div className="dash-event-list">
              {todayEvents.map((ev) => (
                <div key={ev.id} className="dash-event-item">
                  <div className="dash-event-title">{ev.title}</div>
                  {ev.todos && ev.todos.length > 0 && (
                    <div className="dash-todo-sublist">
                      {ev.todos.map((t) => (
                        <label key={t.id} className="todo-label">
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => toggleEventTodo(ev, t.id)}
                          />
                          <span className={t.done ? 'todo-done' : ''}>
                            {t.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Widget 2: Điểm danh thói quen hôm nay */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>
              <Flame size={16} /> Thói quen ({doneHabitsCount}/{habits.length})
            </h3>
            <button
              className="link-btn"
              onClick={() => onNavigate('planner')}
            >
              Kế hoạch <ArrowRight size={13} />
            </button>
          </div>

          {habits.length === 0 ? (
            <p className="muted-hint">
              Chưa thiết lập thói quen. Bấm "Kế hoạch" để thêm.
            </p>
          ) : (
            <div className="dash-habit-list">
              {habits.map((h) => {
                const done = h.completedDates.includes(todayKey);
                const streak = calculateStreak(h.completedDates);
                return (
                  <div
                    key={h.id}
                    className={`dash-habit-row ${done ? 'done' : ''}`}
                    onClick={() => toggleHabitToday(h)}
                  >
                    <div className="dash-habit-left">
                      <span className={`habit-check-btn ${done ? 'checked' : ''}`}>
                        {done && <Check size={12} />}
                      </span>
                      <span>{h.name}</span>
                    </div>
                    <span className="streak-pill">🔥 {streak}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Widget 3: Ghi chú nhanh (Quick Notes) */}
        <div className="dash-card dash-card-wide">
          <div className="dash-card-header">
            <h3>
              <StickyNote size={16} /> Ghi chú nhanh (Quick Notes)
            </h3>
          </div>

          <form className="inline-add-form" onSubmit={addQuickNote}>
            <input
              type="text"
              className="modal-input"
              placeholder="Ghi nhanh một ý tưởng, từ vựng vừa gặp, hoặc việc cần nhớ (Enter)..."
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
            />
            <button type="submit" className="cal-btn primary">
              <Plus size={14} /> Lưu
            </button>
          </form>

          <div className="quick-notes-grid">
            {quickNotes.map((qn) => (
              <div key={qn.id} className="quick-note-chip">
                <span>{qn.text}</span>
                <button
                  className="todo-del-btn"
                  onClick={() => deleteQuickNote(qn.id)}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}