import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { ReceiptData } from "./mapper";
import { formatFCFA } from "./mapper";

const BRAND_PALETTES = [
  { solid: "#0f766e", soft: "#ecfeff", border: "#99f6e4", ink: "#134e4a" },
  { solid: "#1d4ed8", soft: "#eff6ff", border: "#bfdbfe", ink: "#1e3a8a" },
  { solid: "#b45309", soft: "#fffbeb", border: "#fcd34d", ink: "#92400e" },
  { solid: "#be123c", soft: "#fff1f2", border: "#fecdd3", ink: "#9f1239" },
  { solid: "#4338ca", soft: "#eef2ff", border: "#c7d2fe", ink: "#3730a3" },
];

const PAYMENT_THEME = {
  PAYE: { solid: "#166534", soft: "#dcfce7", border: "#86efac" },
  PARTIEL: { solid: "#92400e", soft: "#fef3c7", border: "#fcd34d" },
  IMPAYE: { solid: "#991b1b", soft: "#fee2e2", border: "#fca5a5" },
} as const;

function getBrandPalette(tenantName: string) {
  const hash = Array.from(tenantName).reduce((total, char) => total + char.charCodeAt(0), 0);
  return BRAND_PALETTES[hash % BRAND_PALETTES.length];
}

function getTenantInitials(tenantName: string) {
  const initials = tenantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "PP";
}

function isHexColor(value?: string | null) {
  return Boolean(value && /^#(?:[0-9a-fA-F]{6})$/.test(value));
}

const styles = StyleSheet.create({
  page: {
    padding: 10,
    paddingTop: 0,
    fontSize: 8,
    fontFamily: "Helvetica",
    width: "80mm",
    backgroundColor: "#ffffff",
  },
  topBand: {
    height: 6,
    marginHorizontal: -10,
    marginBottom: 6,
  },
  duplicate: {
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#b91c1c",
    marginBottom: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
  },
  brandShell: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 6,
    objectFit: "cover",
    borderRadius: 8,
  },
  logoFallback: {
    width: 36,
    height: 36,
    marginRight: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  logoFallbackText: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
  },
  brandText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 6.8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tenantName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  tenantInfo: {
    fontSize: 7,
    color: "#475569",
    marginBottom: 1,
  },
  receiptTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  receiptTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  receiptChip: {
    fontSize: 6.8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    fontFamily: "Helvetica-Bold",
  },
  metaGrid: {
    marginBottom: 6,
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 5,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 6.8,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#64748b",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginVertical: 6,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748b",
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#0f172a",
  },
  value: {
    fontSize: 8,
    color: "#334155",
    textAlign: "right",
    maxWidth: "62%",
  },
  itemSection: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 6,
    marginBottom: 6,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemName: {
    flex: 2,
    fontSize: 8,
    color: "#0f172a",
  },
  itemQty: {
    flex: 0.5,
    fontSize: 8,
    textAlign: "center",
    color: "#334155",
  },
  itemPrice: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
    color: "#0f172a",
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#0f172a",
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#0f172a",
  },
  badge: {
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 6,
  },
  qrImage: {
    width: 60,
    height: 60,
  },
  qrHint: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 6.8,
    color: "#64748b",
  },
  paymentBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
    marginBottom: 6,
  },
  paymentTitle: {
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    marginBottom: 4,
  },
  paymentLine: {
    textAlign: "center",
    fontSize: 7.2,
    marginBottom: 2,
  },
  footer: {
    textAlign: "center",
    fontSize: 7,
    color: "#475569",
    lineHeight: 1.4,
  },
});

