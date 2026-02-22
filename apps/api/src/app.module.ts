import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AgenciesModule } from './agencies/agencies.module';
import { ToursModule } from './tours/tours.module';
import { TourItemsModule } from './tour-items/tour-items.module';
import { PassengerCategoriesModule } from './passenger-categories/passenger-categories.module';
import { PricingModule } from './pricing/pricing.module';
import { PricingEngineModule } from './pricing-engine/pricing-engine.module';
import { CapacityEngineModule } from './capacity-engine/capacity-engine.module';
import { DeparturesModule } from './departures/departures.module';
import { ReservationsModule } from './reservations/reservations.module';
import { PaymentsModule } from './payments/payments.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AgenciesModule,
    ToursModule,
    TourItemsModule,
    PassengerCategoriesModule,
    PricingModule,
    PricingEngineModule,
    CapacityEngineModule,
    DeparturesModule,
    ReservationsModule,
    PaymentsModule,
    AuditModule,
  ],
})
export class AppModule {}
