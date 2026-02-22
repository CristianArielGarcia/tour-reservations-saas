import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ToursService } from './tours.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTourDto, UpdateTourDto } from './tours.dto';

@Controller('tours')
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Get()
  @Roles('VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query('active') active?: string) {
    const activeFilter =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return { data: await this.tours.list(user.agencyId, activeFilter) };
  }

  @Post()
  @Roles('STAFF')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTourDto) {
    return { data: await this.tours.create(user.agencyId, dto) };
  }

  @Get(':tourId')
  @Roles('VIEWER')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('tourId') tourId: string,
  ) {
    return { data: await this.tours.findOne(user.agencyId, tourId) };
  }

  @Patch(':tourId')
  @Roles('STAFF')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('tourId') tourId: string,
    @Body() dto: UpdateTourDto,
  ) {
    return { data: await this.tours.update(user.agencyId, tourId, dto) };
  }
}
