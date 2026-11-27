import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../db';
import { firestore } from './firebase.ts';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  message: string;
}

// ID riêng cho từng tab để bỏ qua snapshot do chính tab này vừa đẩy lên
const CLIENT_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const DEBOUNCE_MS = 1500;

function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export function startFirestoreSync(
  uid: string,
  onStatus: (status: SyncStatus) => void
): () => void {
  if (!firestore) {
    onStatus({ state: 'error', message: 'Chưa cấu hình Firebase' });
    return () => {};
  }

  const fs = firestore;
  const tablesColRef = collection(fs, 'users', uid, 'tables');

  const applyingRemote = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const hookCleanups: Array<() => void> = [];
  let unsubscribeSnapshot: Unsubscribe | null = null;
  let stopped = false;

  const pushTable = async (tableName: string) => {
    if (stopped) return;
    const table = db.tables.find((t) => t.name === tableName);
    if (!table) return;

    try {
      onStatus({ state: 'syncing', message: 'Đang đồng bộ lên Cloud...' });
      const rows = await table.toArray();
      const docRef = doc(fs, 'users', uid, 'tables', tableName);
      await setDoc(docRef, {
        rows: sanitizeForFirestore(rows),
        updatedAt: Date.now(),
        clientId: CLIENT_ID,
      });
      if (!stopped) {
        const time = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        onStatus({ state: 'synced', message: `Đã đồng bộ lúc ${time}` });
      }
    } catch (err: any) {
      if (!stopped) {
        onStatus({
          state: navigator.onLine ? 'error' : 'offline',
          message: navigator.onLine
            ? `Lỗi đồng bộ: ${err?.message || 'Không xác định'}`
            : 'Đang ngoại tuyến (lưu cục bộ)',
        });
      }
    }
  };

  const schedulePush = (tableName: string) => {
    if (stopped || applyingRemote.has(tableName)) return;
    const prev = timers.get(tableName);
    if (prev) clearTimeout(prev);
    const nextTimer = setTimeout(() => {
      timers.delete(tableName);
      void pushTable(tableName);
    }, DEBOUNCE_MS);
    timers.set(tableName, nextTimer);
  };

  // 1. Gắn hook lên tất cả bảng Dexie để tự động đẩy khi có thay đổi
  for (const table of db.tables) {
    const name = table.name;
    const onCreating = () => schedulePush(name);
    const onUpdating = () => schedulePush(name);
    const onDeleting = () => schedulePush(name);

    table.hook('creating', onCreating);
    table.hook('updating', onUpdating);
    table.hook('deleting', onDeleting);

    hookCleanups.push(() => {
      table.hook('creating').unsubscribe(onCreating);
      table.hook('updating').unsubscribe(onUpdating);
      table.hook('deleting').unsubscribe(onDeleting);
    });
  }

  // 2. Đồng bộ lần đầu & bật lắng nghe Realtime
  const bootstrapAndListen = async () => {
    try {
      onStatus({ state: 'syncing', message: 'Đang kết nối Firestore...' });
      const initialSnap = await getDocs(tablesColRef);
      const remoteNames = new Set(initialSnap.docs.map((d) => d.id));

      for (const table of db.tables) {
        if (!remoteNames.has(table.name)) {
          const localRows = await table.toArray();
          if (localRows.length > 0) {
            await pushTable(table.name);
          }
        }
      }

      if (stopped) return;

      unsubscribeSnapshot = onSnapshot(
        tablesColRef,
        async (snapshot) => {
          if (stopped) return;
          const changedDocs = snapshot.docChanges();
          if (changedDocs.length === 0) {
            onStatus({ state: 'synced', message: 'Đã đồng bộ Realtime' });
            return;
          }

          for (const change of changedDocs) {
            if (change.type === 'removed') continue;
            const tableName = change.doc.id;
            const data = change.doc.data();

            if (data?.clientId === CLIENT_ID) continue;
            if (!Array.isArray(data?.rows)) continue;

            const table = db.tables.find((t) => t.name === tableName);
            if (!table) continue;

            applyingRemote.add(tableName);
            try {
              await db.transaction('rw', table, async () => {
                await table.clear();
                if (data.rows.length > 0) {
                  await table.bulkPut(data.rows);
                }
              });
            } finally {
              applyingRemote.delete(tableName);
            }
          }

          const time = new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          });
          onStatus({ state: 'synced', message: `Đã đồng bộ lúc ${time}` });
        },
        (err) => {
          if (!stopped) {
            onStatus({
              state: 'error',
              message: `Lỗi kết nối Cloud: ${err.message}`,
            });
          }
        }
      );
    } catch (err: any) {
      if (!stopped) {
        onStatus({
          state: navigator.onLine ? 'error' : 'offline',
          message: navigator.onLine
            ? `Không thể kết nối: ${err?.message || 'Lỗi Firestore'}`
            : 'Đang ngoại tuyến (lưu cục bộ)',
        });
      }
    }
  };

  void bootstrapAndListen();

  return () => {
    stopped = true;
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    hookCleanups.forEach((fn) => fn());
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
}