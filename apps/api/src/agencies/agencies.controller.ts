import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { IsString, IsIn, IsOptional, IsEmail } from 'class-validator';

class UpdateUserRoleDto {
  @IsString()
  @IsIn(['OWNER', 'STAFF', 'STAFF_PRICING', 'VIEWER'])
  role!: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['OWNER', 'STAFF', 'STAFF_PRICING', 'VIEWER'])
  role!: string;
}

@Controller()
export class AgenciesController {
  constructor(private readonly agencies: AgenciesService) {}

  @Get('me/agencies')
  async getMyAgencies(@CurrentUser() user: AuthUser) {
    return { data: await this.agencies.getMyAgencies(user.id) };
  }

  @Get('agencies/:agencyId/users')
  @Roles('OWNER')
  async listUsers(@Param('agencyId') agencyId: string, @CurrentUser() user: AuthUser) {
    // Ensure requesting user belongs to this agency
    if (user.agencyId !== agencyId) {
      const { forbidden } = await import('../common/errors');
      throw forbidden();
    }
    const users = await this.agencies.listUsers(agencyId);
    return {
      data: users.map((u) => ({
        user_id: u.userId,
        full_name: u.user.fullName,
        role: u.role,
        status: u.status,
      })),
    };
  }

  @Post('agencies/:agencyId/users/invite')
  @Roles('OWNER')
  async inviteUser(
    @Param('agencyId') agencyId: string,
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.agencyId !== agencyId) {
      const { forbidden } = await import('../common/errors');
      throw forbidden();
    }
    return {
      data: await this.agencies.inviteUser(agencyId, dto.email, dto.role),
    };
  }

  @Patch('agencies/:agencyId/users/:userId')
  @Roles('OWNER')
  async updateUserRole(
    @Param('agencyId') agencyId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.agencyId !== agencyId) {
      const { forbidden } = await import('../common/errors');
      throw forbidden();
    }
    return {
      data: await this.agencies.updateUserRole(agencyId, userId, dto.role, dto.status ?? 'ACTIVE'),
    };
  }
}
