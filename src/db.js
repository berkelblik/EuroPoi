import { CFG } from "./config";

const DB = {
  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((res, rej) => {
      const req = indexedDB.open(CFG.db.name, CFG.db.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CFG.db.store))
          db.createObjectStore(CFG.db.store, { keyPath: "id" });
      };
      req.onsuccess = (e) => {
        this._db = e.target.result;
        res(this._db);
      };
      req.onerror = rej;
    });
  },

  async save(p) {
    const db = await this.open();
    return new Promise((r, j) => {
      const tx = db.transaction(CFG.db.store, "readwrite");
      tx.objectStore(CFG.db.store).put(p);
      tx.oncomplete = r;
      tx.onerror = j;
    });
  },

  async getAll() {
    const db = await this.open();
    return new Promise((r, j) => {
      const tx = db.transaction(CFG.db.store, "readonly");
      const req = tx.objectStore(CFG.db.store).getAll();
      req.onsuccess = () => r(req.result);
      req.onerror = j;
    });
  },

  async remove(id) {
    const db = await this.open();
    return new Promise((r, j) => {
      const tx = db.transaction(CFG.db.store, "readwrite");
      tx.objectStore(CFG.db.store).delete(id);
      tx.oncomplete = r;
      tx.onerror = j;
    });
  },

  async clearAll() {
    const db = await this.open();
    return new Promise((r, j) => {
      const tx = db.transaction(CFG.db.store, "readwrite");
      tx.objectStore(CFG.db.store).clear();
      tx.oncomplete = r;
      tx.onerror = j;
    });
  },
};

export default DB;
