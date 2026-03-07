import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_H7kBYAQ9XfTS@ep-summer-surf-ahsp02zb-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);
const cuid = () => crypto.randomBytes(12).toString('hex');

async function main() {
  console.log('Seeding Neon database via HTTP...');

  const tenantId = 'demo-tenant';
  const now = new Date().toISOString();

  // Tenant
  await sql.query(`INSERT INTO "Tenant" ("id","name","address","phone","waveNumber","omNumber","createdAt","updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT ("id") DO NOTHING`,
    [tenantId, 'Pressing Élégance Rufisque', '123 Rue Abdou Diouf, Rufisque, Dakar', '+221771234567', '', '', now]);
  console.log('  Tenant created');

  // Users
  const adminHash = await bcrypt.hash('admin123', 12);
  const superHash = await bcrypt.hash('super123', 12);
  const agentHash = await bcrypt.hash('agent123', 12);

  const adminId = cuid();
  const superAdminId = cuid();
  const agentId = cuid();

  const users = [
    [adminId, tenantId, 'admin@pressipro.sn', adminHash, 'Mamadou Diallo', 'ADMIN'],
    [superAdminId, tenantId, 'superadmin@pressipro.sn', superHash, 'Super Admin', 'SUPER_ADMIN'],
    [agentId, tenantId, 'agent@pressipro.sn', agentHash, 'Fatou Ndiaye', 'AGENT'],
  ];

  for (const u of users) {
    await sql.query(`INSERT INTO "User" ("id","tenantId","email","password","name","role","active","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7)
      ON CONFLICT ("tenantId","email") DO NOTHING`,
      [...u, now]);
  }
  console.log('  Users created (admin, super_admin, agent)');

  // Services
  const servicesData = [
    ['Chemise', 500, 'Repassage', true, 1],
    ['Pantalon', 500, 'Repassage', true, 2],
    ['Costume complet', 2000, 'Lavage', true, 3],
    ['Robe simple', 1000, 'Lavage', true, 4],
    ['Robe brodée', 2500, 'Lavage', true, 5],
    ['Boubou homme', 1500, 'Lavage', true, 6],
    ['Boubou femme', 2000, 'Lavage', true, 7],
    ['Drap', 1000, 'Lavage', true, 8],
    ['Couverture', 2000, 'Lavage', false, 9],
    ['Rideau', 1500, 'Lavage', false, 10],
    ['Cravate', 500, 'Repassage', false, 11],
    ['Veste', 1000, 'Lavage', true, 12],
    ['Jupe', 800, 'Lavage', true, 13],
    ['Teinture pièce', 3000, 'Teinture', false, 14],
  ];

  const serviceIds = [];
  for (const s of servicesData) {
    const id = cuid();
    serviceIds.push(id);
    await sql.query(`INSERT INTO "Service" ("id","tenantId","name","price","pricingType","category","isQuickItem","sortOrder","active","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,'PER_ITEM',$5,$6,$7,true,$8,$8)
      ON CONFLICT ("tenantId","name") DO NOTHING`,
      [id, tenantId, s[0], s[1], s[2], s[3], s[4], now]);
  }
  console.log('  14 services created');

  // Customers
  const customersData = [
    ['Aminata Sow', '+221770001111'],
    ['Ousmane Ba', '+221770002222'],
    ['Mariama Diop', '+221770003333'],
    ['Ibrahima Fall', '+221770004444'],
    ['Awa Niang', '+221770005555'],
  ];

  const customerIds = [];
  for (const c of customersData) {
    const id = cuid();
    customerIds.push(id);
    await sql.query(`INSERT INTO "Customer" ("id","tenantId","name","phone","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$5)
      ON CONFLICT ("tenantId","phone") DO NOTHING`,
      [id, tenantId, c[0], c[1], now]);
  }
  console.log('  5 customers created');

  // Orders
  const tomorrow = new Date(Date.now() + 86400000).toISOString();

  // Order 1: PRET, fully paid
  const order1Id = cuid();
  await sql.query(`INSERT INTO "Order" ("id","tenantId","code","customerId","status","totalAmount","paidAmount","promisedAt","createdAt","updatedAt")
    VALUES ($1,$2,'P-00001',$3,'PRET',2000,2000,$4,$5,$5)
    ON CONFLICT ("tenantId","code") DO NOTHING`,
    [order1Id, tenantId, customerIds[0], tomorrow, now]);

  await sql.query(`INSERT INTO "OrderItem" ("id","orderId","serviceId","name","quantity","unitPrice","total")
    VALUES ($1,$2,$3,'Chemise',2,500,1000) ON CONFLICT DO NOTHING`,
    [cuid(), order1Id, serviceIds[0]]);
  await sql.query(`INSERT INTO "OrderItem" ("id","orderId","serviceId","name","quantity","unitPrice","total")
    VALUES ($1,$2,$3,'Robe simple',1,1000,1000) ON CONFLICT DO NOTHING`,
    [cuid(), order1Id, serviceIds[3]]);

  await sql.query(`INSERT INTO "Payment" ("id","tenantId","orderId","amount","method","createdBy","createdAt")
    VALUES ('seed-pay-1',$1,$2,2000,'CASH',$3,$4) ON CONFLICT DO NOTHING`,
    [tenantId, order1Id, agentId, now]);

  // Order 2: TRAITEMENT, partial
  const order2Id = cuid();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  await sql.query(`INSERT INTO "Order" ("id","tenantId","code","customerId","status","totalAmount","paidAmount","promisedAt","createdAt","updatedAt")
    VALUES ($1,$2,'P-00002',$3,'TRAITEMENT',3500,1000,$4,$5,$5)
    ON CONFLICT ("tenantId","code") DO NOTHING`,
    [order2Id, tenantId, customerIds[1], yesterday, now]);

  await sql.query(`INSERT INTO "OrderItem" ("id","orderId","serviceId","name","quantity","unitPrice","total")
    VALUES ($1,$2,$3,'Costume complet',1,2000,2000) ON CONFLICT DO NOTHING`,
    [cuid(), order2Id, serviceIds[2]]);
  await sql.query(`INSERT INTO "OrderItem" ("id","orderId","serviceId","name","quantity","unitPrice","total")
    VALUES ($1,$2,$3,'Boubou homme',1,1500,1500) ON CONFLICT DO NOTHING`,
    [cuid(), order2Id, serviceIds[5]]);

  await sql.query(`INSERT INTO "Payment" ("id","tenantId","orderId","amount","method","createdBy","createdAt")
    VALUES ('seed-pay-2',$1,$2,1000,'OM',$3,$4) ON CONFLICT DO NOTHING`,
    [tenantId, order2Id, agentId, now]);

  // Order 3: RECU, unpaid
  const order3Id = cuid();
  await sql.query(`INSERT INTO "Order" ("id","tenantId","code","customerId","status","totalAmount","paidAmount","promisedAt","createdAt","updatedAt")
    VALUES ($1,$2,'P-00003',$3,'RECU',4000,0,$4,$5,$5)
    ON CONFLICT ("tenantId","code") DO NOTHING`,
    [order3Id, tenantId, customerIds[2], tomorrow, now]);

  await sql.query(`INSERT INTO "OrderItem" ("id","orderId","serviceId","name","quantity","unitPrice","total")
    VALUES ($1,$2,$3,'Robe brodée',1,2500,2500) ON CONFLICT DO NOTHING`,
    [cuid(), order3Id, serviceIds[4]]);
  await sql.query(`INSERT INTO "OrderItem" ("id","orderId","serviceId","name","quantity","unitPrice","total")
    VALUES ($1,$2,$3,'Boubou homme',1,1500,1500) ON CONFLICT DO NOTHING`,
    [cuid(), order3Id, serviceIds[5]]);

  console.log('  3 orders with items & payments created');

  console.log('\nSeed complete!');
  console.log('  Admin:       admin@pressipro.sn / admin123');
  console.log('  Super Admin: superadmin@pressipro.sn / super123');
  console.log('  Agent:       agent@pressipro.sn / agent123');
}

main().catch(e => { console.error(e); process.exit(1); });
