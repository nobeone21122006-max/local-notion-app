
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar as CalIcon,
  Tag,
  Trash2,
  AlignLeft,
  CheckSquare,
} from 'lucide-react';
import { db,MOOD_META, type CalendarEvent, type TodoItem } from '../db';

const PRESET_TAGS = ['Học tập', 'Deadline', 'Thi cử', 'Code', 'Cá nhân', 'CLB'];

const TAG_PALETTE = [
  { bg: 'rgba(35, 131, 226, 0.2)', text: '#529cca' },
  { bg: 'rgba(224, 62, 62, 0.2)', text: '#ff7369' },
  { bg: 'rgba(15, 123, 108, 0.22)', text: '#4dab9a' },
  { bg: 'rgba(217, 115, 13, 0.22)', text: '#ffa344' },
  { bg: 'rgba(105, 64, 165, 0.25)', text: '#9a6dd7' },
  { bg: 'rgba(173, 26, 114, 0.22)', text: '#e255a1' },
];

function getTagStyle(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
  return { backgroundColor: color.bg, color: color.text };
}

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

function formatDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function CalendarView() {
  const events = useLiveQuery(() => db.events.toArray()) ?? [];
  const journals = useLiveQuery(() => db.journals.toArray()) ?? [];

  const moodByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const j of journals) {
      map[j.date] = MOOD_META[j.mood]?.emoji || '';
    }
    return map;
  }, [journals]);
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // State Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [note, setNote] = useState('');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState('');

  const todayKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDays = lastDayOfMonth.getDate();

    const cells: { dateKey: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      cells.push({
        dateKey: formatDateKey(prevY, prevM, d),
        dayNumber: d,
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        dateKey: formatDateKey(currentYear, currentMonth, d),
        dayNumber: d,
        isCurrentMonth: true,
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      cells.push({
        dateKey: formatDateKey(nextY, nextM, d),
        dayNumber: d,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const openCreateModal = (dateKey: string) => {
    setEditingId(null);
    setSelectedDate(dateKey);
    setTitle('');
    setTags([]);
    setTagInput('');
    setNote('');
    setTodos([]);
    setTodoInput('');
    setModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, ev: CalendarEvent) => {
    e.stopPropagation();
    setEditingId(ev.id ?? null);
    setSelectedDate(ev.date);
    setTitle(ev.title);
    setTags(ev.tags || []);
    setTagInput('');
    setNote(ev.note || '');
    setTodos(ev.todos || []);
    setTodoInput('');
    setModalOpen(true);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        setTags((prev) => [...prev, newTag]);
      }
      setTagInput('');
    }
  };

  // Quản lý To-do list trong sự kiện
  const addTodo = () => {
    if (!todoInput.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: todoInput.trim(),
        done: false,
      },
    ]);
    setTodoInput('');
  };

  const handleTodoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodo();
    }
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const removeTodo = (id: string) => {
    setTodos((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !title.trim()) return;

    const finalTags =
      tagInput.trim() && !tags.includes(tagInput.trim())
        ? [...tags, tagInput.trim()]
        : tags;

    const finalTodos = todoInput.trim()
      ? [
          ...todos,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: todoInput.trim(),
            done: false,
          },
        ]
      : todos;

    if (editingId !== null) {
      await db.events.update(editingId, {
        date: selectedDate,
        title: title.trim(),
        tags: finalTags,
        note: note.trim(),
        todos: finalTodos,
      });
    } else {
      await db.events.add({
        date: selectedDate,
        title: title.trim(),
        tags: finalTags,
        note: note.trim(),
        todos: finalTodos,
      });
    }
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (editingId !== null) {
      await db.events.delete(editingId);
      setModalOpen(false);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const completedCount = todos.filter((t) => t.done).length;

  return (
    <div className="calendar-wrapper">
      <div className="calendar-header">
        <div className="calendar-title-group">
          <CalIcon size={22} />
          <h1>
            Tháng {currentMonth + 1}, {currentYear}
          </h1>
        </div>

        <div className="calendar-controls">
          <button className="cal-btn" onClick={goToday}>
            Hôm nay
          </button>
          <button className="cal-btn" onClick={prevMonth} title="Tháng trước">
            <ChevronLeft size={16} />
          </button>
          <button className="cal-btn" onClick={nextMonth} title="Tháng sau">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}

        {calendarDays.map((cell) => {
          const dayEvents = eventsByDate[cell.dateKey] || [];
          const isToday = cell.dateKey === todayKey;

          return (
            <div
              key={cell.dateKey}
              className={`calendar-cell ${
                !cell.isCurrentMonth ? 'other-month' : ''
              }`}
              onClick={() => openCreateModal(cell.dateKey)}
            >
            <div className="cell-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className={`day-number ${isToday ? 'today-badge' : ''}`}>
                    {cell.dayNumber}
                  </span>
                  {moodByDate[cell.dateKey] && (
                    <span className="cal-mood-emoji" title="Tâm trạng trong nhật ký">
                      {moodByDate[cell.dateKey]}
                    </span>
                  )}
                </div>
                <button
                  className="add-event-hint"
                  title="Thêm mục mới"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreateModal(cell.dateKey);
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="cell-events">
                {dayEvents.map((ev) => {
                  const evTodos = ev.todos || [];
                  const doneCount = evTodos.filter((t) => t.done).length;
                  const allDone =
                    evTodos.length > 0 && doneCount === evTodos.length;

                  return (
                    <div
                      key={ev.id}
                      className="notion-event-card"
                      onClick={(e) => openEditModal(e, ev)}
                    >
                      <div className="notion-card-title">{ev.title}</div>

                      {ev.tags && ev.tags.length > 0 && (
                        <div className="notion-card-tags">
                          {ev.tags.map((t) => (
                            <span
                              key={t}
                              className="notion-tag"
                              style={getTagStyle(t)}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {evTodos.length > 0 && (
                        <div
                          className={`card-todo-badge ${
                            allDone ? 'all-done' : ''
                          }`}
                        >
                          <CheckSquare size={11} />
                          <span>
                            {doneCount}/{evTodos.length}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal kiểu Notion Page Property */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <form
            className="event-modal notion-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
          >
            <div className="modal-header">
              <span className="modal-date-badge">{selectedDate}</span>
              <div className="header-actions">
                {editingId !== null && (
                  <button
                    type="button"
                    className="icon-btn delete-btn"
                    onClick={handleDelete}
                    title="Xóa sự kiện"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <input
              type="text"
              autoFocus
              className="notion-modal-title-input"
              placeholder="Tên sự kiện / công việc..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* Khu vực Tags */}
            <div className="notion-prop-row">
              <div className="notion-prop-label">
                <Tag size={14} /> Tags
              </div>
              <div className="notion-prop-value">
                <div className="selected-tags-box">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="notion-tag editable"
                      style={getTagStyle(t)}
                    >
                      {t}
                      <button type="button" onClick={() => toggleTag(t)}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="inline-tag-input"
                    placeholder="Gõ tag + Enter..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                  />
                </div>
                <div className="preset-tags-row">
                  {PRESET_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="notion-tag preset"
                      style={getTagStyle(t)}
                      onClick={() => toggleTag(t)}
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Khu vực To-do list */}
            <div className="notion-prop-row">
              <div className="notion-prop-label">
                <CheckSquare size={14} /> To-do list
                {todos.length > 0 && (
                  <span className="todo-counter">
                    ({completedCount}/{todos.length})
                  </span>
                )}
              </div>

              <div className="todo-list-box">
                {todos.map((item) => (
                  <div key={item.id} className="todo-item-row">
                    <label className="todo-label">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleTodo(item.id)}
                      />
                      <span className={item.done ? 'todo-done' : ''}>
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="todo-del-btn"
                      onClick={() => removeTodo(item.id)}
                      title="Xóa đầu việc"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <div className="todo-add-row">
                  <input
                    type="text"
                    className="todo-add-input"
                    placeholder="+ Thêm việc cần làm (Enter)..."
                    value={todoInput}
                    onChange={(e) => setTodoInput(e.target.value)}
                    onKeyDown={handleTodoKeyDown}
                  />
                  <button
                    type="button"
                    className="cal-btn todo-add-btn"
                    onClick={addTodo}
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>

            {/* Khu vực ghi chú */}
            <div className="notion-prop-row">
              <div className="notion-prop-label">
                <AlignLeft size={14} /> Ghi chú
              </div>
              <textarea
                className="notion-note-input"
                rows={2}
                placeholder="Thêm mô tả chi tiết, link tài liệu..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cal-btn"
                onClick={() => setModalOpen(false)}
              >
                Hủy
              </button>
              <button type="submit" className="cal-btn primary">
                {editingId !== null ? 'Cập nhật' : 'Tạo sự kiện'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}