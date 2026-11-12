import { Observable } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';

export abstract class BaseConnector<TProduct, TProductDetails, TCategory> {
    protected constructor(
        protected readonly http: HttpService,
        protected readonly basePath: string,
        protected readonly headers: AxiosRequestConfig['headers']
    ) {
    }

    public abstract getProductByBarcode(barcode: string): Observable<TProduct>;

    public abstract getProductDetails(product: TProduct): Observable<any>;
}
