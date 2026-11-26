import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  GraduationCap,
  Trophy,
  ShieldCheck,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calculator,
  FileDown,
} from 'lucide-react';
import { db, type Course, type AchievementType } from '../db';
import {
  generateSalt,
  deriveMasterKey,
  encryptText,
  decryptText,
  createVaultCheck,
  verifyVaultKey,
} from '../utils/crypto';

// Thang điểm quy đổi chuẩn ĐH (hệ 10 -> hệ 4 & điểm chữ)
const GRADE_SCALE = [
  { letter: 'A+', gpa: 4.0, min10: 9.0 },
  { letter: 'A', gpa: 3.7, min10: 8.5 },
  { letter: 'B+', gpa: 3.5, min10: 8.0 },
  { letter: 'B', gpa: 3.0, min10: 7.0 },
  { letter: 'C+', gpa: 2.5, min10: 6.5 },
  { letter: 'C', gpa: 2.0, min10: 5.5 },
  { letter: 'D+', gpa: 1.5, min10: 5.0 },
  { letter: 'D', gpa: 1.0, min10: 4.0 },
  { letter: 'F', gpa: 0.0, min10: 0.0 },
];

function score10ToGrade(score: number) {
  for (const g of GRADE_SCALE) {
    if (score >= g.min10) return g;
  }
  return GRADE_SCALE[GRADE_SCALE.length - 1];
}

function gpaToMinScore10(targetGpa: number): number {
  const found = GRADE_SCALE.find((g) => g.gpa === targetGpa);
  return found ? found.min10 : 8.5;
}

interface DecryptedVaultEntry {
  id: number;
  service: string;
  category: string;
  username: string;
  password: string;
  note: string;
}

type ProfileTab = 'academic' | 'achievements' | 'vault';

