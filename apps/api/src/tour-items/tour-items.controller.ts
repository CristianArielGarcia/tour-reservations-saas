import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TourItemsService } from './tour-items.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTourItemDto, UpdateTourItemDto } from './tour-items.dto';

@Controller()
export class TourItemsController {
  constructor(private readonly items: TourItemsService) {}

  @Get('tours/:tourId/items')
  @Roles('VIEWER')
  async list(@CurrentUser() user: AuthUser, @Param('tourId') tourId: string) {
    return { data: await this.items.list(user.agencyId, tourId) };
  }

  @Post('tours/:tourId/items')
  @Roles('STAFF')
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourItemDto,
  ) {
    return { data: await this.items.create(user.agencyId, tourId, dto) };
  }

  @Patch('tour-items/:itemId')
  @Roles('STAFF')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTourItemDto,
  ) {
    return { data: await this.items.update(user.agencyId, itemId, dto) };
  }
}
