/* eslint-disable jsx-a11y/alt-text */
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
  { solid: "#0f766e", soft: "#f0fdf4", border: "#99f6e4", ink: "#134e4a" },
  { solid: "#1d4ed8", soft: "#eff6ff", border: "#bfdbfe", ink: "#1e3a8a" },
  { solid: "#b45309", soft: "#fffbeb", border: "#fcd34d", ink: "#92400e" },
  { solid: "#be123c", soft: "#fff1f2", border: "#fecdd3", ink: "#9f1239" },
  { solid: "#4338ca", soft: "#eef2ff", border: "#c7d2fe", ink: "#3730a3" },
];

const PAYMENT_THEME = {
  PAYE: { solid: "#15803d", soft: "#ecfdf5", border: "#a7f3d0", label: "PAYÉ" },
  PARTIEL: { solid: "#b45309", soft: "#fffbeb", border: "#fde68a", label: "PAIEMENT PARTIEL" },
  IMPAYE: { solid: "#b91c1c", soft: "#fef2f2", border: "#fecaca", label: "NON PAYÉ" },
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
    fontSize: 8.5,
    fontFamily: "Helvetica",
    width: "80mm",
    backgroundColor: "#ffffff",
    color: "#1e293b",
  },
  topBand: {
    height: 4,
    marginHorizontal: -12,
    marginTop: -12,
    marginBottom: 8,
  },
  duplicateBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 2,
    marginBottom: 8,
    textAlign: "center",
  },
  duplicateText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textAlign: "center",
    letterSpacing: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 8,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 2,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  logo: {
    width: 38,
    height: 38,
    objectFit: "contain",
  },
  tenantName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tenantInfo: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#64748b",
    marginBottom: 1,
  },
  docTitleBadge: {
    marginTop: 4,
    marginBottom: 6,
    alignItems: "center",
  },
  docTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  badgePill: {
    alignSelf: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: 4,
  },
  badgeText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  metaCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 6,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 7.5,
    color: "#64748b",
  },
  metaValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  colArticle: { flex: 1.7, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#334155" },
  colQty: { flex: 0.5, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#334155", textAlign: "center" },
  colPU: { flex: 1.0, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#334155", textAlign: "right" },
  colTotal: { flex: 1.0, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#334155", textAlign: "right" },
  itemRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  itemArticle: { flex: 1.7, fontSize: 7.5, color: "#1e293b" },
  itemQty: { flex: 0.5, fontSize: 7.5, color: "#1e293b", textAlign: "center" },
  itemPU: { flex: 1.0, fontSize: 7.5, color: "#64748b", textAlign: "right" },
  itemTotal: { flex: 1.0, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#0f172a", textAlign: "right" },
  totalsCard: {
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
    padding: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  totalLabel: {
    fontSize: 8,
    color: "#64748b",
  },
  totalValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  grandTotalLabel: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  grandTotalValue: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
  },
  dueLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
  },
  dueValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
  },
  paymentBox: {
    marginTop: 8,
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    backgroundColor: "#f8fafc",
  },
  paymentTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  paymentLine: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#334155",
  },
  qrContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  qrImage: {
    width: 60,
    height: 60,
  },
  qrHint: {
    fontSize: 6.5,
    color: "#64748b",
    marginTop: 2,
    textAlign: "center",
  },
  footer: {
    fontSize: 7.5,
    textAlign: "center",
    color: "#64748b",
    marginTop: 8,
    lineHeight: 1.4,
  },
});