export function ProfileView() {
  const [subTab, setSubTab] = useState<ProfileTab>('academic');

  const courses = useLiveQuery(() => db.courses.toArray()) ?? [];
  const achievements =
    useLiveQuery(() =>
      db.achievements.orderBy('createdAt').reverse().toArray()
    ) ?? [];
  const vaultConfig = useLiveQuery(() => db.vaultConfig.get('main'));
  const encryptedVaultItems =
    useLiveQuery(() =>
      db.vaultItems.orderBy('updatedAt').reverse().toArray()
    ) ?? [];

  // ================== 1. STATE HỌC TẬP & GIẢ LẬP ĐIỂM ==================
  const [cSemester, setCSemester] = useState('HK1 2026-2027');
  const [cName, setCName] = useState('');
  const [cCredits, setCCredits] = useState(3);
  const [cScore10, setCScore10] = useState('');
  const [cStatus, setCStatus] = useState<'studying' | 'completed'>('studying');

  // ID môn đang mở chế độ giả lập điểm cuối kỳ
  const [simCourseId, setSimCourseId] = useState<number | null>(null);
  const [simRegular, setSimRegular] = useState(9);
  const [simRegularW, setSimRegularW] = useState(10);
  const [simProject, setSimProject] = useState(8.5);
  const [simProjectW, setSimProjectW] = useState(20);
  const [simMidterm, setSimMidterm] = useState(8);
  const [simMidtermW, setSimMidtermW] = useState(20);
  const [simTargetGpa, setSimTargetGpa] = useState(3.7);

  const openSimulator = (course: Course) => {
    setSimCourseId(course.id ?? null);
    setSimRegular(course.regularScore ?? 9);
    setSimRegularW(course.regularWeight ?? 10);
    setSimProject(course.projectScore ?? 8.5);
    setSimProjectW(course.projectWeight ?? 20);
    setSimMidterm(course.midtermScore ?? 8);
    setSimMidtermW(course.midtermWeight ?? 20);
    setSimTargetGpa(course.targetGpa ?? 3.7);
  };

  const finalWeight = Math.max(0, 100 - simRegularW - simProjectW - simMidtermW);
  const currentWeightedPoints =
    (simRegular * simRegularW +
      simProject * simProjectW +
      simMidterm * simMidtermW) /
    100;
  const targetScore10 = gpaToMinScore10(simTargetGpa);
  const requiredFinalScore =
    finalWeight > 0
      ? ((targetScore10 - currentWeightedPoints) * 100) / finalWeight
      : null;

  const saveSimulatorToCourse = async () => {
    if (!simCourseId) return;
    await db.courses.update(simCourseId, {
      regularScore: simRegular,
      regularWeight: simRegularW,
      projectScore: simProject,
      projectWeight: simProjectW,
      midtermScore: simMidterm,
      midtermWeight: simMidtermW,
      targetGpa: simTargetGpa,
    });
    alert('Đã lưu điểm thành phần vào môn học!');
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) return;
    const parsedScore =
      cStatus === 'completed' && cScore10.trim() !== ''
        ? Math.min(10, Math.max(0, Number(cScore10)))
        : null;
    await db.courses.add({
      semester: cSemester.trim() || 'Chung',
      name: cName.trim(),
      credits: Number(cCredits) || 3,
      score10: parsedScore,
      status: cStatus,
      regularScore: 9,
      regularWeight: 10,
      projectScore: 8.5,
      projectWeight: 20,
      midtermScore: 8,
      midtermWeight: 20,
      targetGpa: 3.7,
    });
    setCName('');
    setCScore10('');
  };

  const deleteCourse = async (id?: number) => {
    if (!id) return;
    await db.courses.delete(id);
    if (simCourseId === id) setSimCourseId(null);
  };

  // Tính CPA tích lũy & GPA từng học kỳ
  const academicStats = useMemo(() => {
    let totalCredits = 0;
    let totalGpaPoints = 0;
    let totalScore10Points = 0;
    const bySemester: Record<string, { credits: number; gpaSum: number; list: Course[] }> = {};

    for (const c of courses) {
      if (!bySemester[c.semester]) {
        bySemester[c.semester] = { credits: 0, gpaSum: 0, list: [] };
      }
      bySemester[c.semester].list.push(c);

      if (c.status === 'completed' && c.score10 !== null) {
        const g = score10ToGrade(c.score10);
        totalCredits += c.credits;
        totalGpaPoints += g.gpa * c.credits;
        totalScore10Points += c.score10 * c.credits;
        bySemester[c.semester].credits += c.credits;
        bySemester[c.semester].gpaSum += g.gpa * c.credits;
      }
    }

    return {
      totalCredits,
      cpa4: totalCredits > 0 ? totalGpaPoints / totalCredits : 0,
      cpa10: totalCredits > 0 ? totalScore10Points / totalCredits : 0,
      bySemester,
    };
  }, [courses]);

  // ================== 2. STATE THÀNH TÍCH & CV ==================
  const [aType, setAType] = useState<AchievementType>('award');
  const [aTitle, setATitle] = useState('');
  const [aTime, setATime] = useState('');
  const [aOrg, setAOrg] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aLink, setALink] = useState('');
  const [copiedCv, setCopiedCv] = useState(false);

  const addAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aTitle.trim()) return;
    await db.achievements.add({
      type: aType,
      title: aTitle.trim(),
      time: aTime.trim(),
      organization: aOrg.trim(),
      description: aDesc.trim(),
      link: aLink.trim(),
      createdAt: Date.now(),
    });
    setATitle('');
    setATime('');
    setAOrg('');
    setADesc('');
    setALink('');
  };

  const deleteAchievement = async (id?: number) => {
    if (id) await db.achievements.delete(id);
  };

  const copyCvMarkdown = async () => {
    const awards = achievements.filter((a) => a.type === 'award');
    const projects = achievements.filter((a) => a.type === 'project');
    const activities = achievements.filter((a) => a.type === 'activity');

    const lines: string[] = [
      '# HỒ SƠ CÁ NHÂN (CV SUMMARY)',
      '',
      '## Học vấn',
      `- **CPA tích lũy:** ${academicStats.cpa4.toFixed(2)} / 4.0 (${academicStats.cpa10.toFixed(2)} / 10) — ${academicStats.totalCredits} tín chỉ`,
      '',
    ];

    if (awards.length > 0) {
      lines.push('## Giải thưởng & Thành tích');
      awards.forEach((a) =>
        lines.push(`- **${a.title}** (${a.time}) — *${a.organization}*: ${a.description}`)
      );
      lines.push('');
    }
    if (projects.length > 0) {
      lines.push('## Dự án cá nhân');
      projects.forEach((p) =>
        lines.push(
          `- **${p.title}** (${p.time}) ${p.link ? `[Link](${p.link})` : ''}: ${p.description}`
        )
      );
      lines.push('');
    }
    if (activities.length > 0) {
      lines.push('## Hoạt động ngoại khóa');
      activities.forEach((ac) =>
        lines.push(`- **${ac.title}** — *${ac.organization}* (${ac.time}): ${ac.description}`)
      );
      lines.push('');
    }

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedCv(true);
    setTimeout(() => setCopiedCv(false), 2000);
  };

  // ================== 3. STATE KÉT SẮT MẬT KHẨU AES-GCM ==================
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [masterInput, setMasterInput] = useState('');
  const [masterConfirm, setMasterConfirm] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [decryptedItems, setDecryptedItems] = useState<DecryptedVaultEntry[]>([]);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [vaultSearch, setVaultSearch] = useState('');

  // Form thêm tài khoản mới
  const [vService, setVService] = useState('');
  const [vCategory, setVCategory] = useState('Mạng xã hội');
  const [vUser, setVUser] = useState('');
  const [vPass, setVPass] = useState('');
  const [vNote, setVNote] = useState('');

  // Tự động khóa két sắt khi rời tab Két sắt
  useEffect(() => {
    if (subTab !== 'vault' && masterKey) {
      setMasterKey(null);
      setDecryptedItems([]);
      setRevealedIds({});
    }
  }, [subTab, masterKey]);

  // Tự động giải mã danh sách khi mở khóa hoặc khi thêm/xóa
  useEffect(() => {
    if (!masterKey) return;
    let cancelled = false;
    (async () => {
      const results: DecryptedVaultEntry[] = [];
      for (const item of encryptedVaultItems) {
        if (!item.id) continue;
        try {
          const jsonStr = await decryptText(masterKey, item.iv, item.ciphertext);
          const data = JSON.parse(jsonStr);
          results.push({ id: item.id, ...data });
        } catch {
          // Bỏ qua item không khớp khóa
        }
      }
      if (!cancelled) setDecryptedItems(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [masterKey, encryptedVaultItems]);

  const handleSetupVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    if (masterInput.length < 6) {
      setVaultError('Mật khẩu chủ phải dài ít nhất 6 ký tự.');
      return;
    }
    if (masterInput !== masterConfirm) {
      setVaultError('Mật khẩu xác nhận không khớp.');
      return;
    }
    const salt = generateSalt();
    const key = await deriveMasterKey(masterInput, salt);
    const check = await createVaultCheck(key);
    await db.vaultConfig.put({
      id: 'main',
      salt,
      checkIv: check.iv,
      checkCiphertext: check.ciphertext,
    });
    setMasterKey(key);
    setMasterInput('');
    setMasterConfirm('');
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    if (!vaultConfig) return;
    const key = await deriveMasterKey(masterInput, vaultConfig.salt);
    const ok = await verifyVaultKey(
      key,
      vaultConfig.checkIv,
      vaultConfig.checkCiphertext
    );
    if (!ok) {
      setVaultError('Sai mật khẩu chủ! Vui lòng thử lại.');
      return;
    }
    setMasterKey(key);
    setMasterInput('');
  };

  const handleAddVaultItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey || !vService.trim() || !vPass.trim()) return;
    const payload = JSON.stringify({
      service: vService.trim(),
      category: vCategory,
      username: vUser.trim(),
      password: vPass,
      note: vNote.trim(),
    });
    const encrypted = await encryptText(masterKey, payload);
    await db.vaultItems.add({
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      updatedAt: Date.now(),
    });
    setVService('');
    setVUser('');
    setVPass('');
    setVNote('');
  };

  const handleDeleteVaultItem = async (id: number) => {
    await db.vaultItems.delete(id);
  };

  const toggleReveal = (id: number) => {
    const nextState = !revealedIds[id];
    setRevealedIds((prev) => ({ ...prev, [id]: nextState }));
    // Tự động ẩn lại sau 15 giây
    if (nextState) {
      setTimeout(() => {
        setRevealedIds((prev) => ({ ...prev, [id]: false }));
      }, 15000);
    }
  };

  const copySecret = async (id: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredVaultItems = decryptedItems.filter(
    (item) =>
      item.service.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      item.username.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(vaultSearch.toLowerCase())
  );

  const simCourse = courses.find((c) => c.id === simCourseId);

  return (
    <div className="planner-wrapper">
      <div className="profile-header">
        <h1>Hồ sơ cá nhân & Két sắt</h1>
        <div className="profile-tabs">
          <button
            className={`profile-tab-btn ${subTab === 'academic' ? 'active' : ''}`}
            onClick={() => setSubTab('academic')}
          >
            <GraduationCap size={15} /> Học tập & GPA
          </button>
          <button
            className={`profile-tab-btn ${subTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setSubTab('achievements')}
          >
            <Trophy size={15} /> Thành tích & CV
          </button>
          <button
            className={`profile-tab-btn ${subTab === 'vault' ? 'active' : ''}`}
            onClick={() => setSubTab('vault')}
          >
            <ShieldCheck size={15} /> Két sắt mật khẩu
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: HỌC TẬP & GPA ===================== */}
      {subTab === 'academic' && (
        <div className="profile-section">
          <div className="stats-strip">
            <div className="stat-box">
              <span className="stat-label">CPA (Hệ 4)</span>
              <span className="stat-val accent">
                {academicStats.cpa4.toFixed(2)}
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Trung bình (Hệ 10)</span>
              <span className="stat-val">{academicStats.cpa10.toFixed(2)}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Tín chỉ tích lũy</span>
              <span className="stat-val">{academicStats.totalCredits}</span>
            </div>
          </div>

          {/* Form thêm môn học */}
          <form className="course-add-form" onSubmit={addCourse}>
            <input
              type="text"
              className="modal-input"
              placeholder="Học kỳ (vd: HK1 2026-2027)"
              value={cSemester}
              onChange={(e) => setCSemester(e.target.value)}
            />
            <input
              type="text"
              className="modal-input"
              placeholder="Tên môn học..."
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              required
            />
            <input
              type="number"
              min={1}
              max={15}
              className="modal-input"
              placeholder="Tín chỉ"
              value={cCredits}
              onChange={(e) => setCCredits(Number(e.target.value))}
            />
            <select
              className="modal-input"
              value={cStatus}
              onChange={(e) =>
                setCStatus(e.target.value as 'studying' | 'completed')
              }
            >
              <option value="studying">Đang học</option>
              <option value="completed">Đã có điểm</option>
            </select>
            {cStatus === 'completed' && (
              <input
                type="number"
                step={0.1}
                min={0}
                max={10}
                className="modal-input"
                placeholder="Điểm hệ 10"
                value={cScore10}
                onChange={(e) => setCScore10(e.target.value)}
              />
            )}
            <button type="submit" className="cal-btn primary">
              <Plus size={14} /> Thêm môn
            </button>
          </form>

          {/* Chế độ giả lập điểm cuối kỳ cho từng môn */}
          <div className="simulator-card">
            <div className="dash-card-header">
              <h3>
                <Calculator size={16} /> Chế độ giả lập điểm cuối kỳ{' '}
                {simCourse ? `— ${simCourse.name}` : '(Chọn môn ở bảng dưới hoặc tính nhanh)'}
              </h3>
              {simCourse && (
                <button
                  type="button"
                  className="cal-btn primary"
                  onClick={saveSimulatorToCourse}
                >
                  Lưu vào môn này
                </button>
              )}
            </div>

            <div className="sim-grid">
              <div className="sim-field">
                <label>Điểm thường xuyên (0–10)</label>
                <div className="sim-pair">
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    className="modal-input"
                    value={simRegular}
                    onChange={(e) => setSimRegular(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="modal-input weight-input"
                    value={simRegularW}
                    onChange={(e) => setSimRegularW(Number(e.target.value))}
                    title="Trọng số (%)"
                  />
                  <span className="muted-hint">%</span>
                </div>
              </div>

              <div className="sim-field">
                <label>Điểm bài tập lớn (0–10)</label>
                <div className="sim-pair">
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    className="modal-input"
                    value={simProject}
                    onChange={(e) => setSimProject(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="modal-input weight-input"
                    value={simProjectW}
                    onChange={(e) => setSimProjectW(Number(e.target.value))}
                    title="Trọng số (%)"
                  />
                  <span className="muted-hint">%</span>
                </div>
              </div>

              <div className="sim-field">
                <label>Điểm thi giữa kỳ (0–10)</label>
                <div className="sim-pair">
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    className="modal-input"
                    value={simMidterm}
                    onChange={(e) => setSimMidterm(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="modal-input weight-input"
                    value={simMidtermW}
                    onChange={(e) => setSimMidtermW(Number(e.target.value))}
                    title="Trọng số (%)"
                  />
                  <span className="muted-hint">%</span>
                </div>
              </div>

              <div className="sim-field">
                <label>GPA mục tiêu môn đó</label>
                <select
                  className="modal-input"
                  value={simTargetGpa}
                  onChange={(e) => setSimTargetGpa(Number(e.target.value))}
                >
                  {GRADE_SCALE.filter((g) => g.gpa > 0).map((g) => (
                    <option key={g.letter} value={g.gpa}>
                      {g.gpa.toFixed(1)} — {g.letter} (≥ {g.min10} hệ 10)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sim-result-bar">
              <div>
                <span className="muted-hint">
                  Trọng số cuối kỳ còn lại: <strong>{finalWeight}%</strong> | Điểm thành phần đã có:{' '}
                  <strong>{currentWeightedPoints.toFixed(2)}</strong>
                </span>
              </div>
              <div className="sim-final-output">
                {finalWeight <= 0 ? (
                  <span className="sim-warn">Tổng trọng số thành phần đang ≥ 100%!</span>
                ) : requiredFinalScore !== null && requiredFinalScore <= 0 ? (
                  <span className="sim-ok">
                    Đã đủ điểm mục tiêu! (Chỉ cần qua điểm liệt)
                  </span>
                ) : requiredFinalScore !== null && requiredFinalScore > 10 ? (
                  <span className="sim-warn">
                    Cần {requiredFinalScore.toFixed(2)}/10 (Vượt quá 10 — không thể đạt mức này)
                  </span>
                ) : (
                  <span>
                    Điểm thi cuối kỳ cần đạt:{' '}
                    <strong className="sim-score-highlight">
                      {requiredFinalScore?.toFixed(2)} / 10
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bảng danh sách môn học theo kỳ */}
          {Object.entries(academicStats.bySemester).map(([sem, info]) => {
            const semGpa = info.credits > 0 ? info.gpaSum / info.credits : 0;
            return (
              <div key={sem} className="semester-block">
                <div className="semester-title-row">
                  <h3>{sem}</h3>
                  <span className="habit-cat-badge">
                    GPA kỳ: {semGpa.toFixed(2)} ({info.credits} TC)
                  </span>
                </div>
                <div className="habit-table-wrap">
                  <table className="habit-table">
                    <thead>
                      <tr>
                        <th>Môn học</th>
                        <th>TC</th>
                        <th>Trạng thái</th>
                        <th>Hệ 10</th>
                        <th>Điểm chữ / Hệ 4</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.list.map((c) => {
                        const grade =
                          c.status === 'completed' && c.score10 !== null
                            ? score10ToGrade(c.score10)
                            : null;
                        return (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td>{c.credits}</td>
                            <td>
                              <span className="habit-cat-badge">
                                {c.status === 'completed' ? 'Hoàn thành' : 'Đang học'}
                              </span>
                            </td>
                            <td>{c.score10 !== null ? c.score10.toFixed(1) : '—'}</td>
                            <td>
                              {grade ? `${grade.letter} (${grade.gpa.toFixed(1)})` : '—'}
                            </td>
                            <td style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="cal-btn"
                                onClick={() => openSimulator(c)}
                                title="Giả lập điểm cuối kỳ cho môn này"
                              >
                                <Calculator size={13} /> Giả lập
                              </button>
                              <button
                                className="todo-del-btn"
                                onClick={() => deleteCourse(c.id)}
                                title="Xóa môn"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== TAB 2: THÀNH TÍCH & CV ===================== */}
      {subTab === 'achievements' && (
        <div className="profile-section">
          <div className="section-header-row">
            <h2>Thành tích, Hoạt động & Dự án</h2>
            <button className="cal-btn primary" onClick={copyCvMarkdown}>
              {copiedCv ? <Check size={14} /> : <FileDown size={14} />}
              {copiedCv ? 'Đã copy Markdown CV!' : 'Copy dạng CV Markdown'}
            </button>
          </div>

          <form className="goal-create-card" onSubmit={addAchievement}>
            <div className="goal-form-grid">
              <input
                type="text"
                className="modal-input"
                placeholder="Tên giải thưởng / Dự án / Vai trò..."
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                required
              />
              <select
                className="modal-input"
                value={aType}
                onChange={(e) => setAType(e.target.value as AchievementType)}
              >
                <option value="award">Giải thưởng / Cuộc thi</option>
                <option value="project">Dự án cá nhân</option>
                <option value="activity">Hoạt động ngoại khóa</option>
              </select>
            </div>
            <div className="goal-form-metrics">
              <input
                type="text"
                className="modal-input"
                placeholder="Thời gian (vd: 12/2025)"
                value={aTime}
                onChange={(e) => setATime(e.target.value)}
              />
              <input
                type="text"
                className="modal-input"
                placeholder="Tổ chức / Công nghệ sử dụng"
                value={aOrg}
                onChange={(e) => setAOrg(e.target.value)}
              />
              <input
                type="text"
                className="modal-input"
                placeholder="Link GitHub / Minh chứng (tùy chọn)"
                value={aLink}
                onChange={(e) => setALink(e.target.value)}
              />
            </div>
            <textarea
              className="notion-note-input"
              rows={2}
              placeholder="Mô tả ngắn gọn đóng góp hoặc kết quả đạt được..."
              value={aDesc}
              onChange={(e) => setADesc(e.target.value)}
            />
            <div className="modal-actions">
              <button type="submit" className="cal-btn primary">
                <Plus size={14} /> Lưu thành tích
              </button>
            </div>
          </form>

          <div className="goals-grid">
            {achievements.map((item) => (
              <div key={item.id} className="goal-card">
                <div className="goal-card-top">
                  <div>
                    <span className="habit-cat-badge">
                      {item.type === 'award'
                        ? 'Giải thưởng'
                        : item.type === 'project'
                        ? 'Dự án'
                        : 'Hoạt động'}
                    </span>
                    <h3>{item.title}</h3>
                  </div>
                  <button
                    className="todo-del-btn"
                    onClick={() => deleteAchievement(item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="muted-hint">
                  {item.organization} {item.time ? `• ${item.time}` : ''}
                </div>
                {item.description && <p style={{ fontSize: 13 }}>{item.description}</p>}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn"
                  >
                    Xem liên kết →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== TAB 3: KÉT SẮT MẬT KHẨU ===================== */}
      {subTab === 'vault' && (
        <div className="profile-section">
          {!masterKey ? (
            <form
              className="vault-lock-box"
              onSubmit={vaultConfig ? handleUnlockVault : handleSetupVault}
            >
              <Lock size={34} />
              <h2>
                {vaultConfig
                  ? 'Mở khóa Két sắt Mật khẩu'
                  : 'Thiết lập Mật khẩu Chủ (Master Password)'}
              </h2>
              <p className="muted-hint" style={{ textAlign: 'center' }}>
                Toàn bộ mật khẩu được mã hóa AES-GCM 256-bit trước khi lưu. Mật khẩu chủ không bao giờ được lưu xuống máy — hãy ghi nhớ thật kỹ!
              </p>

              <input
                type="password"
                className="modal-input"
                placeholder="Nhập mật khẩu chủ..."
                value={masterInput}
                onChange={(e) => setMasterInput(e.target.value)}
                required
              />

              {!vaultConfig && (
                <input
                  type="password"
                  className="modal-input"
                  placeholder="Nhập lại mật khẩu chủ..."
                  value={masterConfirm}
                  onChange={(e) => setMasterConfirm(e.target.value)}
                  required
                />
              )}

              {vaultError && <div className="sim-warn">{vaultError}</div>}

              <button type="submit" className="cal-btn primary">
                <Unlock size={15} />{' '}
                {vaultConfig ? 'Mở khóa' : 'Tạo Két sắt bảo mật'}
              </button>
            </form>
          ) : (
            <>
              <div className="section-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2>Két sắt đang mở khóa (AES-GCM)</h2>
                  <input
                    type="text"
                    className="modal-input"
                    style={{ width: 220 }}
                    placeholder="Lọc dịch vụ, tài khoản..."
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                  />
                </div>
                <button
                  className="cal-btn"
                  onClick={() => {
                    setMasterKey(null);
                    setDecryptedItems([]);
                    setRevealedIds({});
                  }}
                >
                  <Lock size={14} /> Khóa ngay
                </button>
              </div>

              <form className="goal-create-card" onSubmit={handleAddVaultItem}>
                <div className="goal-form-grid">
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Tên dịch vụ (vd: Facebook, MB Bank, GitHub)..."
                    value={vService}
                    onChange={(e) => setVService(e.target.value)}
                    required
                  />
                  <select
                    className="modal-input"
                    value={vCategory}
                    onChange={(e) => setVCategory(e.target.value)}
                  >
                    <option value="Mạng xã hội">Mạng xã hội</option>
                    <option value="Ngân hàng">Ngân hàng</option>
                    <option value="Học tập / Email">Học tập / Email</option>
                    <option value="Dev / Server">Dev / Server</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div className="goal-form-metrics">
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Tên đăng nhập / Email / SĐT"
                    value={vUser}
                    onChange={(e) => setVUser(e.target.value)}
                  />
                  <input
                    type="password"
                    className="modal-input"
                    placeholder="Mật khẩu / Mã PIN..."
                    value={vPass}
                    onChange={(e) => setVPass(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Ghi chú (2FA, số TK...)"
                    value={vNote}
                    onChange={(e) => setVNote(e.target.value)}
                  />
                </div>
                <div className="modal-actions">
                  <button type="submit" className="cal-btn primary">
                    <Plus size={14} /> Mã hóa & Lưu
                  </button>
                </div>
              </form>

              <div className="goals-grid">
                {filteredVaultItems.map((item) => {
                  const revealed = Boolean(revealedIds[item.id]);
                  return (
                    <div key={item.id} className="goal-card">
                      <div className="goal-card-top">
                        <div>
                          <span className="habit-cat-badge">{item.category}</span>
                          <h3>{item.service}</h3>
                        </div>
                        <button
                          className="todo-del-btn"
                          onClick={() => handleDeleteVaultItem(item.id)}
                          title="Xóa tài khoản"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="vault-row">
                        <span className="muted-hint">Tài khoản:</span>
                        <code>{item.username || '—'}</code>
                      </div>

                      <div className="vault-row">
                        <span className="muted-hint">Mật khẩu:</span>
                        <code>{revealed ? item.password : '••••••••••••'}</code>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="icon-btn"
                            onClick={() => toggleReveal(item.id)}
                            title={revealed ? 'Ẩn' : 'Hiện (tự ẩn sau 15s)'}
                          >
                            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => copySecret(item.id, item.password)}
                            title="Copy mật khẩu"
                          >
                            {copiedId === item.id ? (
                              <Check size={14} color="#4dab9a" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </div>

                      {item.note && (
                        <div className="muted-hint" style={{ fontSize: 12 }}>
                          Ghi chú: {item.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}