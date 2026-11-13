import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from './toast.service';

export const QUIET_FAILURE = new HttpContextToken<boolean>(() => false);

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const UNAUTHORIZED = 401;
const MESSAGE_BY_STATUS: Record<number, string> = {
    0: 'error.noConnection',
    400: 'error.invalid',
    404: 'error.notFound',
    409: 'error.conflict'
};

export const reportFailedChanges: HttpInterceptorFn = (request, next) => {
    const toasts = inject(ToastService);
    const translate = inject(TranslateService);

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            const silent = READ_METHODS.includes(request.method) || request.context.get(QUIET_FAILURE) || error.status === UNAUTHORIZED;
            if (!silent) {
                toasts.show({ kind: 'error', text: translate.instant(MESSAGE_BY_STATUS[error.status] ?? 'error.generic') });
            }

            return throwError(() => error);
        })
    );
};
