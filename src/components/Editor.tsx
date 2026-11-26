import React, { useState } from 'react';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  insertOrUpdateBlock,
} from '@blocknote/core';
import {
  useCreateBlockNote,
  createReactBlockSpec,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { Sigma, Lightbulb, Code2, Calendar } from 'lucide-react';

function MathBlockView({ block, editor }: { block: any; editor: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const formula = block.props.formula;

  const html = katex.renderToString(formula || '\\text{Nhập công thức...}', {
    throwOnError: false,
    displayMode: true,
  });

  return (
    <div className="math-block" contentEditable={false}>
      {isEditing ? (
        <div className="math-editor-box">
          <input
            type="text"
            autoFocus
            className="math-input"
            value={formula}
            placeholder="Ví dụ: a^2 + b^2 = c^2"
            onChange={(e) =>
              editor.updateBlock(block, {
                props: { formula: e.target.value },
              })
            }
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setIsEditing(false);
              }
            }}
          />
          <div
            className="math-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        <div
          className="math-rendered"
          onClick={() => setIsEditing(true)}
          title="Bấm để sửa công thức LaTeX"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

const MathBlock = createReactBlockSpec(
  {
    type: 'math',
    propSchema: {
      formula: {
        default: 'E = mc^2',
      },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <MathBlockView block={props.block} editor={props.editor} />
    ),
  }
);

const CalloutBlock = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      icon: {
        default: '💡',
      },
    },
    content: 'inline',
  },
  {
    render: (props) => (
      <div className="callout-block">
        <span className="callout-icon" contentEditable={false}>
          {props.block.props.icon}
        </span>
        <div className="callout-content" ref={props.contentRef} />
      </div>
    ),
  }
);

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    math: MathBlock,
    callout: CalloutBlock,
  },
});

// Lọc bỏ các block không hợp lệ (ví dụ dữ liệu cũ từ phiên bản trước)
function sanitizeInitialContent(content?: any[]) {
  if (!Array.isArray(content) || content.length === 0) return undefined;
  const validTypes = new Set(Object.keys(schema.blockSpecs));
  const cleaned = content.filter(
    (b) => b && typeof b === 'object' && validTypes.has(b.type)
  );
  return cleaned.length > 0 ? cleaned : undefined;
}

interface EditorProps {
  initialContent?: any[];
  onChange: (content: any[]) => void;
  theme: 'light' | 'dark';
}

function EditorInner({ initialContent, onChange, theme }: EditorProps) {
  // Chỉ đọc initialContent đúng 1 lần lúc mount trang
  const [safeInitial] = useState(() => sanitizeInitialContent(initialContent));

  const editor = useCreateBlockNote({
    schema,
    initialContent: safeInitial,
  });

  const getCustomSlashMenuItems = (ed: typeof editor) => [
    ...getDefaultReactSlashMenuItems(ed),
    {
      title: 'Công thức Toán (LaTeX)',
      subtext: 'Chèn khối công thức KaTeX',
      aliases: ['math', 'latex', 'katex', 'toan'],
      group: 'Học thuật & Code',
      icon: <Sigma size={18} />,
      onItemClick: () => {
        insertOrUpdateBlock(ed, {
          type: 'math',
          props: { formula: 'a^2 + b^2 = c^2' },
        });
      },
    },
    {
      title: 'Callout (Ghi chú nổi bật)',
      subtext: 'Tạo khung nhấn mạnh định lý hoặc lưu ý',
      aliases: ['callout', 'note', 'luuy'],
      group: 'Học thuật & Code',
      icon: <Lightbulb size={18} />,
      onItemClick: () => {
        insertOrUpdateBlock(ed, {
          type: 'callout',
        });
      },
    },
    {
      title: 'Khung Code C++',
      subtext: 'Chèn sẵn template #include <bits/stdc++.h>',
      aliases: ['cpp', 'c++', 'template'],
      group: 'Học thuật & Code',
      icon: <Code2 size={18} />,
      onItemClick: () => {
        insertOrUpdateBlock(ed, {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    return 0;\n}',
              styles: { code: true },
            },
          ],
        });
      },
    },
    {
      title: 'Ngày giờ hôm nay',
      subtext: 'Chèn ngày hiện tại',
      aliases: ['today', 'date', 'homnay'],
      group: 'Tiện ích',
      icon: <Calendar size={18} />,
      onItemClick: () => {
        const now = new Date().toLocaleDateString('vi-VN', {
          weekday: 'long',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        ed.insertInlineContent([
          { type: 'text', text: now, styles: { bold: true } },
        ]);
      },
    },
  ];

  return (
    <div className="editor-wrapper">
      <BlockNoteView
        editor={editor}
        theme={theme}
        slashMenu={false}
        onChange={() => {
          onChange(editor.document);
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const items = getCustomSlashMenuItems(editor);
            const q = query.toLowerCase();
            return items.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.aliases?.some((a) => a.toLowerCase().includes(q))
            );
          }}
        />
      </BlockNoteView>
    </div>
  );
}

// ErrorBoundary ngăn chặn lỗi màn hình đen nếu dữ liệu trang bị hỏng
class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="callout-block" style={{ flexDirection: 'column', gap: 10 }}>
          <p>Dữ liệu trang này gặp định dạng cũ không tương thích.</p>
          <button
            className="new-page-btn"
            onClick={() => {
              this.props.onReset();
              this.setState({ hasError: false });
            }}
          >
            Khôi phục trang trống để tiếp tục viết
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Editor(props: EditorProps) {
  return (
    <EditorErrorBoundary onReset={() => props.onChange([])}>
      <EditorInner {...props} />
    </EditorErrorBoundary>
  );
}