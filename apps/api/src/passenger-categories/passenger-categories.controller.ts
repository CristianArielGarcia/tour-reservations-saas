import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PassengerCategoriesService } from './passenger-categories.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreatePassengerCategoryDto,
  UpdatePassengerCategoryDto,
} from './passenger-categories.dto';

@Controller('passenger-categories')
export class PassengerCategoriesController {
  constructor(private readonly service: PassengerCategoriesService) {}

  @Get()
  @Roles('VIEWER')
  async list(@CurrentUser() user: AuthUser) {
    return { data: await this.service.list(user.agencyId) };
  }

  @Post()
  @Roles('STAFF')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePassengerCategoryDto) {
    return { data: await this.service.create(user.agencyId, dto) };
  }

  @Patch(':categoryId')
  @Roles('STAFF')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdatePassengerCategoryDto,
  ) {
    return { data: await this.service.update(user.agencyId, categoryId, dto) };
  }
}
