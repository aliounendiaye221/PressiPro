import { ReceiptData } from "./mapper";

// Remplacement basique des accents pour éviter les caractères buggés sur les imprimantes thermiques génériques
function removeAccents(str: string) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function textToBytes(text: string) {
    return new TextEncoder().encode(removeAccents(text));
}

export async function printDirectlyPOS(data: ReceiptData): Promise<void> {
    // Web Serial API (Uniquement sur Desktop Chrome/Edge/Opera)
    if (!("serial" in navigator)) {
        throw new Error("L'API Web Serial n'est pas supportée sur ce navigateur. Veuillez utiliser Google Chrome sur PC/Android ou imprimer le PDF.");
    }

    try {
        // Demander à l'utilisateur de sélectionner le port USB/Série de l'imprimante
        const port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 9600 }); // Vitesse standard pour beaucoup de thermiques

        const writer = port.writable.getWriter();

        // Commandes ESC/POS
        const ESC = 0x1B;
        const GS = 0x1D;

        const INIT = new Uint8Array([ESC, 0x40]);
        const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
        const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
        const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
        const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
        const TEXT_DOUBLE = new Uint8Array([GS, 0x21, 0x11]);
        const TEXT_NORMAL = new Uint8Array([GS, 0x21, 0x00]);
        const PAPER_CUT = new Uint8Array([GS, 0x56, 0x41, 0x03]); // Full cut with feed

        const write = async (bytes: Uint8Array) => await writer.write(bytes);
        const writeLine = async (text: string) => {
            await write(textToBytes(text + "\n"));
        };

        // --- DEBUT DU TICKET ---
        await write(INIT);
        await write(ALIGN_CENTER);

        if (data.isDuplicate) {
            await write(BOLD_ON);
            await writeLine("*** DUPLICATA ***");
            await write(BOLD_OFF);
            await writeLine("");
        }

        // Header
        await write(TEXT_DOUBLE);
        await writeLine(data.tenantName);
        await write(TEXT_NORMAL);

        if (data.tenantAddress) await writeLine(data.tenantAddress);
        if (data.tenantPhone) await writeLine(`Tel: ${data.tenantPhone}`);
        await writeLine("--------------------------------");

        // Meta dats
        await write(ALIGN_LEFT);
        await writeLine(`Commande: ${data.orderCode}`);
        await writeLine(`Reçu le : ${data.orderDate}`);
        if (data.promisedDate) await writeLine(`Prêt le : ${data.promisedDate}`);

        await writeLine("--------------------------------");
        await write(BOLD_ON);
        await writeLine(`Client  : ${data.customerName}`);
        await writeLine(`Tel     : ${data.customerPhone}`);
        await write(BOLD_OFF);

        await writeLine("--------------------------------");

        // Items
        for (const item of data.items) {
            const qtyStr = item.pricingType === "PER_KG" && item.weight ? `${item.weight}kg` : `x${item.quantity}`;
            await writeLine(`${item.name} ${qtyStr}`);

            // Aligner le prix à droite (approximation 32 chars)
            const priceStr = Math.round(item.total).toString() + " F";
            const spaces = Math.max(0, 32 - priceStr.length);
            await writeLine(" ".repeat(spaces) + priceStr);
        }

        await writeLine("--------------------------------");

        // Totals
        await writeLine(`TOTAL    : ${Math.round(data.totalAmount)} F`);
        await writeLine(`AVANCE   : ${Math.round(data.paidAmount)} F`);

        await write(BOLD_ON);
        await write(TEXT_DOUBLE);
        await writeLine(`RESTE    : ${Math.round(data.amountDue)} F`);
        await write(TEXT_NORMAL);
        await write(BOLD_OFF);

        const badgeText = data.paymentStatus === "PAYE" ? "PAYE" : data.paymentStatus === "PARTIEL" ? "PARTIEL" : "IMPAYE";
        await writeLine(`Statut   : ${badgeText}`);

        await writeLine("--------------------------------");

        if ((data.tenantWaveNumber || data.tenantOmNumber) && data.amountDue > 0) {
            await write(ALIGN_CENTER);
            await writeLine("Paiement mobile disponible:");
            if (data.tenantWaveNumber) await writeLine(`Wave : ${data.tenantWaveNumber}`);
            if (data.tenantOmNumber) await writeLine(`OM   : ${data.tenantOmNumber}`);
            await writeLine("--------------------------------");
        }

        await write(ALIGN_CENTER);
        await writeLine("Merci de votre confiance !");
        await writeLine(`Equipe ${data.tenantName}`);
        await writeLine("Veuillez conserver ce recu.");
        await writeLine("");
        await writeLine("");
        await writeLine("");

        await write(PAPER_CUT);

        writer.releaseLock();
        await port.close();

    } catch (error) {
        console.error("Erreur d'impression série:", error);
        throw error;
    }
}
