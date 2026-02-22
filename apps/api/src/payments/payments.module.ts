import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PricingEngineModule, AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
