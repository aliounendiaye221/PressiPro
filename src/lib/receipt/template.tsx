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

function isHexColor(value?: string | null) {
  return Boolean(value && /^#(?:[0-9a-fA-F]{6})$/.test(value));
}

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontSize: 9,
    fontFamily: "Helvetica",
    width: "80mm",
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  topBand: {
    height: 4,
    marginHorizontal: -12,
    marginTop: -12,
    marginBottom: 8,
  },
  duplicateText: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#000000",
    paddingVertical: 2,
  },
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  logo: {
    width: 45,
    height: 45,
    marginBottom: 4,
    objectFit: "contain",
  },
  tenantName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  tenantInfo: {
    fontSize: 8,
    textAlign: "center",
    color: "#333333",
    marginBottom: 2,
  },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginVertical: 4,
  },
  dividerDashed: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomStyle: "dashed",
    marginVertical: 6,
  },
  dividerSolid: {
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
    marginVertical: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  label: {
    fontSize: 8,
    color: "#555555",
  },
  value: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    maxWidth: "65%",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 2,
    marginBottom: 4,
  },
  colArticle: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold" },
  colQty: { flex: 0.8, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center" },
  colTotal: { flex: 1.2, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" },
  itemRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  itemArticle: { flex: 2, fontSize: 8 },
  itemQty: { flex: 0.8, fontSize: 8, textAlign: "center" },
  itemTotal: { flex: 1.2, fontSize: 8, textAlign: "right" },
  totalsContainer: {
    marginTop: 4,
    width: "100%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalLabel: {
    fontSize: 9,
  },
  totalValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  paymentStatus: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginVertical: 6,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000000",
    textTransform: "uppercase",
  },
  qrContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  qrImage: {
    width: 65,
    height: 65,
  },
  qrHint: {
    fontSize: 7,
    color: "#555555",
    marginTop: 2,
    textAlign: "center",
  },
  paymentInfo: {
    marginTop: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: "#000000",
    borderStyle: "dashed",
    borderRadius: 4,
  },
  paymentInfoTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  paymentInfoLine: {
    fontSize: 8,
    textAlign: "center",
  },
  footer: {
    fontSize: 8,
    textAlign: "center",
    color: "#333333",
    marginTop: 8,
    lineHeight: 1.4,
  },
});

export function ReceiptPDF({ data }: { data: ReceiptData }) {
  const badgeText =
    data.paymentStatus === "PAYE"
      ? "PAYÉ"
      : data.paymentStatus === "PARTIEL"
        ? "PAIEMENT PARTIEL"
        : "NON PAYÉ";

  const fallbackBrand = getBrandPalette(data.tenantName);
  const brand = {
    solid: isHexColor(data.tenantPrimaryColor) ? data.tenantPrimaryColor! : fallbackBrand.solid,
    soft: isHexColor(data.tenantAccentColor) ? data.tenantAccentColor! : fallbackBrand.soft,
    ink: isHexColor(data.tenantPrimaryColor) ? data.tenantPrimaryColor! : fallbackBrand.ink,
  };
  const paymentTheme = PAYMENT_THEME[data.paymentStatus];

  // Dynamically calculate the perfect height for the receipt based on elements present
  const baseHeight = 390; // Approx sum of padding, fixed headers, footers, totals, separators
  const itemsHeight = data.items.length * 16;
  const duplicateHeight = data.isDuplicate ? 26 : 0;
  const paymentInfoHeight =
    (data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0 ? 50 : 0;
  const qrHeight = data.qrDataUrl ? 90 : 0;
  const dynamicHeight =
    baseHeight + itemsHeight + duplicateHeight + paymentInfoHeight + qrHeight;

  return (
    <Document>
      <Page size={[226.77, dynamicHeight]} style={styles.page}>
        <View style={[styles.topBand, { backgroundColor: brand.solid }]} />

        {data.isDuplicate && (
          <Text style={styles.duplicateText}>DUPLICATA</Text>
        )}

        <View style={styles.header}>
          {data.tenantLogoUrl && (
            <Image src={data.tenantLogoUrl} style={styles.logo} />
          )}
          <Text style={[styles.tenantName, { color: brand.ink }]}>{data.tenantName}</Text>
          {data.tenantAddress && (
            <Text style={styles.tenantInfo}>{data.tenantAddress}</Text>
          )}
          {data.tenantPhone && (
            <Text style={styles.tenantInfo}>Tél: {data.tenantPhone}</Text>
          )}
        </View>

        <Text style={[styles.title, { color: brand.solid }]}>Reçu de dépôt</Text>

        <View style={[styles.dividerDashed, { borderBottomColor: brand.solid, opacity: 0.5 }]} />

        <View style={styles.row}>
          <Text style={styles.label}>N° Commande:</Text>
          <Text style={styles.value}>{data.orderCode}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>{data.orderDate}</Text>
        </View>
        {data.promisedDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Prêt le:</Text>
            <Text style={styles.value}>{data.promisedDate}</Text>
          </View>
        )}

        <View style={styles.dividerSolid} />

        <View style={styles.row}>
          <Text style={styles.label}>Client:</Text>
          <Text style={styles.value}>{data.customerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Contact:</Text>
          <Text style={styles.value}>{data.customerPhone}</Text>
        </View>

        <View style={styles.dividerSolid} />

        <View style={styles.tableHeader}>
          <Text style={styles.colArticle}>Article</Text>
          <Text style={styles.colQty}>Qté</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>

        {data.items.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemArticle}>{item.name}</Text>
            <Text style={styles.itemQty}>
              {item.pricingType === "PER_KG" && item.weight
                ? `${item.weight}kg`
                : item.quantity}
            </Text>
            <Text style={styles.itemTotal}>{formatFCFA(item.total)}</Text>
          </View>
        ))}

        <View style={styles.dividerSolid} />

        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL:</Text>
            <Text style={styles.grandTotalValue}>{formatFCFA(data.totalAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Avance:</Text>
            <Text style={styles.totalValue}>{formatFCFA(data.paidAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Reste à payer:</Text>
            <Text style={[styles.totalValue, { color: paymentTheme.solid }]}>{formatFCFA(data.amountDue)}</Text>
          </View>
        </View>

        <Text
          style={[
            styles.paymentStatus,
            {
              backgroundColor: paymentTheme.soft,
              color: paymentTheme.solid,
              borderColor: paymentTheme.border,
            },
          ]}
        >
          {badgeText}
        </Text>

        {(data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0 && (
          <View style={[styles.paymentInfo, { borderColor: brand.solid }]}>
            <Text style={[styles.paymentInfoTitle, { color: brand.solid }]}>Paiement mobile disponible</Text>
            {data.tenantWaveNumber && (
              <Text style={styles.paymentInfoLine}>Wave: {data.tenantWaveNumber}</Text>
            )}
            {data.tenantOmNumber && (
              <Text style={styles.paymentInfoLine}>Orange Money: {data.tenantOmNumber}</Text>
            )}
          </View>
        )}

        {data.qrDataUrl && (
          <View style={styles.qrContainer}>
            <Image style={styles.qrImage} src={data.qrDataUrl} />
            <Text style={styles.qrHint}>Scannez pour retrouver la commande</Text>
          </View>
        )}

        <View style={[styles.dividerDashed, { borderBottomColor: brand.solid, opacity: 0.5 }]} />
        <Text style={styles.footer}>
          Merci de votre confiance !{"\n"}
          Equipe {data.tenantName}{"\n"}
          Conservez ce recu pour le retrait.
        </Text>
      </Page>
    </Document>
  );
}
