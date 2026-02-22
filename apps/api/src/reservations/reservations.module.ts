import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { CapacityEngineModule } from '../capacity-engine/capacity-engine.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PricingEngineModule, CapacityEngineModule, AuditModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
