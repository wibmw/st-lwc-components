import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import preparePrintableFilesForListView from '@salesforce/apex/OneClickPrintCtrl.preparePrintableFilesForListView';

export default class OneClickPrintV3 extends NavigationMixin(LightningElement) {
    @api recordIds = [];
    @track isLoading = true;
    @track printableFiles = [];
    @api isProcessingComplete = false;
    
    get hasRecords() { return this.recordIds && this.recordIds.length > 0; }
    get hasResults() { return this.printableFiles.length > 0; }

    async connectedCallback() {
        if (!this.hasRecords) {
            this.isLoading = false;
            return;
        }

        try {
            isProcessingComplete = false;
            const results = await preparePrintableFilesForListView({ recordIds: this.recordIds });
            this.printableFiles = results.map(file => ({
                id: file.documentId,
                title: file.documentTitle,
                // On pré-construit l'URL de téléchargement direct
                url: `/sfc/servlet.shepherd/version/download/${file.documentId}`
            }));

            if (this.printableFiles.length === 0) {
                this.showToast('Aucun Fichier', 'Aucun document imprimable trouvé pour les enregistrements sélectionnés.', 'warning');
            }
            
        } catch (error) {
            this.showToast(
                'Erreur de préparation',
                error.body?.message || error.message,
                'error'
            );
        } finally {
            this.isLoading = false;
        }
    }

    // Nouvelle méthode pour gérer l'impression
    handlePrintClick(event) {
        // Récupérer l'URL du fichier à partir de l'attribut data-url du bouton
        const pdfUrl = event.target.dataset.url;

        if (!pdfUrl) return;

        // Configuration pour naviguer vers notre page d'impression
        const pageReference = {
            type: 'standard__navItemPage',
            attributes: {
                // Le nom d'API de votre "App Page" ou "Tab" qui héberge le composant pdfPrint
                apiName: 'PdfPrintPage' 
            },
            state: {
                // Passer l'URL du PDF dans l'état de la page
                c__pdfUrl: pdfUrl
            }
        };

        // Utiliser le NavigationMixin pour générer l'URL
        this[NavigationMixin.GenerateUrl](pageReference).then(url => {
            // Ouvrir cette URL dans un nouvel onglet.
            // Comme cette action est une réponse directe à un clic utilisateur,
            // elle ne sera pas bloquée.
            window.open(url, '_blank');
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}