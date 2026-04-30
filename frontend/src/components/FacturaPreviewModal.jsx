import { useEffect, useMemo, useRef } from "react";
import { construirHtmlFactura } from "../utils/facturaPrint";

function FacturaPreviewModal({ abierto, payload, onClose, titulo = "Vista previa de factura" }) {
    const iframeRef = useRef(null);

    const qrValue = payload?.qr_consulta_url || payload?.documento?.json_dte?.qr?.consultaUrl || "";
    const qrDataUrl = useMemo(() => {
        if (!qrValue) return "";
        return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrValue)}`;
    }, [qrValue]);

    const html = useMemo(() => (payload ? construirHtmlFactura(payload, qrDataUrl) : ""), [payload, qrDataUrl]);

    useEffect(() => {
        if (!abierto) return undefined;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose?.();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [abierto, onClose]);

    if (!abierto || !payload) return null;

    const handlePrint = () => {
        const frameWindow = iframeRef.current?.contentWindow;
        if (!frameWindow) return;
        frameWindow.focus();
        frameWindow.print();
    };

    return (
        <div className="invoice-modal-backdrop" onClick={onClose}>
            <div className="invoice-modal-shell" onClick={(e) => e.stopPropagation()}>
                <div className="invoice-modal-toolbar">
                    <div>
                        <h3>{titulo}</h3>
                        <p>Vista local lista para imprimir o guardar como PDF, con QR y resumen del DTE según el tipo de documento.</p>
                    </div>
                    <div className="inline-actions wrap">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
                        <button type="button" className="btn btn-primary" onClick={handlePrint}>Imprimir / Guardar PDF</button>
                    </div>
                </div>
                <div className="invoice-modal-body">
                    <iframe ref={iframeRef} title="Vista previa factura" srcDoc={html} className="invoice-preview-frame" />
                </div>
            </div>
        </div>
    );
}

export default FacturaPreviewModal;
