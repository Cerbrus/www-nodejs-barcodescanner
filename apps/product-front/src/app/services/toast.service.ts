import { Injectable, signal } from '@angular/core';

export interface Toast {
    id: number;
    text: string;
    kind: 'ok' | 'attention' | 'error';
    actionLabel?: string;
    action?: () => void;
}

const VISIBLE_MILLISECONDS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
    public readonly toasts = signal<Array<Toast>>([]);

    private nextId = 1;

    public show(toast: Omit<Toast, 'id'>): void {
        const id = this.nextId++;
        this.toasts.update((toasts) => [...toasts.slice(-2), { ...toast, id }]);
        setTimeout(() => this.dismiss(id), VISIBLE_MILLISECONDS);
    }

    public dismiss(id: number): void {
        this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
    }
}
