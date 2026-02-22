import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
