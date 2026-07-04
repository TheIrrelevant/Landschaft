/*
 * ---metadata---
 * type: app-source
 * description: IndexedDB persistence for large Landschaft project snapshots and knowledge bank sheets.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: move project snapshot off localStorage to avoid quota errors
 * ---end-metadata---
 */
import type { ProjectSnapshot } from "@landschaft/shared";
import type { KnowledgeBankSheetSnapshot } from "../ui/knowledgeBankSheet.js";

const DB_NAME = "landschaft-editor";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "project-snapshot";
const KNOWLEDGE_BANK_STORE = "knowledge-bank";
const CURRENT_KEY = "current";

export const LEGACY_PROJECT_SNAPSHOT_KEY = "landschaft.project.snapshot.v3";
export const LEGACY_KNOWLEDGE_BANK_KEY = "landschaft.knowledge-bank.sheet.v1";

let dbPromise: Promise<IDBDatabase> | null = null;
let legacyMigrationPromise: Promise<void> | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB is unavailable outside the browser."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to open Landschaft IndexedDB."));
      };

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE);
        }
        if (!database.objectStoreNames.contains(KNOWLEDGE_BANK_STORE)) {
          database.createObjectStore(KNOWLEDGE_BANK_STORE);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  return dbPromise;
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);

    request.onerror = () => {
      reject(request.error ?? new Error(`Failed to read ${storeName}/${key} from IndexedDB.`));
    };

    request.onsuccess = () => {
      resolve((request.result as T | undefined) ?? null);
    };
  });
}

async function idbSet(storeName: string, key: string, value: unknown): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error(`Failed to write ${storeName}/${key} to IndexedDB.`));
    };
    transaction.objectStore(storeName).put(value, key);
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error(`Failed to delete ${storeName}/${key} from IndexedDB.`));
    };
    transaction.objectStore(storeName).delete(key);
  });
}

function isEphemeralUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith("blob:") || value.startsWith("data:");
}

export function sanitizeProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  return {
    ...snapshot,
    orthophotoPreviewUrl: isEphemeralUrl(snapshot.orthophotoPreviewUrl)
      ? null
      : snapshot.orthophotoPreviewUrl ?? null,
    layers: snapshot.layers.map((layer) => ({
      ...layer,
      rasterPreviewUrl: isEphemeralUrl(layer.rasterPreviewUrl) ? undefined : layer.rasterPreviewUrl
    }))
  };
}

async function migrateLegacyLocalStorage() {
  if (!isBrowser()) {
    return;
  }

  const legacySnapshot = window.localStorage.getItem(LEGACY_PROJECT_SNAPSHOT_KEY);
  if (legacySnapshot) {
    try {
      const parsed = JSON.parse(legacySnapshot) as ProjectSnapshot;
      await idbSet(SNAPSHOT_STORE, CURRENT_KEY, sanitizeProjectSnapshot(parsed));
    } catch (error) {
      console.warn("Skipping invalid legacy project snapshot during migration.", error);
    } finally {
      window.localStorage.removeItem(LEGACY_PROJECT_SNAPSHOT_KEY);
    }
  }

  const legacyKnowledgeBank = window.localStorage.getItem(LEGACY_KNOWLEDGE_BANK_KEY);
  if (legacyKnowledgeBank) {
    try {
      const parsed = JSON.parse(legacyKnowledgeBank) as KnowledgeBankSheetSnapshot;
      await idbSet(KNOWLEDGE_BANK_STORE, CURRENT_KEY, parsed);
    } catch (error) {
      console.warn("Skipping invalid legacy knowledge bank sheet during migration.", error);
    } finally {
      window.localStorage.removeItem(LEGACY_KNOWLEDGE_BANK_KEY);
    }
  }
}

function ensureLegacyMigration() {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyLocalStorage().catch((error) => {
      legacyMigrationPromise = null;
      throw error;
    });
  }

  return legacyMigrationPromise;
}

export function loadProjectSnapshotLegacySync(): ProjectSnapshot | null {
  if (!isBrowser()) {
    return null;
  }

  const rawSnapshot = window.localStorage.getItem(LEGACY_PROJECT_SNAPSHOT_KEY);
  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as ProjectSnapshot;
  } catch {
    return null;
  }
}

