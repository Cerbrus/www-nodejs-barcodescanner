import { map, Observable, shareReplay, switchMap, take } from 'rxjs';
import { BaseConnector } from './base.connector';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AHProduct, AHProductDetailsModel } from './ah';

type TCategory = any;

interface AccessTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

@Injectable()
export class AHConnector extends BaseConnector<AHProduct, AHProductDetailsModel, TCategory> {
    private accessToken$: Observable<string>;

    constructor(http: HttpService) {
        super(
            http,
            'https://api.ah.nl/mobile-services',
            {
                'Host': 'api.ah.nl',
                'x-dynatrace': 'MT_3_4_772337796_1_fae7f753-3422-4a18-83c1-b8e8d21caace_0_1589_109',
                'x-application': 'AHWEBSHOP',
                'user-agent': 'Appie/8.8.2 Model/phone Android/7.0-API24',
                'content-type': 'application/json; charset=UTF-8'
            });

        this.accessToken$ = this.getAnonymousAccessToken().pipe(
            take(1),
            shareReplay(1)
        );
    }

    public searchProducts(
        query: string | null = null,
        page = 0,
        size = 750,
        sort: 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' = 'RELEVANCE'): Observable<any> {
        const params = {
            sortOn: sort,
            page: page.toString(),
            size: size.toString(),
            query: query
        };

        return this.get<any>('product/search/v2', params);
    }

    public getProductByBarcode(barcode: string): Observable<AHProduct> {
        return this.get<any>(`product/search/v1/gtin/${barcode}`);
    }

    public getProductDetails(product: AHProduct): Observable<AHProductDetailsModel> {
        const productId = typeof product === 'object' ? product.webshopId : product;
        return this.get<AHProductDetailsModel>(`product/detail/v4/fir/${productId}`);
    }

    // public getCategories(): Observable<TCategory> {
    //     return this.get<any>('product-shelves/categories');
    // }
    //
    // public getSubCategories(category: TCategory): Observable<any> {
    //     const categoryId = typeof category === 'object' ? category.id : category;
    //     return this.get<any>(`product-shelves/categories/${categoryId}/sub-categories`);
    // }
    //
    // public getBonusPeriods(): Observable<any> {
    //     return this.get<any>('bonuspage/v1/metadata');
    // }
    //
    // public getBonusGroupsOrProducts(url: string): Observable<any> {
    //     return this.get<any>(url);
    // }
    //
    // public getBonusGroupProducts(groupId: string, date: Date): Observable<any> {
    //     const params = {
    //         date: date.toISOString().split('T')[0],
    //         segmentId: groupId,
    //         includeActivatableDiscount: 'false'
    //     };
    //
    //     return this.get<any>('bonuspage/v1/segment', params);
    // }
    //
    // public getAllBonusProducts(date: Date | null = null): Observable<any> {
    //     date = date || new Date();
    //
    //     return this.getBonusPeriods().pipe(
    //         switchMap((periods) => {
    //             const bonusProducts$: Array<Observable<any>> = [];
    //
    //             for (const period of periods) {
    //                 const bonusStartDate = new Date(period.bonusStartDate);
    //                 const bonusEndDate = new Date(period.bonusEndDate);
    //
    //                 if (date < bonusStartDate || date > bonusEndDate) {
    //                     continue;
    //                 }
    //
    //                 for (const metaData of period.urlMetadataList) {
    //                     const bonusGroupOrProducts$ = this.getBonusGroupsOrProducts(metaData.url)
    //                         .pipe(switchMap((groupOrProducts) => {
    //                             const products$: Array<Observable<any>> = [];
    //
    //                             for (const bonGroupOrProd of groupOrProducts.bonusGroupOrProducts) {
    //                                 if (bonGroupOrProd.product) {
    //                                     products$.push(of(bonGroupOrProd.product));
    //                                     // products$.push(new Observable(observer => {
    //                                     //     observer.next(bonGroupOrProd.product);
    //                                     //     observer.complete();
    //                                     // }));
    //                                 }
    //
    //                                 if (bonGroupOrProd.bonusGroup) {
    //                                     products$.push(
    //                                         this.getBonusGroupProducts(bonGroupOrProd.bonusGroup.id, date!)
    //                                             .pipe(switchMap((groupProducts) => groupProducts.products || []))
    //                                     );
    //                                 }
    //                             }
    //
    //                             return products$.length ? forkJoin(products$) : of([]);
    //                         }));
    //
    //                     bonusProducts$.push(bonusGroupOrProducts$);
    //                 }
    //             }
    //
    //             return bonusProducts$.length ? forkJoin(bonusProducts$) : of([]);
    //         })
    //     );
    // }

    private getAnonymousAccessToken(): Observable<string> {
        return this.http
            .post<AccessTokenResponse>(
                'https://api.ah.nl/mobile-auth/v1/auth/token/anonymous',
                { clientId: 'appie' },
                { headers: this.headers }
            )
            .pipe(map(response => response.data.access_token));
    }

    private get<TResult>(
        path: string,
        params?: any
    ): Observable<TResult> {
        return this.accessToken$.pipe(
            switchMap(accessToken => this.http
                .get<TResult>(`${this.basePath}/${path}`, {
                    headers: { ...this.headers, Authorization: `Bearer ${accessToken}` },
                    params
                })
            ))
            .pipe(map(response => response.data));

    }
}
