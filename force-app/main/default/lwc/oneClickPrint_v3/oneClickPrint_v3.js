import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';
import preparePrintableFilesForListView from '@salesforce/apex/OneClickPrintCtrl.preparePrintableFilesForListView';
import getPdfContentsForMerge from '@salesforce/apex/OneClickPrintCtrl.getPdfContentsForMerge';
import getSiteIdFromRecords from '@salesforce/apex/OneClickPrintCtrl.getSiteIdFromRecords';

export default class OneClickPrintV3 extends NavigationMixin(LightningElement) {
    @track _recordIds = [];
    @track _recordId;
    @track debugLog = [];
    @track errorMessage;
    @track showManualLinks = false;
    @track generatedPdfUrl; // URL of the generated blob
    @track generatedPdfName = 'Document_Fusionne.pdf';

    @api 
    get recordIds() { return this._recordIds; }
    set recordIds(value) {
        this._recordIds = value;
        this.log(`Set recordIds: ${JSON.stringify(value)} (Type: ${typeof value})`);
    }

    @api 
    get recordId() { return this._recordId; }
    set recordId(value) {
        this._recordId = value;
        this.log(`Set recordId: ${value} (Type: ${typeof value})`);
    }

    @track isLoading = true;
    @track printableFiles = [];
    @api isSaveComplete = false;
    @api isProcessingComplete = false; // Conservé pour compatibilité avec les flows existants
    @api sourcePageUrl = "";
    
    log(msg) {
        this.debugLog.push(msg);
        console.log('[OneClickPrint]', msg);
    }

    get effectiveRecordIds() {
        let ids = [];
        if (this._recordIds) {
            if (Array.isArray(this._recordIds)) {
                ids = [...this._recordIds];
            } else if (typeof this._recordIds === 'string') {
                // Try to parse if it looks like JSON or comma separated
                if (this._recordIds.startsWith('[')) {
                    try { ids = JSON.parse(this._recordIds); } catch(e) {}
                } else {
                    ids.push(this._recordIds);
                }
            }
        }
        
        if (this._recordId) {
            ids.push(this._recordId);
        }
        // Deduplicate
        return [...new Set(ids)];
    }

    get hasRecords() { return this.effectiveRecordIds.length > 0; }

    connectedCallback() {
        // We do NOT open a window here anymore to avoid popup blockers and LWS issues.
        // We rely on the spinner in the UI.
        
        // Démarrer le processus automatiquement
        this.processAndComplete();
    }

    // Processus automatisé : récupérer les fichiers, ouvrir/fusionner, et terminer le flow
    async processAndComplete() {
        if (!this.hasRecords) {
            this.log('Aucun enregistrement fourni');
            this.showToast('Aucun Fichier', 'Aucun enregistrement sélectionné.', 'warning');
            this.completeFlow();
            return;
        }

        this.isLoading = true;
        
        try {
            // 1. Récupérer l'ID du Lieu en parallèle avec les fichiers
            const [files, siteId] = await Promise.all([
                preparePrintableFilesForListView({ recordIds: this.effectiveRecordIds }),
                getSiteIdFromRecords({ recordIds: this.effectiveRecordIds })
            ]);
                
                this.printableFiles = files.map(file => ({
                id: file.documentId,
                title: file.documentTitle,
                url: `/sfc/servlet.shepherd/version/download/${file.documentId}`
            }));

            this.log(`${this.printableFiles.length} fichier(s) trouvé(s)`);

            if (this.printableFiles.length === 0) {
                this.showToast('Aucun Fichier', 'Aucun document PDF trouvé pour les enregistrements sélectionnés.', 'warning');
                // No window to close
                this.completeFlow();
                return;
            }

            // 3. Fusionner et ouvrir
            this.log(`${this.printableFiles.length} fichier(s) - traitement en cours`);
            await this.mergeAndOpen();
            this.completeFlow();

        } catch (error) {
            const msg = error.body?.message || error.message;
            this.log('ERREUR: ' + msg);
            this.showToast('Erreur', msg, 'error');
            this.errorMessage = msg;
            this.isLoading = false;
            this.showManualLinks = true;
            
            // Do not try to write error to popup anymore
        }
    }

