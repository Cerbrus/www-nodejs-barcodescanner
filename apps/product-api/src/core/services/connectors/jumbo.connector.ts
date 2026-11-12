import { map, Observable } from 'rxjs';
import { BaseConnector } from './base.connector';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

type TProduct = any;
type TProductDetails = any;
type TCategory = any;

@Injectable()
export class JumboConnector extends BaseConnector<TProduct, TProductDetails, TCategory> {
    private jumboApiVersion = 'v15';

    constructor(http: HttpService) {
        super(
            http,
            'https://mobileapi.jumbo.com',
            {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:102.0) Gecko/20100101 Firefox/102.0'
            });
    }

    public searchProducts(query: string | null = null, page = 0, size = 30): Observable<any> {
        if ((page + 1) * size > 30) {
            throw new Error('Pagination limit on Jumbo connector of 30');
        }

        const params = {
            offset: (page * size).toString(),
            limit: size.toString(),
            q: query || ''
        };

        return this.get<any>('search', params);
    }

    public getProductByBarcode(barcode: string): Observable<TProduct> {
        const params = { q: barcode };

        return this.get<any>(`search`, params);
    }

    public getProductDetails(product: TProduct): Observable<TProductDetails> {
        const productId = typeof product === 'object' ? product.id : product;
        return this.get<TProductDetails>(`products/${productId}`);
    }

    public getCategories(): Observable<TCategory> {
        return this.get<any>('categories');
    }

    public getSubCategories(category: TCategory): Observable<any> {
        const params = {
            id: typeof category === 'object' ? category.id : category
        };

        return this.get<any>('categories', params);
    }

    public getAllStores(): Observable<any> {
        return this.get<any>('stores');
    }

    public getStore(store: any): Observable<any> {
        const storeId = typeof store === 'object' ? store.id : store;
        return this.get<any>(`stores/${storeId}`);
    }

    public getAllPromotions(): Observable<any> {
        return this.get<any>('promotion-overview');
    }

    public getPromotionsStore(store: any): Observable<any> {
        const params = {
            store_id: typeof store === 'object' ? store.id : store
        };

        return this.get<any>('promotion-overview', params);
    }

    private get<TResult>(
        path: string,
        params?: any
    ): Observable<TResult> {
        console.log(`${this.basePath}/${this.jumboApiVersion}/${path}`, {
            headers: this.headers,
            params
        });


        return this.http
            .get<TResult>(`${this.basePath}/${this.jumboApiVersion}/${path}`, {
                headers: this.headers,
                params
            })
            .pipe(map(response => response.data));
    }
}
