/**
 * seed.ts — Demo seed data for Tour Reservations SaaS
 *
 * Run with: pnpm prisma db seed
 *
 * Idempotent: uses upsert wherever possible.
 * Requires DATABASE_URL and a user already created in auth.users.
 *
 * Usage:
 *   USER_ID=<auth-user-uuid> pnpm seed
 */
import { PrismaClient, CurrencyCode } from '@prisma/client';

const prisma = new PrismaClient();

const USER_ID = process.env['USER_ID'] ?? '';

async function main() {
  if (!USER_ID) {
    console.warn('⚠️  USER_ID env var not set. Skipping profile + agency_user creation.');
  }

  // 1. Profile (mirrors auth.users)
  if (USER_ID) {
    await prisma.profile.upsert({
      where: { id: USER_ID },
      update: { fullName: 'Demo Owner' },
      create: { id: USER_ID, fullName: 'Demo Owner' },
    });
  }

  // 2. Agency
  const agency = await prisma.agency.upsert({
    where: { name: 'Demo Agency' },
    update: {},
    create: {
      name: 'Demo Agency',
      defaultCurrency: CurrencyCode.USD,
      timezone: 'America/Argentina/Ushuaia',
    },
  });
  console.log(`Agency: ${agency.id}`);

  // 3. Agency user (OWNER)
  if (USER_ID) {
    await prisma.agencyUser.upsert({
      where: { agencyId_userId: { agencyId: agency.id, userId: USER_ID } },
      update: {},
      create: {
        agencyId: agency.id,
        userId: USER_ID,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
  }

  // 4. Passenger categories
  const categories = [
    { code: 'ADULT',  name: 'Adult',  minAge: 12, maxAge: null, multiplier: 1.000, occupies: true },
    { code: 'CHILD',  name: 'Child 3-11', minAge: 3, maxAge: 11, multiplier: 0.600, occupies: true },
    { code: 'INFANT', name: 'Infant 0-2', minAge: 0, maxAge: 2,  multiplier: 0.000, occupies: true },
  ];

  for (const cat of categories) {
    await prisma.passengerCategory.upsert({
      where: { agencyId_code: { agencyId: agency.id, code: cat.code } },
      update: {
        name: cat.name,
        basePriceMultiplier: cat.multiplier,
        occupiesCapacity: cat.occupies,
      },
      create: {
        agencyId: agency.id,
        code: cat.code,
        name: cat.name,
        minAgeYears: cat.minAge,
        maxAgeYears: cat.maxAge ?? undefined,
        basePriceMultiplier: cat.multiplier,
        occupiesCapacity: cat.occupies,
      },
    });
  }
  console.log('Passenger categories seeded');

  // 5. Tour
  const tour = await prisma.tour.upsert({
    where: { agencyId_code: { agencyId: agency.id, code: 'PENGUIN_WALK' } },
    update: { name: 'Terrestrial Penguin Walk' },
    create: {
      agencyId: agency.id,
      code: 'PENGUIN_WALK',
      name: 'Terrestrial Penguin Walk',
      description: 'Visit the Martillo Island penguin colony.',
      durationMinutes: 420,
    },
  });
  console.log(`Tour: ${tour.id}`);

  // 6. Tour items
  const tourItemsData = [
    { code: 'BASE_TOUR',     name: 'Tour base price',            kind: 'BASE',  chargeType: 'PER_PERSON', optional: false, qty: 1 },
    { code: 'HARBERTON',     name: 'Harberton entrance fee',     kind: 'FEE',   chargeType: 'PER_PERSON', optional: false, qty: 1 },
    { code: 'PORT_FEE',      name: 'Port fee',                   kind: 'FEE',   chargeType: 'PER_BOOKING', optional: false, qty: 1 },
    { code: 'TRAIN_OPTION',  name: 'End of the World Train',     kind: 'ADDON', chargeType: 'PER_PERSON', optional: true,  qty: 1 },
  ] as const;

  const itemMap = new Map<string, string>(); // code → id

  for (const item of tourItemsData) {
    const ti = await prisma.tourItem.upsert({
      where: { agencyId_tourId_code: { agencyId: agency.id, tourId: tour.id, code: item.code } },
      update: { name: item.name },
      create: {
        agencyId: agency.id,
        tourId: tour.id,
        code: item.code,
        name: item.name,
        kind: item.kind,
        chargeType: item.chargeType,
        isOptional: item.optional,
        defaultQuantity: item.qty,
      },
    });
    itemMap.set(item.code, ti.id);
  }
  console.log('Tour items seeded');

  // 7. Price books
  const usdBook = await prisma.priceBook.upsert({
    where: { agencyId_currency_name: { agencyId: agency.id, currency: CurrencyCode.USD, name: 'default' } },
    update: {},
    create: { agencyId: agency.id, currency: CurrencyCode.USD, name: 'default' },
  });

  const arsBook = await prisma.priceBook.upsert({
    where: { agencyId_currency_name: { agencyId: agency.id, currency: CurrencyCode.ARS, name: 'default' } },
    update: {},
    create: { agencyId: agency.id, currency: CurrencyCode.ARS, name: 'default' },
  });
  console.log('Price books seeded');

  // 8. Prices (validity ranges for current year)
  const pricesUsd: Record<string, number> = {
    BASE_TOUR:    140.00,
    HARBERTON:     30.00,
    PORT_FEE:      15.00,
    TRAIN_OPTION:  25.00,
  };

  const pricesArs: Record<string, number> = {
    BASE_TOUR:    140000,
    HARBERTON:     30000,
    PORT_FEE:      15000,
    TRAIN_OPTION:  25000,
  };

  const validFrom = new Date('2025-01-01');

  for (const [code, price] of Object.entries(pricesUsd)) {
    const itemId = itemMap.get(code);
    if (!itemId) continue;

    // Check if a price already exists to avoid EXCLUDE constraint violation
    const existing = await prisma.tourItemPrice.findFirst({
      where: { tourItemId: itemId, priceBookId: usdBook.id, active: true },
    });

    if (!existing) {
      await prisma.tourItemPrice.create({
        data: {
          agencyId: agency.id,
          tourItemId: itemId,
          priceBookId: usdBook.id,
          validFrom,
          validTo: null,
          unitPrice: price,
        },
      });
    }
  }

  for (const [code, price] of Object.entries(pricesArs)) {
    const itemId = itemMap.get(code);
    if (!itemId) continue;

    const existing = await prisma.tourItemPrice.findFirst({
      where: { tourItemId: itemId, priceBookId: arsBook.id, active: true },
    });

    if (!existing) {
      await prisma.tourItemPrice.create({
        data: {
          agencyId: agency.id,
          tourItemId: itemId,
          priceBookId: arsBook.id,
          validFrom,
          validTo: null,
          unitPrice: price,
        },
      });
    }
  }
  console.log('Prices seeded');

  // 9. Category rules for HARBERTON: CHILD=0, INFANT=0
  const harbertonId = itemMap.get('HARBERTON');
  if (harbertonId) {
    const childCat = await prisma.passengerCategory.findFirst({
      where: { agencyId: agency.id, code: 'CHILD' },
    });
    const infantCat = await prisma.passengerCategory.findFirst({
      where: { agencyId: agency.id, code: 'INFANT' },
    });

    for (const cat of [childCat, infantCat]) {
      if (!cat) continue;
      await prisma.tourItemCategoryRule.upsert({
        where: {
          agencyId_tourItemId_passengerCategoryId: {
            agencyId: agency.id,
            tourItemId: harbertonId,
            passengerCategoryId: cat.id,
          },
        },
        update: { multiplier: 0 },
        create: {
          agencyId: agency.id,
          tourItemId: harbertonId,
          passengerCategoryId: cat.id,
          multiplier: 0,
        },
      });
    }
    console.log('Category rules seeded (HARBERTON CHILD/INFANT = 0)');
  }

  // 10. Sample departures (next 7 days)
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const startAt = new Date(now);
    startAt.setDate(startAt.getDate() + i);
    startAt.setHours(10, 0, 0, 0);

    await prisma.tourDeparture.create({
      data: {
        agencyId: agency.id,
        tourId: tour.id,
        startAt,
        capacityTotal: 20,
        status: 'ACTIVE',
        notes: `Day ${i} departure`,
      },
    });
  }
  console.log('Departures seeded (next 7 days)');

  console.log('\n✅  Seed complete.');
  console.log(`Agency ID: ${agency.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
