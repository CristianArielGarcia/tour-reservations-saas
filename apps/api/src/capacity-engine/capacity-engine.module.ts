import { Module } from '@nestjs/common';
import { CapacityEngineService } from './capacity-engine.service';

@Module({
  providers: [CapacityEngineService],
  exports: [CapacityEngineService],
})
export class CapacityEngineModule {}
