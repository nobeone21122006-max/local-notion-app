import { ProfileView } from './components/ProfileView';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Moon,
  Sun,
  Download,
  Upload,
  FolderSync,
  Pin,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  CalendarDays,
  BookHeart,
  Target,
  LayoutDashboard,
  UserCheck,
  Tag,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  db,
  exportDatabase,
  importDatabase,
  syncToLocalFolder,
  getDaysSinceLastBackup,
  extractTextFromBlocks,
  type Page,
} from './db';
import { Editor } from './components/Editor';
import { Guide } from './components/Guide';
import { CalendarView } from './components/CalendarView';
import { DashboardView } from './components/DashboardView';
import { JournalView } from './components/JournalView';
import { PlannerView } from './components/PlannerView';
import {
  getSavedGitHubToken,
  saveGitHubToken,
  pushToGitHub,
  pullFromGitHub,
} from './utils/githubSync';
interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

type ActiveView = 'dashboard' | 'journal' | 'planner' | 'calendar' | 'profile' | 'page' | 'guide';

export default function App() {
  const pages = useLiveQuery(() => db.pages.toArray());

  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [tagInput, setTagInput] = useState('');
  const [backupReminder, setBackupReminder] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Kiểm tra nhắc nhở sao lưu quá 7 ngày
  useEffect(() => {
    const days = getDaysSinceLastBackup();
    if (days !== null && days >= 7) {
      setBackupReminder(true);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activePage = pages?.find((p) => p.id === activeId);

  const searchResults = useMemo(() => {
    if (!pages || !search.trim()) return null;
    const q = search.toLowerCase().trim();
    return pages.filter((p) => {
      const inTitle = p.title.toLowerCase().includes(q);
      const inTags = p.tags?.some((t) => t.toLowerCase().includes(q));
      const inContent = extractTextFromBlocks(p.content)
        .toLowerCase()
        .includes(q);
      return inTitle || inTags || inContent;
    });
  }, [pages, search]);

  const pinnedPages = useMemo(
    () => pages?.filter((p) => p.isPinned) ?? [],
    [pages]
  );

  const headings = useMemo<HeadingItem[]>(() => {
    if (!activePage?.content) return [];
    const list: HeadingItem[] = [];
    for (const block of activePage.content) {
      if (block.type === 'heading') {
        const text = Array.isArray(block.content)
          ? block.content.map((c: any) => c.text || '').join('')
          : '';
        if (text.trim()) {
          list.push({
            id: block.id,
            text: text.trim(),
            level: block.props?.level || 1,
          });
        }
      }
    }
    return list;
  }, [activePage?.content]);

  const createPage = async (parentId: number | null = null) => {
    const id = await db.pages.add({
      title: 'Trang mới',
      content: [],
      parentId,
      isPinned: false,
      tags: [],
      updatedAt: Date.now(),
    });
    if (parentId !== null) {
      setExpandedIds((prev) => ({ ...prev, [parentId]: true }));
    }
    setActiveView('page');
    setActiveId(Number(id));
  };

  const deletePage = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    const children = await db.pages.where('parentId').equals(id).toArray();
    for (const child of children) {
      if (child.id) await db.pages.update(child.id, { parentId: null });
    }
    await db.pages.delete(id);
    if (activeId === id) setActiveId(null);
  };

  const togglePin = async (e: React.MouseEvent, page: Page) => {
    e.stopPropagation();
    if (!page.id) return;
    await db.pages.update(page.id, { isPinned: !page.isPinned });
  };

  const updateTitle = async (newTitle: string) => {
    if (!activePage?.id) return;
    await db.pages.update(activePage.id, {
      title: newTitle,
      updatedAt: Date.now(),
    });
  };

  const updateContent = async (newContent: any[]) => {
    if (!activePage?.id) return;
    await db.pages.update(activePage.id, {
      content: newContent,
      updatedAt: Date.now(),
    });
  };

  const addTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !tagInput.trim() || !activePage?.id) return;
    e.preventDefault();
    const newTag = tagInput.trim();
    const currentTags = activePage.tags || [];
    if (!currentTags.includes(newTag)) {
      await db.pages.update(activePage.id, {
        tags: [...currentTags, newTag],
      });
    }
    setTagInput('');
  };

  const removeTag = async (tagToRemove: string) => {
    if (!activePage?.id) return;
    await db.pages.update(activePage.id, {
      tags: (activePage.tags || []).filter((t) => t !== tagToRemove),
    });
  };

  const scrollToHeading = (blockId: string) => {
    const el = document.querySelector(`[data-id="${blockId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleBackup = async () => {
    await exportDatabase();
    setBackupReminder(false);
  };

  const handleSyncFolder = async () => {
    try {
      const msg = await syncToLocalFolder();
      setBackupReminder(false);
      alert(msg);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert('Không thể ghi vào thư mục đã chọn.');
      }
    }
  };

  const [syncing, setSyncing] = useState(false);

const ensureToken = (): boolean => {
  let token = getSavedGitHubToken();
  if (!token) {
    const input = window.prompt(
      'Nhập GitHub Personal Access Token (ghp_...) có quyền repo để đồng bộ:'
    );
    if (!input) return false;
    saveGitHubToken(input);
  }
  return true;
};

const handleCloudPush = async () => {
  if (!ensureToken()) return;
  try {
    setSyncing(true);
    await pushToGitHub();
    alert('✅ Đã đẩy dữ liệu mới nhất lên GitHub!');
  } catch (err: any) {
    alert('❌ Lỗi Push: ' + err.message);
  } finally {
    setSyncing(false);
  }
};

const handleCloudPull = async () => {
  if (!ensureToken()) return;
  if (!window.confirm('Tải dữ liệu từ GitHub về sẽ cập nhật lại thiết bị này. Tiếp tục?')) {
    return;
  }
  try {
    setSyncing(true);
    await pullFromGitHub();
    alert('✅ Đã đồng bộ dữ liệu từ GitHub về máy!');
  } catch (err: any) {
    alert('❌ Lỗi Pull: ' + err.message);
  } finally {
    setSyncing(false);
  }
};

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importDatabase(file);
      alert('Nhập dữ liệu thành công!');
    } catch {
      alert('Lỗi: File JSON không đúng định dạng.');
    }
    e.target.value = '';
  };

  const renderPageTree = (parentId: number | null = null, depth = 0) => {
    if (!pages) return null;
    const children = pages.filter((p) => (p.parentId ?? null) === parentId);
    if (children.length === 0) return null;

    return children.map((page) => {
      const hasChildren = pages.some((p) => p.parentId === page.id);
      const isExpanded = Boolean(page.id && expandedIds[page.id]);

      return (
        <div key={page.id}>
          <div
            className={`page-item ${
              activeView === 'page' && page.id === activeId ? 'active' : ''
            }`}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            onClick={() => {
              setActiveView('page');
              setActiveId(page.id ?? null);
            }}
          >
            <div className="page-item-left">
              <button
                className="chevron-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (page.id) {
                    setExpandedIds((prev) => ({
                      ...prev,
                      [page.id!]: !prev[page.id!],
                    }));
                  }
                }}
                style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              <FileText size={14} />
              <span className="page-title-text">
                {page.title || 'Không tiêu đề'}
              </span>
            </div>
            <div className="page-actions">
              <button
                className="action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  createPage(page.id ?? null);
                }}
                title="Thêm trang con"
              >
                <Plus size={13} />
              </button>
              <button
                className={`action-btn ${page.isPinned ? 'pinned' : ''}`}
                onClick={(e) => togglePin(e, page)}
                title={page.isPinned ? 'Bỏ ghim' : 'Ghim trang'}
              >
                <Pin size={13} />
              </button>
              <button
                className="action-btn delete-btn"
                onClick={(e) => deletePage(e, page.id)}
                title="Xóa trang"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {isExpanded && renderPageTree(page.id ?? null, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="brand">Local Notion</span>
            <div className="header-actions">
              <button
                className="icon-btn"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Đổi giao diện Sáng/Tối"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                className="icon-btn"
                onClick={() => setSidebarOpen(false)}
                title="Ẩn Sidebar (Ctrl+\)"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
          </div>

          <div className="search-box">
            <Search size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Tìm toàn văn (Ctrl+K)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Menu điều hướng chính */}
          <div className="nav-group">
            <button
              className={`guide-nav-btn ${activeView === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveView('profile')}
            >
              <UserCheck size={15} />
              <span>Hồ sơ & Két sắt</span>
            </button>
            <button
              className={`guide-nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={15} />
              <span>Hôm nay (Dashboard)</span>
            </button>
            <button
              className={`guide-nav-btn ${activeView === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveView('journal')}
            >
              <BookHeart size={15} />
              <span>Nhật ký hằng ngày</span>
            </button>
            <button
              className={`guide-nav-btn ${activeView === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveView('planner')}
            >
              <Target size={15} />
              <span>Kế hoạch & Thói quen</span>
            </button>
            <button
              className={`guide-nav-btn ${activeView === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveView('calendar')}
            >
              <CalendarDays size={15} />
              <span>Bảng lịch (Calendar)</span>
            </button>
          </div>

          <button className="new-page-btn" onClick={() => createPage(null)}>
            <Plus size={15} />
            <span>Tạo trang tài liệu</span>
          </button>

          <nav className="page-list">
            {searchResults ? (
              <>
                <div className="section-label">
                  Kết quả tìm kiếm ({searchResults.length})
                </div>
                {searchResults.map((page) => (
                  <div
                    key={page.id}
                    className={`page-item ${
                      activeView === 'page' && page.id === activeId ? 'active' : ''
                    }`}
                    onClick={() => {
                      setActiveView('page');
                      setActiveId(page.id ?? null);
                    }}
                  >
                    <div className="page-item-left">
                      <FileText size={14} />
                      <span className="page-title-text">
                        {page.title || 'Không tiêu đề'}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {pinnedPages.length > 0 && (
                  <div className="sidebar-section">
                    <div className="section-label">Đã ghim</div>
                    {pinnedPages.map((page) => (
                      <div
                        key={`pin-${page.id}`}
                        className={`page-item ${
                          activeView === 'page' && page.id === activeId
                            ? 'active'
                            : ''
                        }`}
                        onClick={() => {
                          setActiveView('page');
                          setActiveId(page.id ?? null);
                        }}
                      >
                        <div className="page-item-left">
                          <Pin size={13} className="pinned-icon" />
                          <span className="page-title-text">
                            {page.title || 'Không tiêu đề'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sidebar-section">
                  <div className="section-label">Tài liệu</div>
                  {renderPageTree(null, 0)}
                </div>
              </>
            )}
          </nav>

          <div className="sidebar-bottom">
            {backupReminder && (
              <div className="backup-alert">
                <AlertTriangle size={13} />
                <span>Đã quá 7 ngày chưa sao lưu!</span>
              </div>
            )}

            <button
              className={`guide-nav-btn ${activeView === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveView('guide')}
            >
              <BookOpen size={15} />
              <span>Hướng dẫn sử dụng</span>
            </button>

            <button className="footer-btn full-width" onClick={handleSyncFolder}>
              <FolderSync size={13} /> Lưu ra thư mục (.json + .md)
            </button>

            <div className="sidebar-footer">
              <button className="footer-btn" onClick={handleBackup}>
                <Download size={13} /> Backup JSON
              </button>
              <button
                className="footer-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} /> Khôi phục
              </button>
              <button
                className="sidebar-action-btn"
                onClick={handleCloudPush}
                disabled={syncing}
                title="Đẩy dữ liệu lên GitHub Repo"
              >
                <Upload size={14} />
                <span>{syncing ? 'Đang xử lý...' : 'Đẩy lên Cloud'}</span>
              </button>
              <button
                className="sidebar-action-btn"
                onClick={handleCloudPull}
                disabled={syncing}
                title="Kéo dữ liệu từ GitHub Repo về máy"
              >
                <Download size={14} />
                <span>{syncing ? 'Đang xử lý...' : 'Kéo từ Cloud'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
            </div>
          </div>
        </aside>
      )}

      <main className="main-content">
        {!sidebarOpen && (
          <button
            className="floating-open-btn"
            onClick={() => setSidebarOpen(true)}
            title="Hiện Sidebar (Ctrl+\)"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}

        {activeView === 'dashboard' ? (
          <DashboardView onNavigate={(v) => setActiveView(v)} />
        ) : activeView === 'journal' ? (
          <JournalView />
        ) : activeView === 'planner' ? (
          <PlannerView />
        ) : activeView === 'calendar' ? (
          <CalendarView />
        ) : activeView === 'profile' ? (
          <ProfileView />
        ) : activeView === 'guide' ? (
          <Guide />
        ) : activePage ? (
          <div className="workspace-grid">
            <div className="editor-container">
              <input
                className="title-input"
                value={activePage.title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="Tiêu đề trang..."
              />

              <div className="tags-bar">
                <Tag size={14} className="tag-icon" />
                {(activePage.tags || []).map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button onClick={() => removeTag(tag)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  className="tag-input"
                  placeholder="+ Thêm tag (Enter)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                />
              </div>

              <Editor
                key={`${activePage.id}-${activeView}`}
                initialContent={activePage.content}
                onChange={updateContent}
                theme={theme}
              />
            </div>

            {headings.length > 0 && (
              <aside className="toc-panel">
                <div className="toc-title">Mục lục</div>
                {headings.map((h) => (
                  <button
                    key={h.id}
                    className={`toc-item toc-level-${h.level}`}
                    onClick={() => scrollToHeading(h.id)}
                  >
                    {h.text}
                  </button>
                ))}
              </aside>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <p>Chưa có trang tài liệu nào được chọn.</p>
            <button className="new-page-btn" onClick={() => createPage(null)}>
              <Plus size={16} /> Tạo trang đầu tiên
            </button>
          </div>
        )}
      </main>
    </div>
  );
}