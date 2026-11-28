import { Injectable, Logger } from '@nestjs/common';

import { RecipePage, readRecipePage } from '../rules/recipe-page';
import { RecipePictureService } from './recipe-picture.service';

const PAGE_TYPES = 'text/html,application/xhtml+xml';

@Injectable()
export class RecipePageService {
    private readonly logger = new Logger(RecipePageService.name);

    constructor(private readonly pictures: RecipePictureService) {}

    public async read(link: string): Promise<RecipePage | undefined> {
        try {
            const page = readRecipePage((await this.pictures.download(link, PAGE_TYPES)).toString('utf-8'), link);
            this.logger.log(
                `${new URL(link).hostname} read by the app: ${page.text ? 'a recipe' : 'no recipe data'}, ${page.picture ? 'a picture' : 'no picture'}`
            );

            return page;
        } catch (error) {
            this.logger.log(`a page could not be read by the app, left to the AI service: ${error}`);

            return undefined;
        }
    }
}
