import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Put,
    Query,
    StreamableFile
} from '@nestjs/common';

import { RecipeImportService } from '../../core/services/recipe-import.service';
import { RecipePictureService } from '../../core/services/recipe-picture.service';
import { RecipeOffer, RecipeService } from '../../core/services/recipe.service';
import { ScanOutcome, ScanService } from '../../core/services/scan.service';
import { RecipeEntity } from '../../data/entities';
import { RecipeAdditionDto } from '../dto/recipe-addition.dto';
import { RecipeImportDto } from '../dto/recipe-import.dto';
import { RecipePictureLinkDto } from '../dto/recipe-picture-link.dto';
import { RecipeDto } from '../dto/recipe.dto';
import { CurrentAccount } from '../guards/account.decorator';
import { OwnerOnly } from '../guards/owner.decorator';
import { Account } from '../http';

const PICTURE_TYPE = 'image/jpeg';
const PICTURE_CACHING = 'private, max-age=31536000, immutable';

@Controller({ path: 'recipes', version: '1' })
export class RecipeController {
    constructor(
        private readonly recipes: RecipeService,
        private readonly scans: ScanService,
        private readonly imports: RecipeImportService,
        private readonly pictures: RecipePictureService
    ) {}

    @Get()
    public getAll(): Promise<Array<RecipeEntity>> {
        return this.recipes.getAll();
    }

    @Post('additions')
    public add(@Body() { addedAt, ...addition }: RecipeAdditionDto): Promise<ScanOutcome> {
        return this.scans.addChosen({ ...addition, addedAt: addedAt ? new Date(addedAt) : undefined });
    }

    @Get('imports')
    public canImport(@CurrentAccount() account: Account): { available: boolean } {
        return { available: account.owner && this.imports.available };
    }

    @Post('imports')
    @OwnerOnly()
    public import(@Body() { source }: RecipeImportDto): Promise<RecipeEntity> {
        return this.imports.import(source);
    }

    @Post('pictures')
    @HttpCode(200)
    public async fetchPicture(@Body() { source }: RecipePictureLinkDto): Promise<StreamableFile> {
        const file = await this.pictures.fetch(source);

        return new StreamableFile(file, { type: PICTURE_TYPE, length: file.length });
    }

    @Get('offers')
    public getOffers(): Promise<Array<RecipeOffer>> {
        return this.recipes.getOffers();
    }

    @Post('offers/:id/save')
    public saveOffer(@Param('id', ParseIntPipe) id: number): Promise<RecipeEntity> {
        return this.recipes.saveOffer(id);
    }

    @Delete('offers/:id')
    @HttpCode(204)
    public dropOffer(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.recipes.dropOffer(id);
    }

    @Get(':id')
    public get(@Param('id', ParseIntPipe) id: number): Promise<RecipeEntity> {
        return this.recipes.get(id);
    }

    @Get(':id/picture')
    @Header('Cache-Control', PICTURE_CACHING)
    public async getPicture(
        @Param('id', ParseIntPipe) id: number,
        @Query('size') size?: string
    ): Promise<StreamableFile> {
        const file = await this.recipes.getPicture(id, size === 'large' ? 'large' : 'small');

        return new StreamableFile(file, { type: PICTURE_TYPE, length: file.length });
    }

    @Put(':id/picture')
    public setPicture(@Param('id', ParseIntPipe) id: number, @Body() picture: Buffer): Promise<RecipeEntity> {
        if (!Buffer.isBuffer(picture) || !picture.length) {
            throw new BadRequestException('The body must be a picture, sent as image/*');
        }

        return this.recipes.setPicture(id, picture);
    }

    @Delete(':id/picture')
    @HttpCode(204)
    public removePicture(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.recipes.removePicture(id);
    }

    @Post()
    public create(@Body() recipe: RecipeDto): Promise<RecipeEntity> {
        return this.recipes.create(recipe);
    }

    @Patch(':id')
    public update(@Param('id', ParseIntPipe) id: number, @Body() recipe: RecipeDto): Promise<RecipeEntity> {
        return this.recipes.update(id, recipe);
    }

    @Delete(':id')
    @HttpCode(204)
    public delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.recipes.delete(id);
    }
}
