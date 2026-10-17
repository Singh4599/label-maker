// 365 Spicery — Label Records Firebase Sync
// Project: lablerecords-3f897 | Collection: labelRecords
// Dual storage: IndexedDB (offline) + Firestore (cloud)

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBUC4Ej-pNcQsMbWYavJu9tBH53_WWL-zA",
  authDomain: "lablerecords-3f897.firebaseapp.com",
  projectId: "lablerecords-3f897",
  storageBucket: "lablerecords-3f897.firebasestorage.app",
  messagingSenderId: "936028827480",
  appId: "1:936028827480:web:0e6aea6bccddafa75f7f2d"
};

const COLLECTION_NAME = "labelRecords";
let db = null;
let _unsubscribe = null;

// ── Update cloud badge in records view ──
function updateCloudBadge(connected) {
  const el = document.getElementById('rec-cloud-badge');
  if (!el) return;
  if (connected) {
    el.textContent = '🟢 Live Cloud';
    el.style.color = '#166534';
  } else {
    el.textContent = '🔴 Offline';
    el.style.color = '#dc2626';
  }
}

// ── Init Firebase ──
function initLabelFirebase() {
  try {
    const app = getApps().find(a => a.name === 'label-records') ||
                initializeApp(FIREBASE_CONFIG, 'label-records');
    db = getFirestore(app);
    console.log('[LabelFirebase] lablerecords-3f897 ready');
    updateCloudBadge(true);
    return db;
  } catch (err) {
    console.error('[LabelFirebase] Init error:', err);
    updateCloudBadge(false);
    return null;
  }
}

// ── Sync one record to Firestore ──
async function syncRecordToCloud(record) {
  if (!db) initLabelFirebase();
  if (!db) return false;
  try {
    const docId = String(record.id || record.timestamp);
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      ...record,
      _docId: docId
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('[LabelFirebase] Sync error:', err);
    updateCloudBadge(false);
    return false;
  }
}

// ── Delete one record from Firestore ──
async function deleteRecordFromCloud(id) {
  if (!db) initLabelFirebase();
  if (!db) return false;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, String(id)));
    return true;
  } catch (err) {
    console.error('[LabelFirebase] Delete error:', err);
    return false;
  }
}

// ── Listen to cloud records (real-time) ──
function listenToCloudRecords(onUpdate) {
  if (!db) initLabelFirebase();
  if (!db) return;
  if (_unsubscribe) _unsubscribe();

  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('timestamp', 'desc'),
    limit(2000)
  );

  _unsubscribe = onSnapshot(q, (snapshot) => {
    const records = [];
    snapshot.forEach(d => records.push({ ...d.data(), id: d.data().id || d.id }));
    console.log(`[LabelFirebase] ${records.length} records from cloud`);
    updateCloudBadge(true);
    if (typeof onUpdate === 'function') onUpdate(records);
  }, (err) => {
    console.warn('[LabelFirebase] Listener error:', err);
    updateCloudBadge(false);
  });
}

// ── Batch upload local records to cloud (first-time sync) ──
async function batchSyncLocalToCloud(records) {
  if (!db) initLabelFirebase();
  if (!db || !records.length) return;
  try {
    // Firestore batch = max 500 docs at once
    const chunks = [];
    for (let i = 0; i < records.length; i += 499) {
      chunks.push(records.slice(i, i + 499));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(r => {
        const docId = String(r.id || r.timestamp);
        batch.set(doc(db, COLLECTION_NAME, docId), { ...r, _docId: docId }, { merge: true });
      });
      await batch.commit();
    }
    console.log(`[LabelFirebase] Batch synced ${records.length} local records to cloud`);
  } catch (err) {
    console.error('[LabelFirebase] Batch sync error:', err);
  }
}

// ── Expose globally ──
if (typeof window !== 'undefined') {
  window.LabelFirebase = {
    init: initLabelFirebase,
    sync: syncRecordToCloud,
    delete: deleteRecordFromCloud,
    listen: listenToCloudRecords,
    batchSync: batchSyncLocalToCloud,
  };
}

// ── Auto-init on load ──
try {
  initLabelFirebase();
} catch (e) {
  console.warn('[LabelFirebase] Auto-init failed:', e);
}
