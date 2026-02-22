import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DeparturesService } from './departures.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateDepartureDto,
  UpdateDepartureDto,
  CloseDepartureDto,
  DepartureQueryDto,
} from './departures.dto';

@Controller('departures')
export class DeparturesController {
  constructor(private readonly departures: DeparturesService) {}

  @Get()
  @Roles('VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query() query: DepartureQueryDto) {
    return { data: await this.departures.list(user.agencyId, query) };
  }

  @Post()
  @Roles('STAFF')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartureDto) {
    return { data: await this.departures.create(user.agencyId, dto, user) };
  }

  @Patch(':departureId')
  @Roles('STAFF')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('departureId') departureId: string,
    @Body() dto: UpdateDepartureDto,
  ) {
    return { data: await this.departures.update(user.agencyId, departureId, dto, user) };
  }

  @Post(':departureId/close')
  @Roles('STAFF')
  async close(
    @CurrentUser() user: AuthUser,
    @Param('departureId') departureId: string,
    @Body() dto: CloseDepartureDto,
  ) {
    return { data: await this.departures.close(user.agencyId, departureId, dto, user) };
  }
}
