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
    @api sourcePageUrl = ''; // URL de la page du Lieu à naviguer après le flow
    
    // Fenêtre ouverte avant les opérations async pour éviter le blocage popup
    pdfWindow = null;
    
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
        // Ouvrir la fenêtre PDF IMMÉDIATEMENT (dans le contexte utilisateur synchrone)
        // Ceci évite le blocage par le bloqueur de popups
        this.pdfWindow = window.open('about:blank', '_blank');
        if (this.pdfWindow) {
            this.pdfWindow.document.write('<html><head><title>Chargement...</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><p>Préparation du document PDF...</p></body></html>');
        }
        
        // Démarrer le processus automatiquement
        this.processAndComplete();
    }

    // Processus automatisé : récupérer les fichiers, ouvrir/fusionner, et terminer le flow
    async processAndComplete() {
        if (!this.hasRecords) {
            this.log('Aucun enregistrement fourni');
            this.showToast('Aucun Fichier', 'Aucun enregistrement sélectionné.', 'warning');
            if (this.pdfWindow) this.pdfWindow.close();
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
            
            // Construire l'URL du Lieu pour la navigation
            if (siteId) {
                this.sourcePageUrl = `/lightning/r/sitetracker__Site__c/${siteId}/view`;
                this.log(`Site URL: ${this.sourcePageUrl}`);
            }
            
            this.printableFiles = files.map(file => ({
                id: file.documentId,
                title: file.documentTitle,
                url: `/sfc/servlet.shepherd/version/download/${file.documentId}`
            }));

            this.log(`${this.printableFiles.length} fichier(s) trouvé(s)`);

            if (this.printableFiles.length === 0) {
                this.showToast('Aucun Fichier', 'Aucun document PDF trouvé pour les enregistrements sélectionnés.', 'warning');
                if (this.pdfWindow) this.pdfWindow.close();
                this.completeFlow();
                return;
            }

            // 2. Si un seul fichier, récupérer son contenu et l'afficher en blob URL
            if (this.printableFiles.length === 1) {
                this.log('1 fichier - récupération du contenu');
                
                // Récupérer le contenu du PDF via Apex pour éviter le téléchargement
                const pdfContents = await getPdfContentsForMerge({ contentVersionIds: [this.printableFiles[0].id] });
                
                if (pdfContents && pdfContents.length > 0 && pdfContents[0].base64Content) {
                    const pdfBytes = this.base64ToUint8Array(pdfContents[0].base64Content);
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    
                    if (this.pdfWindow) {
                        this.pdfWindow.location.href = blobUrl;
                    } else {
                        window.open(blobUrl, '_blank');
                    }
                } else {
                    // Fallback: utiliser l'URL de téléchargement
                    if (this.pdfWindow) {
                        this.pdfWindow.location.href = this.printableFiles[0].url;
                    } else {
                        window.open(this.printableFiles[0].url, '_blank');
                    }
                }
                
                this.showToast('Document ouvert', `Le document "${this.printableFiles[0].title}" a été ouvert dans un nouvel onglet.`, 'success');
                this.completeFlow();
                return;
            }

            // 3. Si plusieurs fichiers, fusionner et ouvrir
            this.log(`${this.printableFiles.length} fichiers - fusion en cours`);
            await this.mergeAndOpen();
            this.completeFlow();

        } catch (error) {
            this.log('ERREUR: ' + (error.body?.message || error.message));
            this.showToast('Erreur', error.body?.message || error.message, 'error');
            if (this.pdfWindow) this.pdfWindow.close();
            this.completeFlow();
        }
    }

    // Fusionner tous les PDFs et ouvrir le résultat
    async mergeAndOpen() {
        try {
            // 1. Charger pdf-lib
            const PDFLib = await this.loadPdfLib();
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
            
            // 6. Créer un blob URL et rediriger la fenêtre déjà ouverte
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // 7. Rediriger la fenêtre pré-ouverte vers le PDF fusionné
            if (this.pdfWindow) {
                this.pdfWindow.location.href = url;
            } else {
                window.open(url, '_blank');
            }

            this.log(`Fusion réussie: ${mergedPdf.getPageCount()} page(s)`);
            this.showToast('Fusion réussie', `${this.printableFiles.length} documents fusionnés (${mergedPdf.getPageCount()} pages).`, 'success');

        } catch (error) {
            console.error('Erreur lors de la fusion:', error);
            if (this.pdfWindow) this.pdfWindow.close();
            throw error;
        }
    }

    // Terminer le flow automatiquement et naviguer vers le Lieu
    completeFlow() {
        this.isLoading = false;
        this.isSaveComplete = true;
        this.isProcessingComplete = true; // Compatibilité avec les flows existants
        this.log('Flow terminé - isSaveComplete = true');
        
        // Naviguer vers la page du Lieu si disponible
        if (this.sourcePageUrl) {
            this.log(`Navigation vers: ${this.sourcePageUrl}`);
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: this.sourcePageUrl
                }
            });
        } else {
            // Sinon, utiliser FlowNavigationNextEvent
            this.dispatchEvent(new FlowNavigationNextEvent());
        }
    }

    // Charger pdf-lib depuis CDN
    async loadPdfLib() {
        if (window.PDFLib) {
            return window.PDFLib;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            script.onload = () => resolve(window.PDFLib);
            script.onerror = () => reject(new Error('Impossible de charger pdf-lib'));
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
}