export function ReceiptPDF({ data }: { data: ReceiptData }) {
  const badgeText =
    data.paymentStatus === "PAYE"
      ? "PAYE"
      : data.paymentStatus === "PARTIEL"
        ? "PARTIEL"
        : "IMPAYE";

  const fallbackBrand = getBrandPalette(data.tenantName);
  const brand = {
    solid: isHexColor(data.tenantPrimaryColor)
      ? data.tenantPrimaryColor!
      : fallbackBrand.solid,
    soft: isHexColor(data.tenantAccentColor)
      ? data.tenantAccentColor!
      : fallbackBrand.soft,
    border: isHexColor(data.tenantAccentColor)
      ? data.tenantAccentColor!
      : fallbackBrand.border,
    ink: fallbackBrand.ink,
  };
  const paymentTheme = PAYMENT_THEME[data.paymentStatus];
  const tenantInitials = getTenantInitials(data.tenantName);

  return (
    <Document>
      <Page size={[226.77, 1200]} style={styles.page}>
        <View style={[styles.topBand, { backgroundColor: brand.solid }]} />

        {data.isDuplicate && (
          <Text style={styles.duplicate}>*** DUPLICATA ***</Text>
        )}

        <View style={[styles.brandShell, { backgroundColor: brand.soft, borderColor: brand.border }]}>
          <View style={styles.brandRow}>
            {data.tenantLogoUrl ? (
              <Image src={data.tenantLogoUrl} style={styles.logo} />
            ) : (
              <View style={[styles.logoFallback, { backgroundColor: brand.solid }]}>
                <Text style={styles.logoFallbackText}>{tenantInitials}</Text>
              </View>
            )}

            <View style={styles.brandText}>
              <Text style={[styles.eyebrow, { color: brand.ink }]}>Identité pressing</Text>
              <Text style={styles.tenantName}>{data.tenantName}</Text>
              {data.tenantAddress && (
                <Text style={styles.tenantInfo}>{data.tenantAddress}</Text>
              )}
              {data.tenantPhone && (
                <Text style={styles.tenantInfo}>Tél: {data.tenantPhone}</Text>
              )}
            </View>
          </View>

          <View style={styles.receiptTitleRow}>
            <Text style={[styles.receiptTitle, { color: brand.ink }]}>Reçu de dépôt</Text>
            <Text style={[styles.receiptChip, { backgroundColor: "#ffffff", color: brand.solid }]}>Original</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={[styles.metaCard, { backgroundColor: "#ffffff", borderColor: brand.border }]}>
            <Text style={styles.metaLabel}>Code commande</Text>
            <Text style={styles.metaValue}>{data.orderCode}</Text>
          </View>
          <View style={[styles.metaCard, { backgroundColor: "#ffffff", borderColor: "#e2e8f0" }]}>
            <Text style={styles.metaLabel}>Déposé le</Text>
            <Text style={styles.metaValue}>{data.orderDate}</Text>
          </View>
          {data.promisedDate && (
            <View style={[styles.metaCard, { backgroundColor: brand.soft, borderColor: brand.border }]}>
              <Text style={styles.metaLabel}>Prêt le</Text>
              <Text style={styles.metaValue}>{data.promisedDate}</Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: "#ffffff" }]}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nom</Text>
            <Text style={styles.value}>{data.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Téléphone</Text>
            <Text style={styles.value}>{data.customerPhone}</Text>
          </View>
        </View>

        <View style={styles.itemSection}>
          <Text style={styles.sectionTitle}>Articles</Text>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemName, styles.label]}>Article</Text>
            <Text style={[styles.itemQty, styles.label]}>Qté</Text>
            <Text style={[styles.itemPrice, styles.label]}>Total</Text>
          </View>

          {data.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>
                {item.pricingType === "PER_KG" && item.weight
                  ? `${item.weight}kg`
                  : item.quantity}
              </Text>
              <Text style={styles.itemPrice}>{formatFCFA(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.summaryCard, { backgroundColor: brand.soft, borderColor: brand.border }]}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Avance</Text>
            <Text style={styles.value}>{formatFCFA(data.paidAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Reste</Text>
            <Text style={[styles.value, { fontFamily: "Helvetica-Bold", color: paymentTheme.solid }]}>
              {formatFCFA(data.amountDue)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatFCFA(data.totalAmount)}</Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: paymentTheme.soft,
              borderColor: paymentTheme.border,
              color: paymentTheme.solid,
            },
          ]}
        >
          <Text>{badgeText}</Text>
        </View>

        {data.qrDataUrl && (
          <View style={styles.qrContainer}>
            <Image style={styles.qrImage} src={data.qrDataUrl} />
            <Text style={styles.qrHint}>Scannez pour retrouver la commande</Text>
          </View>
        )}

        {(data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0 && (
          <View style={[styles.paymentBox, { backgroundColor: "#ffffff", borderColor: brand.border }]}>
            <Text style={[styles.paymentTitle, { color: brand.ink }]}>Paiement mobile disponible</Text>
            {data.tenantWaveNumber && (
              <Text style={[styles.paymentLine, { color: "#0f172a" }]}>Wave: {data.tenantWaveNumber}</Text>
            )}
            {data.tenantOmNumber && (
              <Text style={[styles.paymentLine, { color: "#0f172a" }]}>Orange Money: {data.tenantOmNumber}</Text>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <Text style={styles.footer}>
          Merci de votre confiance !{"\n"}
          Conservez ce reçu pour le retrait.
        </Text>
      </Page>
    </Document>
  );
}
