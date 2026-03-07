import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";
import type { ReceiptData } from "./mapper";
import { formatFCFA } from "./mapper";

const styles = StyleSheet.create({
  page: {
    padding: 12,
    fontSize: 9,
    fontFamily: "Helvetica",
    width: "80mm",
  },
  header: {
    textAlign: "center",
    marginBottom: 8,
  },
  tenantName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  tenantInfo: {
    fontSize: 7,
    color: "#666",
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    borderBottomStyle: "dashed",
    marginVertical: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  value: {
    fontSize: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  itemName: {
    flex: 2,
    fontSize: 8,
  },
  itemQty: {
    flex: 0.5,
    fontSize: 8,
    textAlign: "center",
  },
  itemPrice: {
    flex: 1,
    fontSize: 8,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  totalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  badge: {
    textAlign: "center",
    padding: 4,
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  badgePaye: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  badgePartiel: {
    backgroundColor: "#fef9c3",
    color: "#854d0e",
  },
  badgeImpaye: {
    backgroundColor: "#fecaca",
    color: "#991b1b",
  },
  qrContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  qrImage: {
    width: 80,
    height: 80,
  },
  footer: {
    textAlign: "center",
    fontSize: 7,
    color: "#666",
    marginTop: 8,
  },
  duplicate: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    marginBottom: 6,
    padding: 4,
    borderWidth: 2,
    borderColor: "#dc2626",
  },
  orderCode: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    marginBottom: 4,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    paddingBottom: 2,
  },
});

export function ReceiptPDF({ data }: { data: ReceiptData }) {
  const badgeStyle =
    data.paymentStatus === "PAYE"
      ? styles.badgePaye
      : data.paymentStatus === "PARTIEL"
        ? styles.badgePartiel
        : styles.badgeImpaye;

  const badgeText =
    data.paymentStatus === "PAYE"
      ? "PAYE"
      : data.paymentStatus === "PARTIEL"
        ? "PARTIEL"
        : "IMPAYE";

  return (
    <Document>
      <Page size={[226.77, 600]} style={styles.page}>
        {data.isDuplicate && (
          <Text style={styles.duplicate}>*** DUPLICATA ***</Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.tenantName}>{data.tenantName}</Text>
          {data.tenantAddress && (
            <Text style={styles.tenantInfo}>{data.tenantAddress}</Text>
          )}
          {data.tenantPhone && (
            <Text style={styles.tenantInfo}>Tél: {data.tenantPhone}</Text>
          )}
          {data.tenantWaveNumber && (
            <Text style={styles.tenantInfo}>Wave: {data.tenantWaveNumber}</Text>
          )}
          {data.tenantOmNumber && (
            <Text style={styles.tenantInfo}>OM: {data.tenantOmNumber}</Text>
          )}
        </View>

        {/* Order Code */}
        <Text style={styles.orderCode}>{data.orderCode}</Text>

        <View style={styles.divider} />

        {/* Customer & dates */}
        <View style={styles.row}>
          <Text style={styles.label}>Client:</Text>
          <Text style={styles.value}>{data.customerName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tél:</Text>
          <Text style={styles.value}>{data.customerPhone}</Text>
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

        <View style={styles.divider} />

        {/* Items header */}
        <View style={styles.itemHeader}>
          <Text style={[styles.itemName, styles.label]}>Article</Text>
          <Text style={[styles.itemQty, styles.label]}>Qté</Text>
          <Text style={[styles.itemPrice, styles.label]}>Total</Text>
        </View>

        {/* Items */}
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

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>
            {formatFCFA(data.totalAmount)}
          </Text>
        </View>

        {/* Paid / Due */}
        <View style={[styles.row, { marginTop: 4 }]}>
          <Text style={styles.label}>Avance:</Text>
          <Text style={styles.value}>{formatFCFA(data.paidAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Reste:</Text>
          <Text style={[styles.value, { fontFamily: "Helvetica-Bold" }]}>
            {formatFCFA(data.amountDue)}
          </Text>
        </View>

        {/* Payment badge */}
        <View style={[styles.badge, badgeStyle]}>
          <Text>{badgeText}</Text>
        </View>

        {/* QR Code */}
        {data.qrDataUrl && (
          <View style={styles.qrContainer}>
            <Image style={styles.qrImage} src={data.qrDataUrl} />
          </View>
        )}

        {/* Mobile money info for payment */}
        {(data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0 && (
          <View style={{ marginTop: 6, padding: 4, borderWidth: 1, borderColor: "#999", borderStyle: "dashed" }}>
            <Text style={[styles.label, { textAlign: "center", marginBottom: 2 }]}>Paiement mobile</Text>
            {data.tenantWaveNumber && (
              <Text style={[styles.tenantInfo, { textAlign: "center" }]}>Wave: {data.tenantWaveNumber}</Text>
            )}
            {data.tenantOmNumber && (
              <Text style={[styles.tenantInfo, { textAlign: "center" }]}>OM: {data.tenantOmNumber}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Merci de votre confiance !{"\n"}
          Conservez ce reçu pour le retrait.
        </Text>
      </Page>
    </Document>
  );
}
