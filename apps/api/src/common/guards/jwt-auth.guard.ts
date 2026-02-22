import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';
import { PUBLIC_KEY } from '../decorators/public.decorator';

// Minimal JWT verification without external library — uses HS256 with the
// Supabase JWT secret. For production, use @supabase/supabase-js verifyJwt
// or jsonwebtoken with the RS256 public key if using Supabase JWTs.

function base64UrlDecode(str: string): Buffer {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyHs256Jwt(token: string, secret: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [headerB64, payloadB64, sigB64] = parts;
  const signInput = `${headerB64}.${payloadB64}`;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signInput)
    .digest('base64url');

  if (expectedSig !== sigB64) throw new Error('Invalid JWT signature');

  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as Record<string, unknown>;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload['exp'] === 'number' && payload['exp'] < now) {
    throw new Error('JWT expired');
  }

  return payload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      FastifyRequest & { user: AuthUser }
    >();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({ error: { code: 'unauthenticated', message: 'Missing Bearer token.' } });
    }

    const token = authHeader.slice(7);
    const jwtSecret = this.config.get<string>('SUPABASE_JWT_SECRET') ?? '';

    let payload: Record<string, unknown>;
    try {
      payload = verifyHs256Jwt(token, jwtSecret);
    } catch {
      throw new UnauthorizedException({ error: { code: 'unauthenticated', message: 'Invalid or expired token.' } });
    }

    const userId = payload['sub'] as string | undefined;
    if (!userId) {
      throw new UnauthorizedException({ error: { code: 'unauthenticated', message: 'Token missing subject.' } });
    }

    // Resolve agency context
    const agencyIdHeader = request.headers['x-agency-id'] as string | undefined;

    // Find user's active membership
    const whereClause = agencyIdHeader
      ? { userId, agencyId: agencyIdHeader, status: 'ACTIVE' }
      : { userId, status: 'ACTIVE' };

    const membership = await this.prisma.agencyUser.findFirst({
      where: whereClause,
      include: { agency: true },
    });

    if (!membership) {
      throw new UnauthorizedException({
        error: {
          code: 'forbidden',
          message: agencyIdHeader
            ? 'User is not an active member of the specified agency.'
            : 'User has no active agency membership.',
        },
      });
    }

    request.user = {
      id: userId,
      email: (payload['email'] as string) ?? '',
      agencyId: membership.agencyId,
      role: membership.role,
    };

    return true;
  }
}
