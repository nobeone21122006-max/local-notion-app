import { Keyboard, Sigma, FolderTree, Download, Sparkles } from 'lucide-react';

export function Guide() {
  return (
    <div className="guide-container">
      <h1>Hướng dẫn sử dụng Local Notion</h1>
      <p className="guide-subtitle">
        Mọi dữ liệu được lưu trực tiếp trên trình duyệt (IndexedDB) với tốc độ phản hồi 0ms, hoạt động hoàn toàn ngoại tuyến.
      </p>

      <section className="guide-section">
        <h2><Keyboard size={18} /> 1. Phím tắt nhanh</h2>
        <table className="guide-table">
          <thead>
            <tr>
              <th>Phím tắt</th>
              <th>Chức năng</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><kbd>Ctrl</kbd> + <kbd>K</kbd></td>
              <td>Tìm kiếm toàn văn (quét cả tiêu đề, tag và nội dung bên trong trang)</td>
            </tr>
            <tr>
              <td><kbd>Ctrl</kbd> + <kbd>\</kbd></td>
              <td>Bật / Tắt chế độ <strong>Focus Mode</strong> (ẩn/hiện thanh Sidebar)</td>
            </tr>
            <tr>
              <td><kbd>/</kbd></td>
              <td>Mở bảng chọn Block (Slash Command) ngay tại vị trí con trỏ</td>
            </tr>
            <tr>
              <td><kbd># </kbd> / <kbd>## </kbd> / <kbd>### </kbd></td>
              <td>Tạo nhanh Tiêu đề (Heading 1, 2, 3) — tự động hiện ở Mục lục bên phải</td>
            </tr>
            <tr>
              <td><kbd>- </kbd> hoặc <kbd>1. </kbd></td>
              <td>Tạo nhanh danh sách gạch đầu dòng hoặc đánh số</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="guide-section">
        <h2><Sigma size={18} /> 2. Lệnh Slash tùy biến (Học thuật & Code)</h2>
        <ul>
          <li><code>/math</code> hoặc <code>/latex</code>: Chèn khối công thức Toán học (KaTeX). Bấm vào công thức để sửa mã LaTeX, nhấn <kbd>Enter</kbd> để xem kết quả.</li>
          <li><code>/callout</code>: Tạo khung ghi chú nổi bật (dùng cho định lý, lưu ý quan trọng).</li>
          <li><code>/cpp</code>: Chèn nhanh khung code C++ có sẵn <code>#include &lt;bits/stdc++.h&gt;</code>.</li>
          <li><code>/today</code>: Chèn nhanh ngày tháng hiện tại.</li>
        </ul>
      </section>

      <section className="guide-section">
        <h2><FolderTree size={18} /> 3. Tổ chức tài liệu</h2>
        <ul>
          <li><strong>Trang con lồng nhau:</strong> Di chuột vào bất kỳ trang nào ở Sidebar và bấm nút <code>+</code> để tạo trang con bên trong.</li>
          <li><strong>Ghim trang (Pin):</strong> Bấm biểu tượng chiếc ghim để đưa các trang hay dùng lên mục <em>Đã ghim</em> ở đầu Sidebar.</li>
          <li><strong>Gắn thẻ (Tags):</strong> Thêm tag ngay dưới tiêu đề trang (nhấn <kbd>Enter</kbd> để lưu) giúp phân loại theo môn học hoặc chủ đề.</li>
          <li><strong>Mục lục tự động:</strong> Các tiêu đề (H1–H3) trong bài viết tự động xuất hiện ở cột phải để nhảy nhanh.</li>
        </ul>
      </section>

      <section className="guide-section">
        <h2><Download size={18} /> 4. Sao lưu & An toàn dữ liệu</h2>
        <p>
          Vì dữ liệu nằm trong bộ nhớ trình duyệt, hãy thỉnh thoảng bấm <strong>Backup JSON</strong> ở góc dưới bên trái để tải bản sao lưu về ổ cứng. Khi đổi máy hoặc cài lại trình duyệt, chỉ cần bấm <strong>Khôi phục</strong> để nạp lại toàn bộ ghi chú.
        </p>
      </section>

      <div className="guide-tip">
        <Sparkles size={16} />
        <span>Mẹo: Bạn có thể kéo thả biểu tượng 6 chấm bên trái mỗi đoạn văn để sắp xếp lại bố cục trang cực nhanh.</span>
      </div>
    </div>
  );
}