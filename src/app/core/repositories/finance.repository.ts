import { Service } from '@angular/core';
import { FinanceSnapshot } from '../models/finance.models';

interface SpendzoDatabaseBridge {
  loadState(): string;
  saveState(value: string): void;
}

interface NativeWindow extends Window {
  SpendzoDatabase?: SpendzoDatabaseBridge;
}

export interface FinanceRepository {
  load(): Promise<FinanceSnapshot | null>;
  save(snapshot: FinanceSnapshot): Promise<void>;
}

@Service()
export class PlatformFinanceRepository implements FinanceRepository {
  private readonly databaseName = 'spendzo';
  private readonly storeName = 'finance_state';
  private readonly stateKey = 'snapshot';

  async load(): Promise<FinanceSnapshot | null> {
    const nativeBridge = (window as NativeWindow).SpendzoDatabase;
    if (nativeBridge) {
      const value = nativeBridge.loadState();
      return value ? (JSON.parse(value) as FinanceSnapshot) : null;
    }

    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const request = database
        .transaction(this.storeName, 'readonly')
        .objectStore(this.storeName)
        .get(this.stateKey);
      request.onsuccess = () => resolve((request.result as FinanceSnapshot | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async save(snapshot: FinanceSnapshot): Promise<void> {
    const nativeBridge = (window as NativeWindow).SpendzoDatabase;
    if (nativeBridge) {
      nativeBridge.saveState(JSON.stringify(snapshot));
      return;
    }

    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).put(snapshot, this.stateKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName);
        }
        request.transaction?.objectStore(this.storeName).put(1, 'schema_version');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
