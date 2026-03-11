/**
 * Seed script: billing data foundation
 *
 * Creates:
 * - Feature flags (billing_enabled=false, maintenance_mode=false)
 * - Subscription plans (COURSE 2990, PLATFORM 4990)
 * - Updates all courses to price=4990 isFree=false
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

  // 2. Subscription plans
  const coursePlan = await prisma.subscriptionPlan.upsert({
    where: { type: 'COURSE' },
    update: { price: 2990 },
    create: {
      type: 'COURSE',
      name: 'Подписка на курс',
      price: 2990,
      intervalDays: 30,
    },
  });
  console.log(`Plan: ${coursePlan.name} — ${coursePlan.price} руб.`);

  const platformPlan = await prisma.subscriptionPlan.upsert({
    where: { type: 'PLATFORM' },
    update: { price: 4990 },
    create: {
      type: 'PLATFORM',
      name: 'Полный доступ',
      price: 4990,
      intervalDays: 30,
    },
  });
  console.log(`Plan: ${platformPlan.name} — ${platformPlan.price} руб.`);

  // 3. Update all courses: set price=4990, isFree=false
  const updateResult = await prisma.course.updateMany({
    data: {
      price: 4990,
      isFree: false,
    },
  });
  console.log(`\nCourses updated: ${updateResult.count} (price=4990, isFree=false)`);

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
