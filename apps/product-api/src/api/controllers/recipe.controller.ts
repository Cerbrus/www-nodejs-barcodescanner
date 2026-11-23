import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';

import { RecipeOffer, RecipeService } from '../../core/services/recipe.service';
import { ScanOutcome, ScanService } from '../../core/services/scan.service';
import { RecipeEntity } from '../../data/entities';
import { RecipeAdditionDto } from '../dto/recipe-addition.dto';
import { RecipeDto } from '../dto/recipe.dto';

@Controller({ path: 'recipes', version: '1' })
export class RecipeController {
    constructor(
        private readonly recipes: RecipeService,
        private readonly scans: ScanService
    ) {}

    @Get()
    public getAll(): Promise<Array<RecipeEntity>> {
        return this.recipes.getAll();
    }

    @Post('additions')
    public add(@Body() addition: RecipeAdditionDto): Promise<ScanOutcome> {
        return this.scans.addRecipe(addition, 'app');
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
