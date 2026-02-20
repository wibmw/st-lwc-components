import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecordNotifyChange } from 'lightning/uiRecordApi';

import getUserSiteForAutoAttribution from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getUserSiteForAutoAttribution';
import searchPiecesForAutoAttribution from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchPiecesForAutoAttribution';
import saveAutoAttribution from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.saveAutoAttribution';
import renameAutoAttributionFiles from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.renameAutoAttributionFiles';

/**
 * @description Composant mobile permettant à un technicien de s'auto-attribuer
 * des pièces depuis le stock logistique vers son site (STE-).
 * Une photo par pièce est obligatoire. Aucun bon de livraison requis.
 * Crée un historique PU uniquement (pas d'Envoi_Logistique__c).
 */
export default class AutoAttributionPiece extends LightningElement {
    @api recordId;
    @api objectApiName;

    @track isLoading = true;
    @track isSearching = false;
    @track isSaving = false;

    @track destinationSiteId;
    @track destinationSiteName;
    @track destinationSiteSubLabel;

    @track searchTerm = '';
    @track searchResults = [];
    @track cart = [];
    @track commentaire = '';

    delayTimeout;
    acceptedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.pdf'];

    // --- Lifecycle ---

    connectedCallback() {
        this.loadUserSite();
    }

    async loadUserSite() {
        this.isLoading = true;
        try {
            const siteData = await getUserSiteForAutoAttribution();
            if (siteData && siteData.siteId) {
                this.destinationSiteId = siteData.siteId;
                this.destinationSiteName = siteData.siteName;
                this.destinationSiteSubLabel = siteData.siteSubLabel;
            }
        } catch (err) {
            this.showToast('Erreur', 'Impossible de récupérer votre site : ' + (err.body?.message || err.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // --- Getters ---

    get hasCartItems() {
        return this.cart.length > 0;
    }

    get cartCount() {
        return this.cart.length;
    }

    get isSaveDisabled() {
        if (this.isSaving || this.isLoading) return true;
        if (!this.destinationSiteId) return true;
        if (this.cart.length === 0) return true;
        // Bloquer si au moins une pièce n'a pas de photo
        return this.cart.some(item => !item.hasPhoto);
    }

    // --- Handlers ---

    handleCommentChange(event) {
        this.commentaire = event.target.value;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
        clearTimeout(this.delayTimeout);
        if (!this.searchTerm || this.searchTerm.length < 3) {
            this.searchResults = [];
            return;
        }
        this.delayTimeout = setTimeout(() => {
            this.performSearch(this.searchTerm);
        }, 300);
    }

    async performSearch(term) {
        this.isSearching = true;
        try {
            const results = await searchPiecesForAutoAttribution({ searchTerm: term });
            const cartIds = new Set(this.cart.map(c => c.pieceUnitaireId));
            this.searchResults = (results || []).map(r => ({
                ...r,
                isAddedToCart: cartIds.has(r.id)
            }));
        } catch (err) {
            this.showToast('Erreur', 'Recherche impossible : ' + (err.body?.message || err.message), 'error');
        } finally {
            this.isSearching = false;
        }
    }

    handleAddToCart(event) {
        const pieceId = event.currentTarget.dataset.id;
        const piece = this.searchResults.find(r => r.id === pieceId);
        if (!piece) return;

        if (this.cart.some(c => c.pieceUnitaireId === pieceId)) {
            this.showToast('Info', 'Cette pièce est déjà dans le panier.', 'info');
            return;
        }

        this.cart = [...this.cart, {
            key: pieceId,
            pieceUnitaireId: pieceId,
            name: piece.name,
            mnemonique: piece.mnemonique,
            description: piece.description,
            lieuId: piece.lieuId,
            lieuName: piece.lieuName || '',
            hasPhoto: false,
            photoCount: 0,
            uploadedDocumentIds: []
        }];

        // Marquer comme ajouté dans les résultats
        this.searchResults = this.searchResults.map(r => ({
            ...r,
            isAddedToCart: r.id === pieceId ? true : r.isAddedToCart
        }));
    }

    handleRemoveFromCart(event) {
        const pieceId = event.currentTarget.dataset.id;
        this.cart = this.cart.filter(c => c.pieceUnitaireId !== pieceId);
        // Remettre disponible dans les résultats
        this.searchResults = this.searchResults.map(r => ({
            ...r,
            isAddedToCart: r.id === pieceId ? false : r.isAddedToCart
        }));
    }

    handleUploadFinished(event) {
        const pieceId = event.currentTarget.dataset.pieceId;
        const uploadedFiles = event.detail.files;
        const docIds = uploadedFiles.map(f => f.documentId);

        this.cart = this.cart.map(item => {
            if (item.pieceUnitaireId === pieceId) {
                const allDocIds = [...(item.uploadedDocumentIds || []), ...docIds];
                return {
                    ...item,
                    hasPhoto: allDocIds.length > 0,
                    photoCount: allDocIds.length,
                    uploadedDocumentIds: allDocIds
                };
            }
            return item;
        });

        // Renommer les nouveaux fichiers en Apex
        if (docIds.length > 0) {
            // Trouver lieuName de la pièce
            const cartItem = this.cart.find(c => c.pieceUnitaireId === pieceId);
            const lieuName = cartItem ? cartItem.lieuName : '';
            const today = new Date();
            const dateStr = String(today.getDate()).padStart(2, '0') + '_'
                          + String(today.getMonth() + 1).padStart(2, '0') + '_'
                          + today.getFullYear();

            renameAutoAttributionFiles({
                contentDocumentIds: docIds,
                lieuName: lieuName,
                dateStr: dateStr
            }).catch(err => {
                console.warn('Renommage fichiers échoué:', err);
            });
        }
    }

    async handleSave() {
        if (this.isSaveDisabled) return;

        this.isSaving = true;
        try {
            const cartLines = this.cart.map(item => ({
                pieceUnitaireId: item.pieceUnitaireId,
                lieuId: item.lieuId,
                lieuName: item.lieuName
            }));

            const input = {
                destinationSiteId: this.destinationSiteId,
                destinationSiteName: this.destinationSiteName,
                commentaire: this.commentaire,
                cart: cartLines
            };

            const processedIds = await saveAutoAttribution({ inputJSON: JSON.stringify(input) });

            // Rafraîchir les enregistrements Salesforce
            if (processedIds && processedIds.length > 0) {
                getRecordNotifyChange(processedIds.map(id => ({ recordId: id })));
            }

            this.showToast('Succès', `${processedIds.length} pièce(s) attribuée(s) avec succès !`, 'success');

            // Reset
            this.cart = [];
            this.searchResults = [];
            this.searchTerm = '';
            this.commentaire = '';

        } catch (err) {
            this.showToast('Erreur', err.body?.message || err.message, 'error');
        } finally {
            this.isSaving = false;
        }
    }

    // --- Utils ---

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
