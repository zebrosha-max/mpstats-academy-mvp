/**
 * Seed script: billing data foundation
 *
 * Creates:
 * - Feature flags (billing_enabled=false, maintenance_mode=false)
 * - Subscription plans (COURSE 1990, PLATFORM 2990)
 * - Updates all courses to price=2990 isFree=false
 *
 * Run:
 *   npx tsx scripts/seed/seed-billing.ts
 *   pnpm db:seed-billing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding billing data...\n');

  // 1. Feature flags
  const billingFlag = await prisma.featureFlag.upsert({
    where: { key: 'billing_enabled' },
    update: {},
    create: {
      key: 'billing_enabled',
      enabled: false,
      description: 'Enable billing and subscription features',
    },
  });
  console.log(`Feature flag: ${billingFlag.key} = ${billingFlag.enabled}`);

  const maintenanceFlag = await prisma.featureFlag.upsert({
    where: { key: 'maintenance_mode' },
    update: {},
    create: {
      key: 'maintenance_mode',
      enabled: false,
      description: 'Show maintenance page to non-admin users',
    },
  });
  console.log(`Feature flag: ${maintenanceFlag.key} = ${maintenanceFlag.enabled}`);

  // 2. Subscription plans — @unique on type was dropped to support hidden
  // test plans. Seed the public (non-hidden) plan of each type, creating
  // it if missing, updating price if it already exists.
  const seedPlan = async (
    type: 'COURSE' | 'PLATFORM',
    name: string,
    price: number,
  ) => {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { type, hidden: false },
    });
    if (existing) {
      return prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: { price, name },
      });
    }
    return prisma.subscriptionPlan.create({
      data: { type, name, price, intervalDays: 30, hidden: false },
    });
  };

  const coursePlan = await seedPlan('COURSE', 'Подписка на курс', 1990);
  console.log(`Plan: ${coursePlan.name} — ${coursePlan.price} руб.`);

  const platformPlan = await seedPlan('PLATFORM', 'Полный доступ', 2990);
  console.log(`Plan: ${platformPlan.name} — ${platformPlan.price} руб.`);

  // 3. Update all courses: set price=2990, isFree=false
  const updateResult = await prisma.course.updateMany({
    data: {
      price: 2990,
      isFree: false,
    },
  });
  console.log(`\nCourses updated: ${updateResult.count} (price=2990, isFree=false)`);

  console.log('\nBilling seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
