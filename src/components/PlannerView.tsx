import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Target,
  Flame,
  Plus,
  Trash2,
  Check,
  X,
  CheckSquare,
} from 'lucide-react';
import { db, getTodayKey, type Habit, type Goal } from '../db';

function getLast7Days(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    result.push({
      key: `${y}-${m}-${day}`,
      label: `${day}/${m}`,
    });
  }
  return result;
}

export function calculateStreak(completedDates: string[]): number {
  const set = new Set(completedDates);
  let streak = 0;
  const cursor = new Date();
  // Nếu hôm nay chưa tick thì kiểm tra từ hôm qua để không mất chuỗi giữa ngày
  const todayStr = getTodayKey();
  if (!set.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (set.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const GOAL_CATEGORIES = ['Tiếng Anh', 'Sức khỏe', 'Học tập', 'Kỹ năng', 'Cá nhân'];

export function PlannerView() {
  const habits = useLiveQuery(() => db.habits.toArray()) ?? [];
  const goals = useLiveQuery(() =>
    db.goals.orderBy('updatedAt').reverse().toArray()
  ) ?? [];

  const last7Days = getLast7Days();

  // State thêm thói quen
  const [habitName, setHabitName] = useState('');
  const [habitCat, setHabitCat] = useState('Sức khỏe');

  // State thêm mục tiêu
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCat, setGoalCat] = useState('Tiếng Anh');
  const [goalCurrent, setGoalCurrent] = useState(0);
  const [goalTarget, setGoalTarget] = useState(100);
  const [goalUnit, setGoalUnit] = useState('%');

  // State thêm milestone cho từng goal
  const [milestoneInputs, setMilestoneInputs] = useState<Record<number, string>>({});

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    await db.habits.add({
      name: habitName.trim(),
      category: habitCat,
      completedDates: [],
      createdAt: Date.now(),
    });
    setHabitName('');
  };

  const toggleHabitDate = async (habit: Habit, dateKey: string) => {
    if (!habit.id) return;
    const exists = habit.completedDates.includes(dateKey);
    const updated = exists
      ? habit.completedDates.filter((d) => d !== dateKey)
      : [...habit.completedDates, dateKey];
    await db.habits.update(habit.id, { completedDates: updated });
  };

  const deleteHabit = async (id?: number) => {
    if (id) await db.habits.delete(id);
  };

  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    await db.goals.add({
      title: goalTitle.trim(),
      category: goalCat,
      currentValue: Number(goalCurrent) || 0,
      targetValue: Number(goalTarget) || 100,
      unit: goalUnit.trim(),
      milestones: [],
      updatedAt: Date.now(),
    });
    setGoalTitle('');
    setGoalCurrent(0);
    setGoalTarget(100);
    setGoalUnit('%');
    setShowGoalForm(false);
  };

  const updateGoalValue = async (goal: Goal, newVal: number) => {
    if (!goal.id) return;
    await db.goals.update(goal.id, {
      currentValue: newVal,
      updatedAt: Date.now(),
    });
  };

  const addMilestone = async (goal: Goal) => {
    if (!goal.id) return;
    const text = (milestoneInputs[goal.id] || '').trim();
    if (!text) return;
    await db.goals.update(goal.id, {
      milestones: [
        ...goal.milestones,
        { id: `${Date.now()}`, text, done: false },
      ],
      updatedAt: Date.now(),
    });
    setMilestoneInputs((prev) => ({ ...prev, [goal.id!]: '' }));
  };

  const toggleMilestone = async (goal: Goal, mId: string) => {
    if (!goal.id) return;
    await db.goals.update(goal.id, {
      milestones: goal.milestones.map((m) =>
        m.id === mId ? { ...m, done: !m.done } : m
      ),
      updatedAt: Date.now(),
    });
  };

  const removeMilestone = async (goal: Goal, mId: string) => {
    if (!goal.id) return;
    await db.goals.update(goal.id, {
      milestones: goal.milestones.filter((m) => m.id !== mId),
      updatedAt: Date.now(),
    });
  };

  const deleteGoal = async (id?: number) => {
    if (id) await db.goals.delete(id);
  };

  const getGoalPercent = (g: Goal) => {
    if (g.milestones.length > 0) {
      const done = g.milestones.filter((m) => m.done).length;
      return Math.round((done / g.milestones.length) * 100);
    }
    if (g.targetValue <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((g.currentValue / g.targetValue) * 100)));
  };

  return (
    <div className="planner-wrapper">
      <h1>Kế hoạch & Thói quen</h1>
      <p className="guide-subtitle">
        Theo dõi kỷ luật hằng ngày và lộ trình các mục tiêu cá nhân (Tiếng Anh, Sức khỏe, Học tập).
      </p>

      {/* PHẦN 1: HABIT TRACKER */}
      <section className="planner-section">
        <div className="section-header-row">
          <h2>
            <Flame size={18} /> Bảng điểm danh thói quen (7 ngày gần nhất)
          </h2>
        </div>

        <form className="inline-add-form" onSubmit={addHabit}>
          <input
            type="text"
            className="modal-input"
            placeholder="Ví dụ: Nghe tiếng Anh 30p, Chống đẩy & Squat, Ngủ trước 1h..."
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
          />
          <select
            className="modal-input select-narrow"
            value={habitCat}
            onChange={(e) => setHabitCat(e.target.value)}
          >
            {GOAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="cal-btn primary">
            <Plus size={14} /> Thêm
          </button>
        </form>

        <div className="habit-table-wrap">
          <table className="habit-table">
            <thead>
              <tr>
                <th>Thói quen</th>
                {last7Days.map((d) => (
                  <th key={d.key} className="habit-day-col">
                    {d.label}
                  </th>
                ))}
                <th className="habit-day-col">Chuỗi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {habits.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted-hint" style={{ textAlign: 'center', padding: 16 }}>
                    Chưa có thói quen nào. Hãy thêm thói quen đầu tiên ở trên!
                  </td>
                </tr>
              ) : (
                habits.map((h) => {
                  const streak = calculateStreak(h.completedDates);
                  return (
                    <tr key={h.id}>
                      <td>
                        <div className="habit-name-cell">
                          <span>{h.name}</span>
                          <span className="habit-cat-badge">{h.category}</span>
                        </div>
                      </td>
                      {last7Days.map((d) => {
                        const checked = h.completedDates.includes(d.key);
                        return (
                          <td key={d.key} className="habit-day-col">
                            <button
                              type="button"
                              className={`habit-check-btn ${checked ? 'checked' : ''}`}
                              onClick={() => toggleHabitDate(h, d.key)}
                            >
                              {checked && <Check size={13} />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="habit-day-col">
                        <span className="streak-pill">🔥 {streak}</span>
                      </td>
                      <td>
                        <button
                          className="todo-del-btn"
                          onClick={() => deleteHabit(h.id)}
                          title="Xóa thói quen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PHẦN 2: GOAL CARDS */}
      <section className="planner-section">
        <div className="section-header-row">
          <h2>
            <Target size={18} /> Mục tiêu & Lộ trình dài hạn
          </h2>
          <button
            className="cal-btn primary"
            onClick={() => setShowGoalForm((v) => !v)}
          >
            <Plus size={14} /> Tạo mục tiêu mới
          </button>
        </div>

        {showGoalForm && (
          <form className="goal-create-card" onSubmit={addGoal}>
            <div className="goal-form-grid">
              <input
                type="text"
                className="modal-input"
                placeholder="Tên mục tiêu (vd: Cải thiện thể hình 45 → 50kg, Luyện IELTS 7.0)..."
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                required
              />
              <select
                className="modal-input"
                value={goalCat}
                onChange={(e) => setGoalCat(e.target.value)}
              >
                {GOAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="goal-form-metrics">
              <label>
                Hiện tại:
                <input
                  type="number"
                  className="modal-input"
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(Number(e.target.value))}
                />
              </label>
              <label>
                Đích đến:
                <input
                  type="number"
                  className="modal-input"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(Number(e.target.value))}
                />
              </label>
              <label>
                Đơn vị:
                <input
                  type="text"
                  className="modal-input"
                  placeholder="kg, bài, từ..."
                  value={goalUnit}
                  onChange={(e) => setGoalUnit(e.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="cal-btn"
                onClick={() => setShowGoalForm(false)}
              >
                Hủy
              </button>
              <button type="submit" className="cal-btn primary">
                Lưu mục tiêu
              </button>
            </div>
          </form>
        )}

        <div className="goals-grid">
          {goals.map((g) => {
            const percent = getGoalPercent(g);
            return (
              <div key={g.id} className="goal-card">
                <div className="goal-card-top">
                  <div>
                    <span className="habit-cat-badge">{g.category}</span>
                    <h3>{g.title}</h3>
                  </div>
                  <button
                    className="todo-del-btn"
                    onClick={() => deleteGoal(g.id)}
                    title="Xóa mục tiêu"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Thanh tiến độ */}
                <div className="progress-row">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="progress-pct">{percent}%</span>
                </div>

                {/* Cập nhật chỉ số trực tiếp */}
                <div className="goal-metric-editor">
                  <span>Chỉ số:</span>
                  <input
                    type="number"
                    className="metric-small-input"
                    value={g.currentValue}
                    onChange={(e) => updateGoalValue(g, Number(e.target.value))}
                  />
                  <span>
                    / {g.targetValue} {g.unit}
                  </span>
                </div>

                {/* Cột mốc (Milestones) */}
                <div className="goal-milestones">
                  <div className="notion-prop-label">
                    <CheckSquare size={12} /> Cột mốc hành động
                  </div>
                  {g.milestones.map((m) => (
                    <div key={m.id} className="todo-item-row">
                      <label className="todo-label">
                        <input
                          type="checkbox"
                          checked={m.done}
                          onChange={() => toggleMilestone(g, m.id)}
                        />
                        <span className={m.done ? 'todo-done' : ''}>
                          {m.text}
                        </span>
                      </label>
                      <button
                        className="todo-del-btn"
                        onClick={() => removeMilestone(g, m.id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="todo-add-row">
                    <input
                      type="text"
                      className="todo-add-input"
                      placeholder="+ Thêm cột mốc (Enter)..."
                      value={g.id ? milestoneInputs[g.id] || '' : ''}
                      onChange={(e) =>
                        g.id &&
                        setMilestoneInputs((prev) => ({
                          ...prev,
                          [g.id!]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMilestone(g);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}