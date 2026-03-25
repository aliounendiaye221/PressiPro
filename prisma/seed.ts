import { PrismaClient, Role, OrderStatus, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin#PressiPro2026!";
  const superAdminPasswordText =
    process.env.SEED_SUPER_ADMIN_PASSWORD || "SuperAdmin#PressiPro2026!";
  const agentPasswordText = process.env.SEED_AGENT_PASSWORD || "Agent#PressiPro2026!";

  // ── Tenant Demo ──────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {},
    create: {
      id: "demo-tenant",
      name: "Pressing Élégance Rufisque",
      address: "123 Rue Abdou Diouf, Rufisque, Dakar",
      phone: "+221771234567",
    },
  });

  // ── Admin user ───────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@pressipro.sn" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@pressipro.sn",
      password: hashedPassword,
      name: "Mamadou Diallo",
      role: Role.ADMIN,
    },
  });

  // ── Super Admin user ─────────────────────────────────────
  const superAdminPassword = await bcrypt.hash(superAdminPasswordText, 12);
  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "superadmin@pressipro.sn" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "superadmin@pressipro.sn",
      password: superAdminPassword,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    },
  });

  // ── Agent user ───────────────────────────────────────────
  const agentPassword = await bcrypt.hash(agentPasswordText, 12);
  const agent = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "agent@pressipro.sn" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "agent@pressipro.sn",
      password: agentPassword,
      name: "Fatou Ndiaye",
      role: Role.AGENT,
    },
  });

  // ── Services ─────────────────────────────────────────────
  const servicesData = [
    { name: "Chemise", price: 500, category: "Repassage", isQuickItem: true, sortOrder: 1 },
    { name: "Pantalon", price: 500, category: "Repassage", isQuickItem: true, sortOrder: 2 },
    { name: "Costume complet", price: 2000, category: "Lavage", isQuickItem: true, sortOrder: 3 },
    { name: "Robe simple", price: 1000, category: "Lavage", isQuickItem: true, sortOrder: 4 },
    { name: "Robe brodée", price: 2500, category: "Lavage", isQuickItem: true, sortOrder: 5 },
    { name: "Boubou homme", price: 1500, category: "Lavage", isQuickItem: true, sortOrder: 6 },
    { name: "Boubou femme", price: 2000, category: "Lavage", isQuickItem: true, sortOrder: 7 },
    { name: "Drap", price: 1000, category: "Lavage", isQuickItem: true, sortOrder: 8 },
    { name: "Couverture", price: 2000, category: "Lavage", isQuickItem: false, sortOrder: 9 },
    { name: "Rideau", price: 1500, category: "Lavage", isQuickItem: false, sortOrder: 10 },
    { name: "Cravate", price: 500, category: "Repassage", isQuickItem: false, sortOrder: 11 },
    { name: "Veste", price: 1000, category: "Lavage", isQuickItem: true, sortOrder: 12 },
    { name: "Jupe", price: 800, category: "Lavage", isQuickItem: true, sortOrder: 13 },
    { name: "Teinture pièce", price: 3000, category: "Teinture", isQuickItem: false, sortOrder: 14 },
  ];

  const services = [];
  for (const s of servicesData) {
    const service = await prisma.service.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: s.name } },
      update: {},
      create: { tenantId: tenant.id, ...s },
    });
    services.push(service);
  }

  // ── Customers ────────────────────────────────────────────
  const customersData = [
    { name: "Aminata Sow", phone: "+221770001111" },
    { name: "Ousmane Ba", phone: "+221770002222" },
    { name: "Mariama Diop", phone: "+221770003333" },
    { name: "Ibrahima Fall", phone: "+221770004444" },
    { name: "Awa Niang", phone: "+221770005555" },
  ];

  const customers = [];
  for (const c of customersData) {
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: c.phone } },
      update: {},
      create: { tenantId: tenant.id, ...c },
    });
    customers.push(customer);
  }

  // ── Orders ───────────────────────────────────────────────
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Order 1: fully paid, PRET
  const order1 = await prisma.order.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "P-00001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "P-00001",
      customerId: customers[0].id,
      status: OrderStatus.PRET,
      totalAmount: 2000,
      paidAmount: 2000,
      promisedAt: tomorrow,
      items: {
        create: [
          { serviceId: services[0].id, name: "Chemise", quantity: 2, unitPrice: 500, total: 1000 },
          { serviceId: services[3].id, name: "Robe simple", quantity: 1, unitPrice: 1000, total: 1000 },
        ],
      },
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: OrderStatus.RECU, changedBy: admin.id },
          { fromStatus: OrderStatus.RECU, toStatus: OrderStatus.TRAITEMENT, changedBy: agent.id },
          { fromStatus: OrderStatus.TRAITEMENT, toStatus: OrderStatus.PRET, changedBy: agent.id },
        ],
      },
    },
  });

  await prisma.payment.upsert({
    where: { id: "seed-pay-1" },
    update: {},
    create: {
      id: "seed-pay-1",
      tenantId: tenant.id,
      orderId: order1.id,
      amount: 2000,
      method: PaymentMethod.CASH,
      createdBy: agent.id,
    },
  });

  // Order 2: partial payment, TRAITEMENT
  const order2 = await prisma.order.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "P-00002" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "P-00002",
      customerId: customers[1].id,
      status: OrderStatus.TRAITEMENT,
      totalAmount: 3500,
      paidAmount: 1000,
      promisedAt: yesterday, // en retard!
      items: {
        create: [
          { serviceId: services[2].id, name: "Costume complet", quantity: 1, unitPrice: 2000, total: 2000 },
          { serviceId: services[5].id, name: "Boubou homme", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: OrderStatus.RECU, changedBy: admin.id },
          { fromStatus: OrderStatus.RECU, toStatus: OrderStatus.TRAITEMENT, changedBy: agent.id },
        ],
      },
    },
  });

  await prisma.payment.upsert({
    where: { id: "seed-pay-2" },
    update: {},
    create: {
      id: "seed-pay-2",
      tenantId: tenant.id,
      orderId: order2.id,
      amount: 1000,
      method: PaymentMethod.OM,
      createdBy: agent.id,
    },
  });

  // Order 3: unpaid, RECU
  await prisma.order.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "P-00003" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "P-00003",
      customerId: customers[2].id,
      status: OrderStatus.RECU,
      totalAmount: 4000,
      paidAmount: 0,
      promisedAt: tomorrow,
      items: {
        create: [
          { serviceId: services[4].id, name: "Robe brodée", quantity: 1, unitPrice: 2500, total: 2500 },
          { serviceId: services[5].id, name: "Boubou homme", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: OrderStatus.RECU, changedBy: admin.id },
        ],
      },
    },
  });

  console.log("✅ Seed complete!");
  console.log("  Tenant:", tenant.name);
  console.log("  Admin:  admin@pressipro.sn /", adminPassword);
  console.log("  Super Admin:  superadmin@pressipro.sn /", superAdminPasswordText);
  console.log("  Agent:  agent@pressipro.sn /", agentPasswordText);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
