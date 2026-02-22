import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/**
 * Health endpoint — public, no auth required.
 * Marked with @Public() decorator to skip JWT authentication.
 */
@Controller()
export class AuthController {
  @Get('health')
  @Public()
  @HttpCode(HttpStatus.OK)
  health() {
    return { data: { status: 'ok' } };
  }
}
