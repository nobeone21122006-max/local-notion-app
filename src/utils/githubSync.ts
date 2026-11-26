import { db } from '../db';

const REPO_OWNER = 'nobeone21122006-max';
const REPO_NAME = 'local-notion-sync';
const FILE_PATH = 'local-notion-backup.json';
const TOKEN_STORAGE_KEY = 'local_notion_gh_token';

export function getSavedGitHubToken(): string {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function saveGitHubToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

// Hàm chuyển chuỗi UTF-8 (tiếng Việt có dấu) sang Base64 chuẩn không bị lỗi ký tự
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Hàm giải mã Base64 về chuỗi UTF-8
function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Đẩy toàn bộ dữ liệu IndexedDB hiện tại lên file local-notion-backup.json trên GitHub
 */
export async function pushToGitHub(): Promise<void> {
  const token = getSavedGitHubToken();
  if (!token) throw new Error('Chưa nhập GitHub Token!');

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // 1. Lấy SHA hiện tại của file trên GitHub (bắt buộc để ghi đè)
  let sha: string | undefined;
  const getRes = await fetch(apiUrl, { headers, cache: 'no-store' });
  if (getRes.ok) {
    const fileData = await getRes.json();
    sha = fileData.sha;
  } else if (getRes.status !== 404) {
    throw new Error(`Lỗi kết nối GitHub (${getRes.status})`);
  }

  // 2. Gom toàn bộ dữ liệu từ các bảng của Dexie IndexedDB
  const payload: Record<string, unknown> = {
    version: 1,
    exportedAt: new Date().toISOString(),
  };
  for (const table of db.tables) {
    payload[table.name] = await table.toArray();
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const contentBase64 = utf8ToBase64(jsonString);

  // 3. Đẩy file lên GitHub
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Sync data ${new Date().toLocaleString('vi-VN')}`,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.message || `Push thất bại (${putRes.status})`);
  }
}

/**
 * Kéo dữ liệu mới nhất từ GitHub về và nạp vào IndexedDB của thiết bị hiện tại
 */
export async function pullFromGitHub(): Promise<void> {
  const token = getSavedGitHubToken();
  if (!token) throw new Error('Chưa nhập GitHub Token!');

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Không thể tải dữ liệu từ GitHub (${res.status})`);
  }

  const fileData = await res.json();
  const jsonString = base64ToUtf8(fileData.content);
  const parsed = JSON.parse(jsonString);

  // Ghi đè dữ liệu vào các bảng IndexedDB hiện tại
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (Array.isArray(parsed[table.name])) {
        await table.clear();
        await table.bulkAdd(parsed[table.name]);
      }
    }
  });
}