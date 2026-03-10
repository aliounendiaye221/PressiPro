import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PressiPro — Logiciel de Gestion de Pressing au Sénégal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            PP
          </div>
          <span
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            PressiPro
          </span>
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.4,
          }}
        >
          Logiciel de Gestion de Pressing au Sénégal
        </div>
        <div
          style={{
            fontSize: "20px",
            color: "rgba(255,255,255,0.7)",
            marginTop: "20px",
            textAlign: "center",
            maxWidth: "700px",
          }}
        >
          Commandes · Paiements Wave/OM · Reçus PDF · Dashboard temps réel
        </div>
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "40px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              color: "#2563eb",
              padding: "12px 32px",
              borderRadius: "12px",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            Essai gratuit — pressipro.tech
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
