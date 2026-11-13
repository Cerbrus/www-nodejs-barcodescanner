import { AHAllergenInformationItem, AHLabeledValue, AHProduct, AHProductProperties } from '.';

export interface AHProductDetailsModel {
    productId: number;
    productCard: AHProduct & {
        subCategoryId: number;
        isFavorite: boolean;
        properties: AHProductProperties;
    };
    tradeItem: {
        gln: string;
        gtin: string;
        additionalTradeItemIdentification: Array<{ value: string; typeCode: AHLabeledValue; }>;
        allergenInformation: Array<{ items: Array<AHAllergenInformationItem>; statement: string; }>;
        certificationInformation: Array<string>;
        consumerInstructions: {
            storageInstructions: Array<string>;
            usageInstructions: Array<string>;
            bacteriaWarningLogoPoultry: false;
        };
        foodAndBeverageIngredientStatement: string;
        foodAndBeveragePreparationServing: {
            preparationServing: Array<{ instructions: string; }>;
            servingQuantityInformation: { numberOfServingsPerPackage: number; };
        };
        gdsnClassification: {
            additionalTradeItemClassification: Array<{ additionalTradeItemClassificationSystemCode: AHLabeledValue }>;
        };
        healthRelatedInformation: {
            compulsoryAdditiveLabelInformation: Array<string>;
            healthClaimDescription: Array<string>;
        };
        healthWellnessPackagingMarking: {
            packagingMarkedDietAllergenCode: Array<string>;
            packagingMarkedFreeFromCode: Array<string>;
        };
        nutritionalInformation: {
            nutrientHeaders: Array<{
                dailyValueIntakeReference: Array<string>;
                nutrientBasisQuantity: { value: number; measurementUnitCode: AHLabeledValue; };
                nutrientBasisQuantityDescription: Array<string>;
                nutrientDetail: Array<{
                    measurementPrecisionCode: AHLabeledValue;
                    nutrientSource: Array<unknown>;
                    nutrientTypeCode: AHLabeledValue;
                    quantityContained: Array<{ value: number; measurementUnitCode: AHLabeledValue; }>;
                }>;
                preparationStateCode: AHLabeledValue;
            }>;
            nutritionalClaim: Array<string>;
        };
        packagingMarking: { localPackagingMarkedLabelAccreditationCodeReference: Array<AHLabeledValue>; };
        placeOfItemActivity: {
            placeOfProductActivity: { productActivityDetails: Array<string>; provenanceStatement: Array<string>; };
        };
        referencedFileDetailInformation: Array<string>;
        regulatoryInformation: Array<{
            permitIdentification: Array<string>;
            regulationTypeCode: Array<AHLabeledValue>;
        }>;
        safetyDataSheetInformation: Array<unknown>;
        contactInformation: Array<{
            contactAddress: string;
            contactName: string;
            targetMarketCommunicationChannel: Array<{
                communicationChannel: Array<{ code: AHLabeledValue; value: string; }>;
            }>;
            contactTypeCode: AHLabeledValue;
        }>;
        description: { regulatedProductName: Array<string>; };
        lifespan: { itemPeriodSafeToUseAfterOpening: Array<string>; };
        measurements: {
            netContent: Array<{ value: number; measurementUnitCode: AHLabeledValue; }>;
            weight: unknown;
        }
    };
    properties: AHProductProperties;
    disclaimerText: string;
}
