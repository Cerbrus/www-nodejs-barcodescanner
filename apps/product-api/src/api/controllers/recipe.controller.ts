import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';

import { RecipeImportService } from '../../core/services/recipe-import.service';
import { RecipeOffer, RecipeService } from '../../core/services/recipe.service';
import { ScanOutcome, ScanService } from '../../core/services/scan.service';
import { RecipeEntity } from '../../data/entities';
import { RecipeAdditionDto } from '../dto/recipe-addition.dto';
import { RecipeImportDto } from '../dto/recipe-import.dto';
import { RecipeDto } from '../dto/recipe.dto';
import { CurrentAccount } from '../guards/account.decorator';
import { OwnerOnly } from '../guards/owner.decorator';
import { Account } from '../http';

@Controller({ path: 'recipes', version: '1' })
export class RecipeController {
    constructor(
        private readonly recipes: RecipeService,
        private readonly scans: ScanService,
        private readonly imports: RecipeImportService
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
