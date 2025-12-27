import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';

export default class PdfPrint extends LightningElement {
    @api pdfUrl; // Peut être passé via propriété ou via l'URL (c__pdfUrl)

    // Récupère c__pdfUrl depuis l'URL si présent
    @wire(CurrentPageReference)
    getStateParameters(pageRef) {
        if (pageRef && !this.pdfUrl) {
            const state = pageRef.state || {};
            if (state.c__pdfUrl) {
                this.pdfUrl = state.c__pdfUrl;
            }
        }
    }

    handleIframeLoad() {
        // Quand le PDF est chargé dans l'iframe, on déclenche l'impression
        try {
            const iframe = this.template.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }
        } catch (e) {
            // Si le navigateur bloque l'accès à l'iframe (rare),
            // on ouvre au moins le PDF dans un nouvel onglet.
            if (this.pdfUrl) {
                window.open(this.pdfUrl, '_blank');
            }
        }
    }
}
