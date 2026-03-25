"use client";

import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { X } from "lucide-react";

interface QrScannerModalProps {
    onScan: (url: string) => void;
    onClose: () => void;
}

export function QrScannerModal({ onScan, onClose }: QrScannerModalProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">Scanner un ticket</h2>
                    <button
                        title="close"
                        onClick={onClose}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="relative aspect-square w-full bg-black overflow-hidden">
                    <Scanner
                        onScan={(result: IDetectedBarcode[]) => {
                            if (result && result.length > 0 && result[0].rawValue) {
                                onScan(result[0].rawValue);
                            }
                        }}
                        components={{
                            finder: true
                        }}
                    />
                </div>
                <div className="p-4 bg-gray-50 text-center text-sm text-gray-500 leading-relaxed">
                    Placez le QR Code du reçu au centre du cadre pour retrouver la commande instantanément.
                </div>
            </div>
        </div>
    );
}
