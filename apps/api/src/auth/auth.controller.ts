import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

/**
 * Health endpoint — public, no auth required.
 * We skip the global JwtAuthGuard by placing it outside the api/v1 prefix
 * via a separate registration in main.ts if needed, but for simplicity
 * we handle it here by bypassing via a public decorator.
 */
@Controller()
export class AuthController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return { data: { status: 'ok' } };
  }
}