export function ReceiptPDF({ data }: { data: ReceiptData }) {
  const fallbackBrand = getBrandPalette(data.tenantName);
  const brand = {
    solid: isHexColor(data.tenantPrimaryColor) ? data.tenantPrimaryColor! : fallbackBrand.solid,
    soft: isHexColor(data.tenantAccentColor) ? data.tenantAccentColor! : fallbackBrand.soft,
    ink: isHexColor(data.tenantPrimaryColor) ? data.tenantPrimaryColor! : fallbackBrand.ink,
  };
  const paymentTheme = PAYMENT_THEME[data.paymentStatus];

  // Calculate dynamic height
  const baseHeight = 400;
  const itemsHeight = data.items.length * 18;
  const duplicateHeight = data.isDuplicate ? 24 : 0;
  const paymentInfoHeight =
    (data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0 ? 52 : 0;
  const qrHeight = data.qrDataUrl ? 85 : 0;
  const dynamicHeight =
    baseHeight + itemsHeight + duplicateHeight + paymentInfoHeight + qrHeight;

  return (
    <Document>
      <Page size={[226.77, dynamicHeight]} style={styles.page}>
        <View style={[styles.topBand, { backgroundColor: brand.solid }]} />

        {data.isDuplicate && (
          <View style={styles.duplicateBadge}>
            <Text style={styles.duplicateText}>DUPLICATA</Text>
          </View>
        )}

        <View style={styles.header}>
          {data.tenantLogoUrl && (
            <View style={styles.logoContainer}>
              <Image src={data.tenantLogoUrl} style={styles.logo} />
            </View>
          )}
          <Text style={[styles.tenantName, { color: brand.ink }]}>{data.tenantName}</Text>
          {data.tenantAddress && (
            <Text style={styles.tenantInfo}>{data.tenantAddress}</Text>
          )}
          {data.tenantPhone && (
            <Text style={styles.tenantInfo}>Tél: {data.tenantPhone}</Text>
          )}
        </View>

        <View style={styles.docTitleBadge}>
          <Text style={[styles.docTitle, { color: brand.solid }]}>Reçu de Dépôt</Text>
        </View>

        {/* Pill Badge for Payment Status */}
        <View
          style={[
            styles.badgePill,
            {
              backgroundColor: paymentTheme.soft,
              borderColor: paymentTheme.border,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: paymentTheme.solid }]}>
            {paymentTheme.label}
          </Text>
        </View>

        {/* Meta Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>N° Commande :</Text>
            <Text style={styles.metaValue}>{data.orderCode}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date de dépôt :</Text>
            <Text style={styles.metaValue}>{data.orderDate}</Text>
          </View>
          {data.promisedDate && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Retrait prévu le :</Text>
              <Text style={styles.metaValue}>{data.promisedDate}</Text>
            </View>
          )}
          <View style={[styles.metaRow, { marginTop: 2, paddingTop: 2, borderTopWidth: 0.5, borderTopColor: "#e2e8f0" }]}>
            <Text style={styles.metaLabel}>Client :</Text>
            <Text style={styles.metaValue}>{data.customerName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Contact :</Text>
            <Text style={styles.metaValue}>{data.customerPhone}</Text>
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.colArticle}>Article</Text>
          <Text style={styles.colQty}>Qté</Text>
          <Text style={styles.colPU}>P.U.</Text>
          <Text style={styles.colTotal}>Total</Text>
        </View>

        {/* Items */}
        {data.items.map((item, idx) => {
          const qtyText =
            item.pricingType === "PER_KG" && item.weight
              ? `${item.weight}kg`
              : `${item.quantity}`;
          return (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemArticle}>{item.name}</Text>
              <Text style={styles.itemQty}>{qtyText}</Text>
              <Text style={styles.itemPU}>{formatFCFA(item.unitPrice)}</Text>
              <Text style={styles.itemTotal}>{formatFCFA(item.total)}</Text>
            </View>
          );
        })}

        {/* Summary Totals Card */}
        <View style={styles.totalsCard}>
          {data.discountAmount && data.discountAmount > 0 ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Sous-total :</Text>
                <Text style={styles.totalValue}>{formatFCFA(data.totalAmount + data.discountAmount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: "#b91c1c" }]}>
                  Réduction {data.discountReason ? `(${data.discountReason})` : ""} :
                </Text>
                <Text style={[styles.totalValue, { color: "#b91c1c" }]}>
                  - {formatFCFA(data.discountAmount)}
                </Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>TOTAL NET :</Text>
                <Text style={styles.grandTotalValue}>{formatFCFA(data.totalAmount)}</Text>
              </View>
            </>
          ) : (
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL :</Text>
              <Text style={styles.grandTotalValue}>{formatFCFA(data.totalAmount)}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Avance versée :</Text>
            <Text style={styles.totalValue}>{formatFCFA(data.paidAmount)}</Text>
          </View>

          <View style={styles.dueRow}>
            <Text style={[styles.dueLabel, { color: paymentTheme.solid }]}>Reste à payer :</Text>
            <Text style={[styles.dueValue, { color: paymentTheme.solid }]}>{formatFCFA(data.amountDue)}</Text>
          </View>
        </View>

        {/* Mobile Money Encart */}
        {(data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0 && (
          <View style={[styles.paymentBox, { borderColor: brand.solid }]}>
            <Text style={[styles.paymentTitle, { color: brand.solid }]}>Paiement Mobile Disponible</Text>
            {data.tenantWaveNumber && (
              <Text style={styles.paymentLine}>Wave : {data.tenantWaveNumber}</Text>
            )}
            {data.tenantOmNumber && (
              <Text style={styles.paymentLine}>Orange Money : {data.tenantOmNumber}</Text>
            )}
          </View>
        )}

        {/* QR Code */}
        {data.qrDataUrl && (
          <View style={styles.qrContainer}>
            <Image style={styles.qrImage} src={data.qrDataUrl} />
            <Text style={styles.qrHint}>Scannez pour retrouver la commande</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Merci de votre confiance !{"\n"}
          Équipe {data.tenantName}{"\n"}
          Veuillez conserver ce reçu pour le retrait.
        </Text>
      </Page>
    </Document>
  );
}
