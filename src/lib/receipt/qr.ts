import QRCode from "qrcode";

export async function generateQRDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 150,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
