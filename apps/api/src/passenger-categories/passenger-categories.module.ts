import { Module } from '@nestjs/common';
import { PassengerCategoriesController } from './passenger-categories.controller';
import { PassengerCategoriesService } from './passenger-categories.service';

@Module({
  controllers: [PassengerCategoriesController],
  providers: [PassengerCategoriesService],
  exports: [PassengerCategoriesService],
})
export class PassengerCategoriesModule {}
