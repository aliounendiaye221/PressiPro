import { z } from "zod";

const strongPasswordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères")
  .max(100)
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial");

// ─── Auth ────────────────────────────────────────────────────
export const registerSchema = z.object({
  tenantName: z.string().min(2).max(100),
  tenantPhone: z.string().optional(),
  tenantAddress: z.string().optional(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Customer ────────────────────────────────────────────────
export const customerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z
    .string()
    .min(9)
    .max(20)
    .regex(/^\+?[0-9]+$/, "Numéro de téléphone invalide"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

// ─── Order ───────────────────────────────────────────────────
export const orderItemSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.number().int().min(1).max(999).optional(),
  weight: z.number().min(0.1).max(9999).optional(),
}).refine(
  (data) => data.quantity !== undefined || data.weight !== undefined,
  { message: "Quantité ou poids requis" }
);

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(orderItemSchema).min(1, "Au moins un article requis"),
  notes: z.string().max(500).optional().or(z.literal("")),
  promisedAt: z.string().optional(), // ISO date string
  advanceAmount: z.number().int().min(0).optional(),
  advanceMethod: z.enum(["CASH", "OM", "WAVE", "OTHER"]).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["RECU", "TRAITEMENT", "PRET", "LIVRE"]),
  note: z.string().max(500).optional(),
});

// ─── Payment ─────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  amount: z.number().int().min(1, "Montant minimum 1 FCFA"),
  method: z.enum(["CASH", "OM", "WAVE", "OTHER"]),
  note: z.string().max(500).optional().or(z.literal("")),
});

// ─── Service ─────────────────────────────────────────────────
export const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().int().min(0),
  pricingType: z.enum(["PER_ITEM", "PER_KG"]).optional(),
  category: z.string().max(50).optional().or(z.literal("")),
  isQuickItem: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ─── User (admin managing agents) ────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email(),
  password: strongPasswordSchema,
  name: z.string().min(2).max(100),
  role: z.enum(["ADMIN", "AGENT"]),
});
