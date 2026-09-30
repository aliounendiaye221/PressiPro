import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tenantId = "demo-tenant";
  const user = await prisma.user.findFirst({ where: { tenantId } });
  const userId = user?.id || null;

  const customers = await prisma.customer.findMany({ where: { tenantId } });
  const services = await prisma.service.findMany({ where: { tenantId } });

  if (customers.length === 0 || services.length === 0) {
    console.log("No customers or services in demo-tenant!");
    return;
  }

  console.log("Synchronizing realistic September 2026 numbers for demo-tenant...");

  // 1. Sync expenses for September 2026
  const existingExpenses = await prisma.expense.count({ where: { tenantId } });
  if (existingExpenses === 0) {
    console.log("Creating realistic laundry expenses for September 2026...");
    await prisma.expense.createMany({
      data: [
        {
          tenantId,
          category: "PRODUITS",
          description: "Achat 2 fûts de lessive liquide professionnelle 20L",
          amount: 32000,
          date: new Date("2026-09-04T10:30:00Z"),
          paymentMethod: "WAVE",
          supplier: "Comptoir Chimique Dakar",
          notes: "Facture N° 2026-09-881",
        },
        {
          tenantId,
          category: "MATERIEL",
          description: "Carton de cintres métalliques & rouleaux de housses",
          amount: 22000,
          date: new Date("2026-09-08T14:00:00Z"),
          paymentMethod: "WAVE",
          supplier: "Emballages Express Rufisque",
          notes: "500 cintres + 2 rouleaux housses",
        },
        {
          tenantId,
          category: "CHARGES_FIXES",
          description: "Facture électricité Senelec atelier pressing",
          amount: 42000,
          date: new Date("2026-09-10T16:00:00Z"),
          paymentMethod: "OM",
          supplier: "Senelec",
          notes: "Consommation fers & chaudières à vapeur",
        },
        {
          tenantId,
          category: "PRODUITS",
          description: "Assouplissant floral & détachants textiles délicats",
          amount: 18500,
          date: new Date("2026-09-14T11:20:00Z"),
          paymentMethod: "CASH",
          supplier: "Dakar Détachage Pro",
          notes: "Reçu espèces",
        },
        {
          tenantId,
          category: "MATERIEL",
          description: "Maintenance fer à vapeur & remplacement semelle teflon",
          amount: 9500,
          date: new Date("2026-09-20T15:45:00Z"),
          paymentMethod: "CASH",
          supplier: "Atelier Réparation Rufisque",
          notes: "Changement de joint et détartrage",
        },
        {
          tenantId,
          category: "LIVRAISON",
          description: "Carburant moto livraison dépôts à domicile",
          amount: 14000,
          date: new Date("2026-09-27T09:15:00Z"),
          paymentMethod: "WAVE",
          supplier: "Station Total Rufisque",
          notes: "Tournées clients semaine 39",
        },
      ],
    });
    console.log("6 expenses created!");
  }

  // 2. Check orders & payments in September 2026
  const septPayments = await prisma.payment.findMany({
    where: {
      tenantId,
      createdAt: { gte: new Date("2026-09-01T00:00:00Z") },
    },
  });

  console.log(`Existing September payments: ${septPayments.length}`);

  if (septPayments.length < 5) {
    console.log("Adding realistic September 2026 orders and payments...");

    // Order A: Today (2026-09-30) - Mariama Diop - 18 500 F, paid in full Wave
    const orderA = await prisma.order.create({
      data: {
        tenantId,
        code: "P-00043",
        customerId: customers[0].id,
        totalAmount: 18500,
        paidAmount: 18500,
        status: "PRET",
        notes: "Lavage délicat boubous soie et brodés",
        promisedAt: new Date("2026-10-02T16:00:00Z"),
        createdAt: new Date("2026-09-30T09:30:00Z"),
        items: {
          create: [
            { name: "Boubou 3 pièces brodé", quantity: 2, unitPrice: 3500, total: 7000, serviceId: services[0].id },
            { name: "Costume complet", quantity: 3, unitPrice: 2500, total: 7500, serviceId: services[0].id },
            { name: "Robe de soirée", quantity: 2, unitPrice: 2000, total: 4000, serviceId: services[0].id },
          ],
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: "RECU", createdAt: new Date("2026-09-30T09:30:00Z") },
            { fromStatus: "RECU", toStatus: "TRAITEMENT", createdAt: new Date("2026-09-30T11:00:00Z") },
            { fromStatus: "TRAITEMENT", toStatus: "PRET", createdAt: new Date("2026-09-30T17:00:00Z") },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: orderA.id,
        amount: 18500,
        method: "WAVE",
        createdBy: userId,
        createdAt: new Date("2026-09-30T09:32:00Z"),
      },
    });

    // Order B: Today (2026-09-30) - Alioune Ndiaye - 14 000 F, paid 7 000 F cash
    const orderB = await prisma.order.create({
      data: {
        tenantId,
        code: "P-00044",
        customerId: customers[3]?.id || customers[1].id,
        totalAmount: 14000,
        paidAmount: 7000,
        status: "TRAITEMENT",
        notes: "Repassage amidonné chemises",
        promisedAt: new Date("2026-10-01T17:00:00Z"),
        createdAt: new Date("2026-09-30T11:15:00Z"),
        items: {
          create: [
            { name: "Chemise homme", quantity: 6, unitPrice: 1000, total: 6000, serviceId: services[0].id },
            { name: "Pantalon tissu", quantity: 4, unitPrice: 2000, total: 8000, serviceId: services[0].id },
          ],
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: "RECU", createdAt: new Date("2026-09-30T11:15:00Z") },
            { fromStatus: "RECU", toStatus: "TRAITEMENT", createdAt: new Date("2026-09-30T14:30:00Z") },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: orderB.id,
        amount: 7000,
        method: "CASH",
        createdBy: userId,
        createdAt: new Date("2026-09-30T11:16:00Z"),
      },
    });

    // Order C: This week (2026-09-28) - Ousmane Ba - 32 000 F, paid 32 000 F OM
    const orderC = await prisma.order.create({
      data: {
        tenantId,
        code: "P-00045",
        customerId: customers[1].id,
        totalAmount: 32000,
        paidAmount: 32000,
        status: "PRET",
        notes: "Rideaux et couettes",
        promisedAt: new Date("2026-09-30T12:00:00Z"),
        createdAt: new Date("2026-09-28T10:00:00Z"),
        items: {
          create: [
            { name: "Couette grand lit", quantity: 2, unitPrice: 6000, total: 12000, serviceId: services[0].id },
            { name: "Grand rideau salon", quantity: 4, unitPrice: 5000, total: 20000, serviceId: services[0].id },
          ],
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: "RECU", createdAt: new Date("2026-09-28T10:00:00Z") },
            { fromStatus: "RECU", toStatus: "TRAITEMENT", createdAt: new Date("2026-09-28T14:00:00Z") },
            { fromStatus: "TRAITEMENT", toStatus: "PRET", createdAt: new Date("2026-09-29T18:00:00Z") },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: orderC.id,
        amount: 32000,
        method: "OM",
        createdBy: userId,
        createdAt: new Date("2026-09-28T10:02:00Z"),
      },
    });

    // Order D: Earlier in September (2026-09-15) - Aminata Sow - 45 000 F, paid Wave
    const orderD = await prisma.order.create({
      data: {
        tenantId,
        code: "P-00046",
        customerId: customers[2].id,
        totalAmount: 45000,
        paidAmount: 45000,
        status: "LIVRE",
        promisedAt: new Date("2026-09-17T18:00:00Z"),
        createdAt: new Date("2026-09-15T09:00:00Z"),
        items: {
          create: [
            { name: "Linge au kilo famille", quantity: 1, weight: 15, unitPrice: 3000, total: 45000, serviceId: services[0].id },
          ],
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: "RECU", createdAt: new Date("2026-09-15T09:00:00Z") },
            { fromStatus: "RECU", toStatus: "LIVRE", createdAt: new Date("2026-09-17T18:00:00Z") },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: orderD.id,
        amount: 45000,
        method: "WAVE",
        createdBy: userId,
        createdAt: new Date("2026-09-15T09:05:00Z"),
      },
    });

    // Order E: Earlier in September (2026-09-08) - Mame Cheikh Diop - 55 000 F, paid Cash
    const orderE = await prisma.order.create({
      data: {
        tenantId,
        code: "P-00047",
        customerId: customers[4]?.id || customers[0].id,
        totalAmount: 55000,
        paidAmount: 55000,
        status: "LIVRE",
        promisedAt: new Date("2026-09-10T18:00:00Z"),
        createdAt: new Date("2026-09-08T11:00:00Z"),
        items: {
          create: [
            { name: "Costumes traditionnels", quantity: 5, unitPrice: 7000, total: 35000, serviceId: services[0].id },
            { name: "Couettes & draps", quantity: 4, unitPrice: 5000, total: 20000, serviceId: services[0].id },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: orderE.id,
        amount: 55000,
        method: "CASH",
        createdBy: userId,
        createdAt: new Date("2026-09-08T11:05:00Z"),
      },
    });

    // Order F: Earlier in September (2026-09-22) - 62 000 F, paid OM
    const orderF = await prisma.order.create({
      data: {
        tenantId,
        code: "P-00048",
        customerId: customers[1].id,
        totalAmount: 62000,
        paidAmount: 62000,
        status: "LIVRE",
        createdAt: new Date("2026-09-22T14:00:00Z"),
        items: {
          create: [
            { name: "Draps hôtel & serviettes", quantity: 20, unitPrice: 3100, total: 62000, serviceId: services[0].id },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        tenantId,
        orderId: orderF.id,
        amount: 62000,
        method: "OM",
        createdBy: userId,
        createdAt: new Date("2026-09-22T14:05:00Z"),
      },
    });

    console.log("Orders and payments successfully created for September 2026!");
  }

  console.log("Sync complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
