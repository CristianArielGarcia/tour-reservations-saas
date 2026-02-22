import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreatePriceBookDto,
  CreateTourItemPriceDto,
  ClosePriceDto,
  UpdatePriceDto,
  CreateCategoryRuleDto,
  UpdateCategoryRuleDto,
} from './pricing.dto';

@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  // ─── Price Books ────────────────────────────────────────────────────────────

  @Get('price-books')
  @Roles('STAFF_PRICING')
  async listPriceBooks(@CurrentUser() user: AuthUser) {
    return { data: await this.pricing.listPriceBooks(user.agencyId) };
  }

  @Post('price-books')
  @Roles('STAFF_PRICING')
  async createPriceBook(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceBookDto) {
    return { data: await this.pricing.createPriceBook(user.agencyId, dto) };
  }

  // ─── Tour Item Prices ────────────────────────────────────────────────────────

  @Get('tour-items/:itemId/prices')
  @Roles('STAFF_PRICING')
  async listPrices(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Query('price_book_id') priceBookId: string,
  ) {
    return { data: await this.pricing.listPrices(user.agencyId, itemId, priceBookId) };
  }

  @Post('tour-items/:itemId/prices')
  @Roles('STAFF_PRICING')
  async createPrice(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: CreateTourItemPriceDto,
  ) {
    return { data: await this.pricing.createPrice(user.agencyId, itemId, dto) };
  }

  @Post('tour-item-prices/:priceId/close')
  @Roles('STAFF_PRICING')
  async closePrice(
    @CurrentUser() user: AuthUser,
    @Param('priceId') priceId: string,
    @Body() dto: ClosePriceDto,
  ) {
    return { data: await this.pricing.closePrice(user.agencyId, priceId, dto) };
  }

  @Patch('tour-item-prices/:priceId')
  @Roles('STAFF_PRICING')
  async updatePrice(
    @CurrentUser() user: AuthUser,
    @Param('priceId') priceId: string,
    @Body() dto: UpdatePriceDto,
  ) {
    return { data: await this.pricing.updatePrice(user.agencyId, priceId, dto) };
  }

  // ─── Category Rules ──────────────────────────────────────────────────────────

  @Get('tour-items/:itemId/category-rules')
  @Roles('STAFF_PRICING')
  async listCategoryRules(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
  ) {
    return { data: await this.pricing.listCategoryRules(user.agencyId, itemId) };
  }

  @Post('tour-items/:itemId/category-rules')
  @Roles('STAFF_PRICING')
  async createCategoryRule(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: CreateCategoryRuleDto,
  ) {
    return { data: await this.pricing.createCategoryRule(user.agencyId, itemId, dto) };
  }

  @Patch('tour-item-category-rules/:ruleId')
  @Roles('STAFF_PRICING')
  async updateCategoryRule(
    @CurrentUser() user: AuthUser,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateCategoryRuleDto,
  ) {
    return { data: await this.pricing.updateCategoryRule(user.agencyId, ruleId, dto) };
  }
}
