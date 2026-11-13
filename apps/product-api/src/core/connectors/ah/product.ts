import { AHImage } from '.';

export interface AHProduct {
    webshopId: number;
    hqId: number;
    title: string;
    salesUnitSize: string;
    unitPriceDescription: string;
    images: Array<AHImage>;
    priceBeforeBonus: number;
    orderAvailabilityStatus: string;
    mainCategory: string;
    subCategory: string;
    brand: string;
    shopType: string;
    availableOnline: true;
    isPreviouslyBought: false;
    descriptionHighlights: string;
    propertyIcons: Array<string>;
    nutriscore: string;
    nix18: boolean;
    isStapelBonus: boolean;
    extraDescriptions: Array<string>;
    isBonus: boolean;
    descriptionFull: string;
    isOrderable: boolean;
    isInfiniteBonus: boolean;
    isSample: boolean;
    isSponsored: boolean;
    isVirtualBundle: boolean;
    discountLabels: Array<string>;
    minBestBeforeDays: number;
}
