import { Injectable } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import { map, Observable, switchMap } from 'rxjs';

const STORAGE_KEY = 'barcode-scanner-app';

interface IStorage {
    [component: string]: IComponentStorage;
}

interface IComponentStorage {
    [key: string]: unknown;
}

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    constructor(private readonly storage: StorageMap) {
    }

    public set<T>(component: string, key: string, value: T): void {
        this.getStorage()
            .pipe(
                switchMap((storage: IStorage | undefined) => {
                        storage ??= {};
                        storage[component] ??= {};
                        storage[component][key] = value;
                        return this.storage.set(STORAGE_KEY, storage);
                    }
                )).subscribe();
    }

    public get<T>(component: string, key: string): Observable<T | undefined> {
        return this.getStorage()
            .pipe(
                map((storage: IStorage | undefined) => (storage?.[component]?.[key] as T | undefined))
            );
    }

    private getStorage(): Observable<IStorage> {
        return this.storage.get(STORAGE_KEY) as Observable<IStorage>;
    }
}
