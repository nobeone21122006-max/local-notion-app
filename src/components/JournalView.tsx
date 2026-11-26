import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookHeart,
  Plus,
  Moon,
  Sparkles,
  Trash2,
  Calendar,
} from 'lucide-react';
import {
  db,
  getTodayKey,
  MOOD_META,
  type MoodType,
  type JournalEntry,
} from '../db';

export function JournalView() {
  const entries = useLiveQuery(() =>
    db.journals.orderBy('date').reverse().toArray()
  );

  const todayKey = getTodayKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  const activeEntry = entries?.find((e) => e.date === selectedDate);

  const openOrCreateToday = async () => {
    const existing = await db.journals.where('date').equals(todayKey).first();
    if (!existing) {
      await db.journals.add({
        date: todayKey,
        mood: 'good' as MoodType,
        sleepHours: 7,
        highlights: '',
        content: '',
        updatedAt: Date.now(),
      });
    }
    setSelectedDate(todayKey);
  };

  // Tự động chọn bài mới nhất nếu ngày đang chọn chưa có và danh sách có dữ liệu
  useEffect(() => {
    if (entries && entries.length > 0 && !activeEntry && selectedDate !== todayKey) {
      setSelectedDate(entries[0].date);
    }
  }, [entries, activeEntry, selectedDate, todayKey]);

  const updateField = async (patch: Partial<JournalEntry>) => {
    if (!activeEntry?.id) return;
    await db.journals.update(activeEntry.id, {
      ...patch,
      updatedAt: Date.now(),
    });
  };

  const deleteEntry = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    await db.journals.delete(id);
  };

  return (
    <div className="journal-layout">
      {/* Cột trái: Timeline các ngày đã viết */}
      <div className="journal-timeline">
        <div className="journal-timeline-header">
          <h2>
            <BookHeart size={18} /> Nhật ký
          </h2>
          <button className="cal-btn primary" onClick={openOrCreateToday}>
            <Plus size={14} /> Hôm nay
          </button>
        </div>

        <div className="timeline-list">
          {entries && entries.length > 0 ? (
            entries.map((entry) => {
              const moodInfo = MOOD_META[entry.mood] || MOOD_META.neutral;
              return (
                <div
                  key={entry.id}
                  className={`timeline-card ${
                    entry.date === selectedDate ? 'active' : ''
                  }`}
                  onClick={() => setSelectedDate(entry.date)}
                >
                  <div className="timeline-card-top">
                    <span className="timeline-date">
                      <Calendar size={12} /> {entry.date}
                    </span>
                    <div className="timeline-card-right">
                      <span title={moodInfo.label}>{moodInfo.emoji}</span>
                      <button
                        className="todo-del-btn"
                        onClick={(e) => deleteEntry(e, entry.id)}
                        title="Xóa nhật ký"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="timeline-preview">
                    {entry.highlights || entry.content || 'Chưa có nội dung...'}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="muted-hint">
              Chưa có trang nhật ký nào. Bấm "Hôm nay" để bắt đầu ghi lại ngày của bạn.
            </div>
          )}
        </div>
      </div>

      {/* Cột phải: Trình viết nhật ký theo Template */}
      <div className="journal-editor-area">
        {activeEntry ? (
          <div className="journal-paper">
            <div className="journal-paper-header">
              <h1>Nhật ký ngày {activeEntry.date}</h1>
              <span className="muted-hint">
                Tự động lưu cục bộ
              </span>
            </div>

            {/* Mood & Giấc ngủ */}
            <div className="journal-meta-grid">
              <div className="journal-meta-box">
                <label className="notion-prop-label">Tâm trạng hôm nay</label>
                <div className="mood-picker">
                  {(Object.keys(MOOD_META) as MoodType[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`mood-btn ${
                        activeEntry.mood === m ? 'active' : ''
                      }`}
                      onClick={() => updateField({ mood: m })}
                    >
                      <span>{MOOD_META[m].emoji}</span>
                      <span>{MOOD_META[m].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="journal-meta-box sleep-box">
                <label className="notion-prop-label">
                  <Moon size={14} /> Giấc ngủ (giờ)
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  className="modal-input"
                  value={activeEntry.sleepHours}
                  onChange={(e) =>
                    updateField({ sleepHours: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            {/* Điểm sáng trong ngày */}
            <div className="journal-block">
              <label className="notion-prop-label">
                <Sparkles size={14} /> 3 điều tốt đẹp / Điểm sáng hôm nay
              </label>
              <textarea
                className="journal-textarea"
                rows={3}
                placeholder="- Hoàn thành mục tiêu học tập...&#10;- Tập luyện đủ bài...&#10;- Một khoảnh khắc vui trong ngày..."
                value={activeEntry.highlights}
                onChange={(e) => updateField({ highlights: e.target.value })}
              />
            </div>

            {/* Nhật ký tự do */}
            <div className="journal-block">
              <label className="notion-prop-label">
                Nhật ký tự do & Suy ngẫm cuối ngày
              </label>
              <textarea
                className="journal-textarea tall"
                rows={12}
                placeholder="Hôm nay của bạn thế nào? Có điều gì cần rút kinh nghiệm cho ngày mai không..."
                value={activeEntry.content}
                onChange={(e) => updateField({ content: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <BookHeart size={36} />
            <p>Bắt đầu ghi lại nhật ký cho ngày {todayKey}</p>
            <button className="cal-btn primary" onClick={openOrCreateToday}>
              <Plus size={15} /> Tạo nhật ký hôm nay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}