import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookHeart,
  CheckSquare,
  Flame,
  StickyNote,
  Plus,
  X,
  ArrowRight,
  Check,
  CalendarDays,
  Target,
  FileText,
  GraduationCap,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
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
  onNavigate: (view: 'journal' | 'planner' | 'calendar' | 'profile' | 'guide') => void;
  onCreatePage?: () => void;
}

interface TodayPlanItem {
  id: string;
  category: string;
  title: string;
  meta: string;
  done: boolean;
  iconType: 'habit' | 'event';
  onToggle: () => void;
}

const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DashboardView({ onNavigate, onCreatePage }: DashboardProps) {
  const todayKey = getTodayKey();
  const [quickText, setQuickText] = useState('');
  const [displayName, setDisplayName] = useState<string>(
    () => localStorage.getItem('local_notion_display_name') || 'Bạn'
  );
  const [editingName, setEditingName] = useState(false);

  const todayJournal = useLiveQuery(
    () => db.journals.where('date').equals(todayKey).first(),
    [todayKey]
  );
  const allJournals = useLiveQuery(() => db.journals.toArray()) ?? [];
  const todayEvents =
    useLiveQuery(
      () => db.events.where('date').equals(todayKey).toArray(),
      [todayKey]
    ) ?? [];
  const allEventsCount = useLiveQuery(() => db.events.count()) ?? 0;
  const habits = useLiveQuery(() => db.habits.toArray()) ?? [];
  const goals =
    useLiveQuery(() => db.goals.orderBy('updatedAt').reverse().toArray()) ?? [];
  const pagesCount = useLiveQuery(() => db.pages.count()) ?? 0;
  const coursesCount = useLiveQuery(() => db.courses.count()) ?? 0;
  const quickNotes =
    useLiveQuery(() =>
      db.quickNotes.orderBy('createdAt').reverse().toArray()
    ) ?? [];

  const now = new Date();
  const monthLabel = `Tháng ${now.getMonth() + 1}`;
  const dayNum = now.getDate();
  const weekdayLabel = now.toLocaleDateString('vi-VN', { weekday: 'long' });

  // Tổng hợp ngày có hoạt động (thói quen hoặc nhật ký) để tính chuỗi và thanh 7 ngày trong tuần
  const activeDateSet = useMemo(() => {
    const set = new Set<string>();
    habits.forEach((h) => h.completedDates.forEach((d) => set.add(d)));
    allJournals.forEach((j) => set.add(j.date));
    return set;
  }, [habits, allJournals]);

  const overallStreak = useMemo(
    () => calculateStreak(Array.from(activeDateSet)),
    [activeDateSet]
  );

  const weekDays = useMemo(() => {
    const ref = new Date();
    const dow = ref.getDay(); // 0 = CN, 1 = T2 ...
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMon);

    return WEEKDAY_SHORT.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const key = formatDateKey(d);
      return {
        label,
        key,
        isToday: key === todayKey,
        isFuture: key > todayKey,
        isDone: activeDateSet.has(key),
      };
    });
  }, [activeDateSet, todayKey]);

  const weekDoneCount = weekDays.filter((d) => d.isDone).length;

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

  const saveDisplayName = (val: string) => {
    const clean = val.trim() || 'Bạn';
    setDisplayName(clean);
    localStorage.setItem('local_notion_display_name', clean);
    window.dispatchEvent(new Event('local-notion-name-updated'));
    setEditingName(false);
  };

  const doneHabitsCount = habits.filter((h) =>
    h.completedDates.includes(todayKey)
  ).length;

  // Gộp việc từ Lịch hôm nay và Thói quen hôm nay vào danh sách "Kế hoạch hôm nay"
  const todayPlanItems = useMemo<TodayPlanItem[]>(() => {
    const list: TodayPlanItem[] = [];

    todayEvents.forEach((ev) => {
      if (ev.todos && ev.todos.length > 0) {
        ev.todos.forEach((t) => {
          list.push({
            id: `ev-${ev.id}-todo-${t.id}`,
            category: ev.title,
            title: t.text,
            meta: 'Lịch hôm nay',
            done: t.done,
            iconType: 'event',
            onToggle: () => toggleEventTodo(ev, t.id),
          });
        });
      } else {
        list.push({
          id: `ev-${ev.id}`,
          category: ev.tags?.[0] || 'Sự kiện lịch',
          title: ev.title,
          meta: 'Mở bảng lịch',
          done: false,
          iconType: 'event',
          onToggle: () => onNavigate('calendar'),
        });
      }
    });

    habits.forEach((h) => {
      const done = h.completedDates.includes(todayKey);
      const streak = calculateStreak(h.completedDates);
      list.push({
        id: `habit-${h.id}`,
        category: h.category || 'Thói quen',
        title: h.name,
        meta: `Chuỗi ${streak} ngày`,
        done,
        iconType: 'habit',
        onToggle: () => toggleHabitToday(h),
      });
    });

    return list;
  }, [todayEvents, habits, todayKey]);

  const completedPlanCount = todayPlanItems.filter((i) => i.done).length;
  const firstPendingIndex = todayPlanItems.findIndex((i) => !i.done);

  // Tiến độ lộ trình mục tiêu
  const overallGoalPercent = useMemo(() => {
    if (goals.length > 0) {
      const totalPct = goals.reduce((acc, g) => {
        const pct = g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0;
        return acc + Math.min(100, Math.max(0, pct));
      }, 0);
      return Math.round(totalPct / goals.length);
    }
    if (habits.length > 0) {
      return Math.round((doneHabitsCount / habits.length) * 100);
    }
    return 0;
  }, [goals, habits.length, doneHabitsCount]);

  return (
    <div className="dashboard-wrapper">
      {/* TẦNG 1: Thẻ chào mừng & chuỗi điểm danh */}
      <section className="dash-hero-card">
        <div className="dash-hero-decor-blob" aria-hidden="true" />
        <div className="dash-hero-sparkle" aria-hidden="true">✦</div>

        <div className="dash-hero-top">
          <div className="dash-greeting-row">
            {editingName ? (
              <form
                className="name-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveDisplayName(displayName);
                }}
              >
                <span>Chào</span>
                <input
                  autoFocus
                  className="name-inline-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => saveDisplayName(displayName)}
                />
                <span>, tiếp tục nhé.</span>
              </form>
            ) : (
              <h1 className="dash-greeting-title">
                Chào {displayName}, tiếp tục nhé.
                <button
                  className="edit-name-btn"
                  onClick={() => setEditingName(true)}
                  title="Đổi tên hiển thị"
                >
                  <Pencil size={14} />
                </button>
              </h1>
            )}
          </div>

          <div className="dash-mascot-badge" aria-hidden="true" title="Cùng giữ nhịp mỗi ngày!">
            🦝
          </div>
        </div>

        {/* Thanh lịch ngày + chuỗi điểm danh 7 ngày */}
        <div className="dash-streak-bar">
          <div className="dash-cal-badge">
            <span className="dash-cal-month">{monthLabel}</span>
            <div className="dash-cal-body">
              <strong>{dayNum}</strong>
              <span>{weekdayLabel}</span>
            </div>
          </div>

          <div className="dash-streak-summary">
            <span className="dash-flame-circle">
              <Flame size={16} />
            </span>
            <div>
              <div className="dash-streak-num">{overallStreak} ngày</div>
              <div className="dash-streak-sub">Chuỗi điểm danh</div>
            </div>
          </div>

          <div className="dash-week-days">
            {weekDays.map((d) => (
              <div
                key={d.key}
                className={`dash-day-col ${d.isToday ? 'is-today' : ''}`}
              >
                <span className="dash-day-label">{d.label}</span>
                {d.isDone ? (
                  <span className="dash-day-dot done">
                    <Check size={11} strokeWidth={3} />
                  </span>
                ) : d.isFuture ? (
                  <span className="dash-day-dot future" />
                ) : (
                  <span className="dash-day-dot empty" />
                )}
              </div>
            ))}
          </div>

          <div className="dash-week-meta">
            <span className="dash-week-meta-label">Tuần này</span>
            <strong>{weekDoneCount}/7 ngày</strong>
          </div>

          <button
            className={`dash-checkin-pill ${todayJournal ? 'checked' : ''}`}
            onClick={() => onNavigate('journal')}
          >
            <CheckCircle2 size={14} />
            <span>
              {todayJournal
                ? `Đã điểm danh ${MOOD_META[todayJournal.mood].emoji}`
                : 'Viết nhật ký'}
            </span>
          </button>
        </div>
      </section>

      {/* TẦNG 2: Hàng thẻ tính năng pastel dán băng keo washi */}
      <section className="dash-tiles-section">
        <div className="dash-section-heading">
          <h2>Hôm nay làm gì?</h2>
          <span className="dash-heading-line" />
          <p>Mỗi ngày một chút, đều đặn là được.</p>
        </div>

        <div className="dash-tiles-grid">
          <button
            className="dash-tile tile-blue"
            onClick={() => onNavigate('journal')}
          >
            <span className="tile-badge">{allJournals.length} BÀI</span>
            <h3>Nhật ký</h3>
            <p>Ghi lại tâm trạng, giấc ngủ và điểm sáng</p>
            <div className="tile-art">
              <BookHeart size={28} />
            </div>
          </button>

          <button
            className="dash-tile tile-purple"
            onClick={() => onNavigate('planner')}
          >
            <span className="tile-badge">
              {doneHabitsCount}/{habits.length} XONG
            </span>
            <h3>Thói quen</h3>
            <p>Điểm danh hằng ngày, giữ chuỗi liên tục</p>
            <div className="tile-art">
              <Flame size={28} />
            </div>
          </button>

          <button
            className="dash-tile tile-peach"
            onClick={() => onNavigate('planner')}
          >
            <span className="tile-badge">{goals.length} MỤC TIÊU</span>
            <h3>Lộ trình</h3>
            <p>Theo dõi tiến độ và cột mốc từng bước</p>
            <div className="tile-art">
              <Target size={28} />
            </div>
          </button>

          <button
            className="dash-tile tile-mint"
            onClick={() => onNavigate('calendar')}
          >
            <span className="tile-badge">{allEventsCount} SỰ KIỆN</span>
            <h3>Bảng lịch</h3>
            <p>Lịch trình tháng, thẻ việc và ghi chú ngày</p>
            <div className="tile-art">
              <CalendarDays size={28} />
            </div>
          </button>

          <button
            className="dash-tile tile-pink"
            onClick={() => onCreatePage?.()}
          >
            <span className="tile-badge">{pagesCount} TRANG</span>
            <h3>Tài liệu</h3>
            <p>Ghi chú dạng khối, công thức toán & mục lục</p>
            <div className="tile-art">
              <FileText size={28} />
            </div>
          </button>

          <button
            className="dash-tile tile-yellow"
            onClick={() => onNavigate('profile')}
          >
            <span className="tile-badge">{coursesCount} MÔN HỌC</span>
            <h3>Hồ sơ & GPA</h3>
            <p>Tính điểm GPA, giả lập điểm và két sắt</p>
            <div className="tile-art">
              <GraduationCap size={28} />
            </div>
          </button>
        </div>
      </section>

      {/* TẦNG 3: Lưới 2 cột — Kế hoạch hôm nay (trái) & Lộ trình (phải) */}
      <section className="dash-bottom-grid">
        {/* Cột trái: Kế hoạch hôm nay */}
        <div className="dash-plan-card">
          <div className="plan-washi-tape" aria-hidden="true" />
          <div className="dash-plan-header">
            <div className="dash-plan-title-group">
              <span className="dash-plan-icon">
                <CheckSquare size={18} />
              </span>
              <h2>Kế hoạch hôm nay.</h2>
            </div>
            <div className="dash-plan-circle-badge">
              <strong>
                {completedPlanCount}/{todayPlanItems.length}
              </strong>
              <span>việc</span>
            </div>
          </div>

          {todayPlanItems.length === 0 ? (
            <div className="plan-empty-box">
              <p>Chưa có sự kiện hay thói quen nào cho hôm nay.</p>
              <div className="plan-empty-actions">
                <button className="btn-next-pill" onClick={() => onNavigate('calendar')}>
                  + Thêm lịch hôm nay
                </button>
                <button className="cal-btn" onClick={() => onNavigate('planner')}>
                  + Tạo thói quen
                </button>
              </div>
            </div>
          ) : (
            <div className="plan-items-list">
              {todayPlanItems.map((item, idx) => {
                const isNext = idx === firstPendingIndex;
                return (
                  <div
                    key={item.id}
                    className={`plan-item-card ${item.done ? 'is-done' : ''} ${
                      isNext ? 'is-next' : ''
                    }`}
                    onClick={item.onToggle}
                  >
                    <div className="plan-item-left">
                      <span
                        className={`plan-item-icon ${
                          item.iconType === 'habit' ? 'habit' : 'event'
                        }`}
                      >
                        {item.iconType === 'habit' ? (
                          <Flame size={15} />
                        ) : (
                          <CheckSquare size={15} />
                        )}
                      </span>
                      <div className="plan-item-text">
                        <span className="plan-item-cat">{item.category}</span>
                        <strong className="plan-item-title">{item.title}</strong>
                      </div>
                    </div>

                    <div className="plan-item-right">
                      {item.done ? (
                        <span className="stamp-done">ĐÃ XONG</span>
                      ) : isNext ? (
                        <>
                          <button
                            className="btn-next-pill"
                            onClick={(e) => {
                              e.stopPropagation();
                              item.onToggle();
                            }}
                          >
                            Tiếp theo
                          </button>
                          <MoreHorizontal size={16} className="plan-more-icon" />
                        </>
                      ) : (
                        <>
                          <span className="plan-item-meta">{item.meta}</span>
                          <MoreHorizontal size={16} className="plan-more-icon" />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cột phải: Lộ trình & Mục tiêu */}
        <div className="dash-roadmap-card">
          <div className="dash-roadmap-header">
            <div className="dash-plan-title-group">
              <span className="dash-roadmap-icon">
                <Target size={16} />
              </span>
              <h2>Lộ trình.</h2>
            </div>
            <button className="roadmap-open-btn" onClick={() => onNavigate('planner')}>
              Mở <ArrowRight size={14} />
            </button>
          </div>

          <div className="roadmap-big-pct">{overallGoalPercent}%</div>
          <p className="roadmap-subtitle">
            {goals.length > 0
              ? `chặng đường hoàn thành ${goals.length} mục tiêu`
              : 'tiến độ thói quen hôm nay'}
          </p>

          <div className="roadmap-bar-wrap">
            <div className="roadmap-bar-track">
              <div
                className="roadmap-bar-fill"
                style={{ width: `${Math.max(4, overallGoalPercent)}%` }}
              />
              <span className="roadmap-bar-marker" />
            </div>
            <div className="roadmap-bar-caption">Mốc hoàn thành</div>
          </div>

          <div className="roadmap-mini-stats">
            <div className="roadmap-mini-box">
              <span>Thói quen hôm nay</span>
              <strong>
                {doneHabitsCount}/{habits.length}
              </strong>
            </div>
            <div className="roadmap-mini-box">
              <span>Tài liệu & Ghi chú</span>
              <strong>
                {pagesCount}/{pagesCount + quickNotes.length}
              </strong>
            </div>
          </div>

          <div className="roadmap-chapter-list">
            {goals.length === 0 ? (
              <div
                className="roadmap-chapter-item active"
                onClick={() => onNavigate('planner')}
              >
                <div className="roadmap-chapter-top">
                  <span>Bắt đầu lộ trình</span>
                  <span>0/1</span>
                </div>
                <strong>Tạo mục tiêu đầu tiên của bạn</strong>
              </div>
            ) : (
              goals.slice(0, 3).map((g, index) => (
                <div
                  key={g.id}
                  className={`roadmap-chapter-item ${index === 0 ? 'active' : ''}`}
                  onClick={() => onNavigate('planner')}
                >
                  <div className="roadmap-chapter-top">
                    <span>{g.category || `Mục tiêu ${index + 1}`}</span>
                    <span>
                      {g.currentValue}/{g.targetValue}
                      {g.unit ? ` ${g.unit}` : ''}
                    </span>
                  </div>
                  <strong>{g.title}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Ghi chú nhanh (Quick Notes) đồng bộ phong cách giấy kem */}
      <section className="dash-card dash-quicknotes-card">
        <div className="dash-card-header">
          <h3>
            <StickyNote size={16} /> Ghi chú nhanh (Quick Notes)
          </h3>
          <span className="muted-hint">{quickNotes.length} ghi chú</span>
        </div>

        <form className="inline-add-form" onSubmit={addQuickNote}>
          <input
            type="text"
            className="modal-input"
            placeholder="Ghi nhanh một ý tưởng, từ vựng vừa gặp, hoặc việc cần nhớ (Enter)..."
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
          />
          <button type="submit" className="btn-next-pill">
            <Plus size={14} /> Lưu
          </button>
        </form>

        {quickNotes.length > 0 && (
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
        )}
      </section>
    </div>
  );
}