export function loadKnowledgeBankSheetLegacySync(): KnowledgeBankSheetSnapshot | null {
  if (!isBrowser()) {
    return null;
  }

  const rawSheet = window.localStorage.getItem(LEGACY_KNOWLEDGE_BANK_KEY);
  if (!rawSheet) {
    return null;
  }

  try {
    return JSON.parse(rawSheet) as KnowledgeBankSheetSnapshot;
  } catch {
    return null;
  }
}

export async function loadProjectSnapshotFromPersistence(): Promise<ProjectSnapshot | null> {
  if (!isBrowser()) {
    return null;
  }

  await ensureLegacyMigration();
  return idbGet<ProjectSnapshot>(SNAPSHOT_STORE, CURRENT_KEY);
}

export async function loadKnowledgeBankSheetFromPersistence(): Promise<KnowledgeBankSheetSnapshot | null> {
  if (!isBrowser()) {
    return null;
  }

  await ensureLegacyMigration();
  return idbGet<KnowledgeBankSheetSnapshot>(KNOWLEDGE_BANK_STORE, CURRENT_KEY);
}

let projectSaveTimer: number | null = null;
let pendingProjectSnapshot: ProjectSnapshot | null = null;

export function saveProjectSnapshot(snapshot: ProjectSnapshot) {
  if (!isBrowser()) {
    return;
  }

  pendingProjectSnapshot = sanitizeProjectSnapshot(snapshot);

  if (projectSaveTimer !== null) {
    window.clearTimeout(projectSaveTimer);
  }

  projectSaveTimer = window.setTimeout(() => {
    projectSaveTimer = null;
    const snapshotToSave = pendingProjectSnapshot;
    pendingProjectSnapshot = null;

    if (!snapshotToSave) {
      return;
    }

    void idbSet(SNAPSHOT_STORE, CURRENT_KEY, snapshotToSave).catch((error) => {
      console.error("Failed to persist project snapshot to IndexedDB.", error);
    });
  }, 250);
}

let knowledgeBankSaveTimer: number | null = null;
let pendingKnowledgeBankSheet: KnowledgeBankSheetSnapshot | null = null;

export function saveKnowledgeBankSheet(sheet: KnowledgeBankSheetSnapshot) {
  if (!isBrowser()) {
    return;
  }

  pendingKnowledgeBankSheet = sheet;

  if (knowledgeBankSaveTimer !== null) {
    window.clearTimeout(knowledgeBankSaveTimer);
  }

  knowledgeBankSaveTimer = window.setTimeout(() => {
    knowledgeBankSaveTimer = null;
    const sheetToSave = pendingKnowledgeBankSheet;
    pendingKnowledgeBankSheet = null;

    if (!sheetToSave) {
      return;
    }

    void idbSet(KNOWLEDGE_BANK_STORE, CURRENT_KEY, sheetToSave).catch((error) => {
      console.error("Failed to persist knowledge bank sheet to IndexedDB.", error);
    });
  }, 250);
}

export function clearProjectSnapshot() {
  if (!isBrowser()) {
    return;
  }

  pendingProjectSnapshot = null;
  if (projectSaveTimer !== null) {
    window.clearTimeout(projectSaveTimer);
    projectSaveTimer = null;
  }

  window.localStorage.removeItem(LEGACY_PROJECT_SNAPSHOT_KEY);
  void idbDelete(SNAPSHOT_STORE, CURRENT_KEY).catch((error) => {
    console.error("Failed to clear project snapshot from IndexedDB.", error);
  });
}

export function clearKnowledgeBankSheet() {
  if (!isBrowser()) {
    return;
  }

  pendingKnowledgeBankSheet = null;
  if (knowledgeBankSaveTimer !== null) {
    window.clearTimeout(knowledgeBankSaveTimer);
    knowledgeBankSaveTimer = null;
  }

  window.localStorage.removeItem(LEGACY_KNOWLEDGE_BANK_KEY);
  void idbDelete(KNOWLEDGE_BANK_STORE, CURRENT_KEY).catch((error) => {
    console.error("Failed to clear knowledge bank sheet from IndexedDB.", error);
  });
}
