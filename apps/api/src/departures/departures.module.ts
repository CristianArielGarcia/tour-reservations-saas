import { Module } from '@nestjs/common';
import { DeparturesController } from './departures.controller';
import { DeparturesService } from './departures.service';
import { CapacityEngineModule } from '../capacity-engine/capacity-engine.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [CapacityEngineModule, AuditModule],
  controllers: [DeparturesController],
  providers: [DeparturesService],
  exports: [DeparturesService],
})
export class DeparturesModule {}