    // Fusionner tous les PDFs et ouvrir le résultat
    async mergeAndOpen() {  
        try {
            // 1. Charger pdf-lib
            let PDFLib;
            try {
                PDFLib = await this.loadPdfLib();
            } catch (libError) {
                // FALLBACK : Si erreur de chargement librairie (ex: CSP) et 1 seul fichier, on l'ouvre directement
                if (this.printableFiles.length === 1) {
                    this.log('Echec chargement pdf-lib, fallback sur ouverture directe');
                    await this.openSingleFileDirectly();
                    return; // Stop here, handled by fallback
                }
                throw libError; // Re-throw if multiple files
            }

            const { PDFDocument } = PDFLib;

            // 2. Récupérer les contenus PDF depuis Apex (en base64)
            const contentVersionIds = this.printableFiles.map(f => f.id);
            const pdfContents = await getPdfContentsForMerge({ contentVersionIds: contentVersionIds });

            if (!pdfContents || pdfContents.length === 0) {
                throw new Error('Aucun contenu PDF récupéré.');
            }

            // 3. Créer un nouveau document PDF vide
            const mergedPdf = await PDFDocument.create();

            // 4. Fusionner chaque PDF depuis le contenu base64
            for (const pdfInfo of pdfContents) {
                try {
                    if (!pdfInfo.base64Content) {
                        console.warn(`Pas de contenu pour ${pdfInfo.documentTitle}`);
                        continue;
                    }
                    
                    const pdfBytes = this.base64ToUint8Array(pdfInfo.base64Content);
                    const pdf = await PDFDocument.load(pdfBytes);
                    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    pages.forEach(page => mergedPdf.addPage(page));
                } catch (e) {
                    console.error(`Erreur lors du chargement de ${pdfInfo.documentTitle}:`, e);
                }
            }

            // Vérifier qu'on a des pages
            if (mergedPdf.getPageCount() === 0) {
                throw new Error('Aucune page valide trouvée pour la fusion.');
            }

            // 5. Sauvegarder le PDF fusionné
            const mergedPdfBytes = await mergedPdf.save();
            
            // 6. Créer un blob URL
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            this.generatedPdfUrl = url;
            this.isLoading = false;
            
            this.log(`Fusion réussie: ${mergedPdf.getPageCount()} page(s). Tentative d'ouverture...`);

            // 7. Ouvrir
            try {
                 window.open(url, '_blank');
            } catch (e) {
                this.log('Navigation auto bloquée: ' + e.message);
            }

            this.showToast('Terminé', `Document prêt (${mergedPdf.getPageCount()} pages). Si l'ouverture est bloquée, utilisez le bouton ci-dessous.`, 'success');

        } catch (error) {
            console.error('Erreur lors de la fusion:', error);
            // No window to close anymore
            throw error;
        }
    }

    // Terminer le flow automatiquement et naviguer vers le Lieu
    completeFlow() {
        this.isLoading = false;
        this.isSaveComplete = true;
        this.isProcessingComplete = true; // Compatibilité avec les flows existants
        this.dispatchEvent(new FlowNavigationNextEvent());
    }

    // Charger pdf-lib depuis CDN
    async loadPdfLib() {
        if (window.PDFLib) {
            return window.PDFLib;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            
            const timeoutId = setTimeout(() => {
                reject(new Error('Délai d\'attente dépassé pour le chargement de la librairie PDF (CDN). Vérifiez votre connexion.'));
            }, 10000); // 10 seconds timeout

            script.onload = () => {
                clearTimeout(timeoutId);
                resolve(window.PDFLib);
            };
            script.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Impossible de charger pdf-lib (Erreur réseau/CDN).'));
            };
            document.head.appendChild(script);
        });
    }

    // Convertir base64 en Uint8Array
    base64ToUint8Array(base64) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Fallback method: Open single file directly without merging
    async openSingleFileDirectly() {
        this.log('1 fichier - récupération du contenu (mode direct)');
        
        // Récupérer le contenu du PDF via Apex
        const pdfContents = await getPdfContentsForMerge({ contentVersionIds: [this.printableFiles[0].id] });
        
        let targetUrl = this.printableFiles[0].url;
        let blob = null;

        if (pdfContents && pdfContents.length > 0 && pdfContents[0].base64Content) {
            const pdfBytes = this.base64ToUint8Array(pdfContents[0].base64Content);
            blob = new Blob([pdfBytes], { type: 'application/pdf' });
            targetUrl = URL.createObjectURL(blob);
        }
        
        // Show button and try to open
        this.generatedPdfUrl = targetUrl;
        this.isLoading = false;

        try {
            window.open(targetUrl, '_blank');
        } catch(e) {
            this.log('Ouverture auto bloquée: ' + e.message);
        }
        
        this.showToast('Document ouvert', `Le document "${this.printableFiles[0].title}" est prêt.`, 'success');
    }
}
