import { z } from "zod";
import { normalizePhoneForStorage } from "./phone";

export const MAX_FCFA_AMOUNT = 1_000_000_000; // 1 milliard FCFA (< INT4 max 2,147,483,647)

export const strongPasswordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères")
  .max(100, "Le mot de passe ne doit pas dépasser 100 caractères")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial");

const optionalValidDateStringSchema = z
  .string()
  .refine(
    (val) => val === "" || !Number.isNaN(new Date(val).getTime()),
    "Format de date invalide"
  );

// ─── Auth ────────────────────────────────────────────────────
export const registerSchema = z.object({
  tenantName: z.string().min(2).max(100),
  tenantPhone: z.string().max(30).optional(),
  tenantAddress: z.string().max(200).optional(),
  name: z.string().min(2).max(100),
  email: z.string().email().max(150),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().email().max(150),
  password: z.string().min(1).max(128),
});

// ─── Customer ────────────────────────────────────────────────
const normalizedPhoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .transform((value) => normalizePhoneForStorage(value))
  .refine((value): value is string => Boolean(value), "Numéro de téléphone invalide");

export const customerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: normalizedPhoneSchema,
  email: z.string().email().max(150).optional().or(z.literal("")),
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
  items: z.array(orderItemSchema).min(1, "Au moins un article requis").max(200),
  notes: z.string().max(500).optional().or(z.literal("")),
  promisedAt: optionalValidDateStringSchema.optional(),
  advanceAmount: z.number().int().min(0).max(MAX_FCFA_AMOUNT).optional(),
  advanceMethod: z.enum(["CASH", "OM", "WAVE", "OTHER"]).optional(),
  discountAmount: z.number().int().min(0).max(MAX_FCFA_AMOUNT).optional(),
  discountReason: z.string().max(200).optional().or(z.literal("")),
  clientRequestId: z.string().max(100).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["RECU", "TRAITEMENT", "PRET", "LIVRE"]),
  note: z.string().max(500).optional(),
});

export const updateOrderSchema = z.object({
  notes: z.string().max(500).optional().or(z.literal("")),
  promisedAt: optionalValidDateStringSchema.optional().nullable(),
  items: z.array(orderItemSchema).min(1, "Au moins un article requis").max(200).optional(),
  discountAmount: z.number().int().min(0).max(MAX_FCFA_AMOUNT).optional(),
  discountReason: z.string().max(200).optional().or(z.literal("")),
  clientRequestId: z.string().max(100).optional(),
});

// ─── Payment ─────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  amount: z.number().int().min(1, "Montant minimum 1 FCFA").max(MAX_FCFA_AMOUNT),
  method: z.enum(["CASH", "OM", "WAVE", "OTHER"]),
  note: z.string().max(500).optional().or(z.literal("")),
  clientRequestId: z.string().max(100).optional(),
});

// ─── Service ─────────────────────────────────────────────────
export const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().int().min(0).max(MAX_FCFA_AMOUNT),
  pricingType: z.enum(["PER_ITEM", "PER_KG"]).optional(),
  category: z.string().max(50).optional().or(z.literal("")),
  isQuickItem: z.boolean().optional(),
  sortOrder: z.number().int().min(-1000).max(10000).optional(),
});

// ─── User (admin managing agents) ────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email().max(150),
  password: strongPasswordSchema,
  name: z.string().min(2).max(100),
  role: z.enum(["ADMIN", "AGENT"]),
});

// ─── Expense ────────────────────────────────────────────────
export const expenseCategoryEnum = z.enum([
  "PRODUITS",
  "LIVRAISON",
  "MATERIEL",
  "CHARGES_FIXES",
  "SALAIRES",
  "AUTRE",
]);

export const createExpenseSchema = z.object({
  description: z.string().min(1, "La description est requise").max(200),
  amount: z.number().int().min(1, "Le montant doit être au moins 1 FCFA").max(MAX_FCFA_AMOUNT),
  category: expenseCategoryEnum.default("AUTRE"),
  date: optionalValidDateStringSchema.optional(),
  paymentMethod: z.enum(["CASH", "OM", "WAVE", "OTHER"]).default("CASH"),
  supplier: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const updateExpenseSchema = createExpenseSchema.partial();
