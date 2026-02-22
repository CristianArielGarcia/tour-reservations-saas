import { Module } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';

@Module({
  providers: [PricingEngineService],
  exports: [PricingEngineService],
})
export class PricingEngineModule {}
