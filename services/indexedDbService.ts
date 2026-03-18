// services/indexedDbService.ts

const DB_NAME = 'SpieleabendScoreboardDB';
const DB_VERSION = 1;
const STORES = ['players', 'categories', 'sessions'];

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening DB');
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            STORES.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            });
        };
    });
    return dbPromise;
};

export const getAll = async <T>(storeName: string): Promise<T[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onerror = () => reject(`Error fetching from ${storeName}`);
        request.onsuccess = () => resolve(request.result);
    });
};

export const put = async <T>(storeName: string, item: T): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(item);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error(`Transaction error on putting item in ${storeName}:`, transaction.error);
            reject(`Transaction error on putting item in ${storeName}`);
        };
    });
};

export const putAll = async <T>(storeName: string, items: T[]): Promise<void> => {
    if (items.length === 0) return Promise.resolve();
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        items.forEach(item => store.put(item));
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error(`Transaction error on putting all items in ${storeName}:`, transaction.error);
            reject(`Transaction error on putting all items in ${storeName}`);
        };
    });
};

export const deleteItem = async (storeName: string, key: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error(`Transaction error on deleting item from ${storeName}:`, transaction.error);
            reject(`Transaction error on deleting item from ${storeName}`);
        };
    });
};

export const clear = async (storeName: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error(`Transaction error on clearing store ${storeName}:`, transaction.error);
            reject(`Transaction error on clearing store ${storeName}`);
        };
    });
};
