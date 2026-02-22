import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { AgencyRole, ROLES_KEY, hasMinRole } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { forbidden } from '../errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minRole = this.reflector.getAllAndOverride<AgencyRole>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No role decorator — allow (JWT guard already validated membership)
    if (!minRole) return true;

    const request = context.switchToHttp().getRequest<
      FastifyRequest & { user: AuthUser }
    >();
    const user = request.user;

    if (!user || !hasMinRole(user.role, minRole)) {
      throw forbidden();
    }

    return true;
  }
}
