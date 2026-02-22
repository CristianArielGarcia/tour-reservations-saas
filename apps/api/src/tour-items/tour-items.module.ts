import { Module } from '@nestjs/common';
import { TourItemsController } from './tour-items.controller';
import { TourItemsService } from './tour-items.service';

@Module({
  controllers: [TourItemsController],
  providers: [TourItemsService],
  exports: [TourItemsService],
})
export class TourItemsModule {}
