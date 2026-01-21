import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';
import { getRecordNotifyChange } from 'lightning/uiRecordApi';

import { isDesktopDevice, STATUS_DEFINITIONS_BY_KEY, STATUS_DEFINITIONS_BY_APIVALUE, reduceErrors } from 'c/logisticsUtils';

import getCommandeDetails from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getCommandeDetails';
import getEnvoiDetails from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getEnvoiDetails';
import getInitialData from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getInitialData';
import searchPiecesUnitaires from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchPiecesUnitaires';
import saveEnvoi from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.saveEnvoi';
import TrackingModal from 'c/trackingModal';

const getRowActions = (row, doneCallback) => {
    const actions = [];
    if (!row.isReadOnly) {
        if (row.statut !== 'Disponible') actions.push({ label: 'Valider la Demande', name: 'set_validated', iconName: 'utility:check' });
        if (row.statut !== 'Non Disponible') actions.push({ label: 'Refuser la Demande', name: 'set_refused', iconName: 'utility:close' });
    }
    doneCallback(actions);
};

const COMMANDE_DETAILS_COLS = [
    { label: 'Article', fieldName: 'articleName', type: 'text' },
    { label: 'Qte', fieldName: 'quantite', type: 'number' },
    { label: 'Statut de la Pièce', fieldName: 'statutForDisplay', type: 'text' },
    { label: 'Commentaire', fieldName: 'commentaire', type: 'text' },
    { type: 'action', typeAttributes: { rowActions: getRowActions } }
];

export default class MntGestionEnvoiLogistique extends NavigationMixin(LightningElement) {
    @api componentLabel;
    @api isSaveComplete = false;
    @api ticketCorrectifID;

    _recordId;
    _objectApiName;

    @api get recordId() { return this._recordId; }
    set recordId(value) { this._recordId = value; }

    @api get objectApiName() { return this._objectApiName; }
    set objectApiName(value) { this._objectApiName = value; }

    @track isLoading = true;
    @track isSearching = false;
    @track cardTitle = 'Traiter la Commande';
    @track saveButtonLabel = 'Traiter la Commande';

    @track selectedNTicket = null;
    @track selectedDestinataire = null;
    @track selectedStock = null;
    @track selectedDemandeur = null;

    @track nTicketCorrectifId;
    @track destinataireId;
    @track stockId;
    @track statutEnvoi = 'Commande à Traiter';
    @track dateEnvoi;
    @track typeEnvoi = 'Autre Stock';
    @track typeReception = 'Livraison'; @track typeTransporteur = 'CHRONOPOST';
    @track commentaire = '';
    @track envoiName = '';
    @track createdBy = '';
    @track contactAddress = '';

    @track g2r = '';
    @track siteName = '';
    @track compteProjet = '';

    @track searchResults = [];
    @track cart = [];
    @track commandeDetails = [];
    @track linkedCommandeId;
    @track isContextCommande = false;

    delayTimeout;
    commandeDetailsCols = COMMANDE_DETAILS_COLS;

    get isDesktop() {
        return isDesktopDevice();
    }

    get canValidateOrder() {
        if (!this.commandeDetails || this.commandeDetails.length === 0) return false;
        return this.commandeDetails.every(d => d.statut === 'Disponible' || d.statut === 'Validée');
    }

    get canRefuseOrder() {
        if (!this.commandeDetails || this.commandeDetails.length === 0) return false;
        return this.commandeDetails.some(d => d.statut === 'Non Disponible' || d.statut === 'Refusée');
    }

    get filteredSearchResults() {
        if (!this.searchResults) return [];
        const cartIds = new Set(this.cart.map(c => c.pieceUnitaireId));
        return this.searchResults.filter(item => !cartIds.has(item.id));
    }

    get isDestinationLocked() {
        return this.isContextCommande;
    }

    get cartData() {
        if (!this.cart) return [];
        return this.cart.map(item => ({
            ...item,
            isTrackingDisabled: !item.numBonLivraison,
            trackingUrl: item.numBonLivraison
                ? `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${item.numBonLivraison}`
                : null
        }));
    }

    get envoiTitle() {
        return this.envoiName ? `Informations sur l'envoi : ${this.envoiName}` : "Informations sur l'envoi";
    }

    get typeOptions() {
        return [
            { label: 'Vers Réparateur', value: 'Réparateur' },
            { label: 'Vers Autre Stock', value: 'Autre Stock' }
        ];
    }

    get typeReceptionOptions() {
        return [
            { label: 'Livraison', value: 'Livraison' },
            { label: 'Remise en main propre', value: 'Remise en main propre' }
        ];
    }

    get typeTransporteurOptions() {
        return [
            { label: 'CHRONOPOST', value: 'CHRONOPOST' },
            { label: 'DHL', value: 'DHL' },
            { label: 'TNT', value: 'TNT' },
            { label: 'COLISSIMO', value: 'COLISSIMO' },
            { label: 'UPS', value: 'UPS' },
            { label: 'Palette', value: 'Palette' }
        ];
    }

    get isReparateurType() {
        return this.typeEnvoi === 'Réparateur';
    }

    get isMainPropre() {
        return this.typeReception === 'Remise en main propre';
    }

    get refDestinataireChronopost() {
        const ticket = this.selectedNTicket ? this.selectedNTicket.label : '';
        return (this.compteProjet && ticket) ? `${this.compteProjet} - ${ticket}` : '';
    }

    get isSaveDisabled() {
        const isInEditMode = (this._objectApiName === 'Envoi_Logistique__c');
        if (isInEditMode) return false;
        return this.cart.length === 0;
    }

    get isReadOnly() {
        return this.statutEnvoi === 'Clôturer NOK' || this.statutEnvoi === 'Clôturer OK';
    }

    get hasCommandeDetails() {
        return this.commandeDetails && this.commandeDetails.length > 0;
    }

    get validateButtonLabel() {
        return this.dateEnvoi ? 'Mettre à jour la Commande' : 'Valider la Commande';
    }

    get validateButtonVariant() {
        return this.dateEnvoi ? 'brand' : 'success';
    }

    connectedCallback() {
        if (this._objectApiName === 'Commande_Pi_ces__c') {
            this.linkedCommandeId = this._recordId;
            this.isContextCommande = true;
            this.handleCommandeContext();
        } else if (this._objectApiName === 'Envoi_Logistique__c') {
            this.loadEnvoiData(this._recordId);
        } else if (this._objectApiName === 'Correctif__c') {
            this.ticketCorrectifID = this._recordId;
            this.handleTicketContext();
        } else if (this._objectApiName === 'sitetracker__Job__c') {
            this.handleTicketContext();
        } else if (this.ticketCorrectifID) {
            this.handleTicketContext();
        } else {
            this.isLoading = false;
        }
    }

    async handleCommandeContext() {
        this.isLoading = true;
        try {
            const allDetails = await getCommandeDetails({ commandeId: this.linkedCommandeId, envoiId: null });
            this.commandeDetails = allDetails.filter(d => d.typeLigne === 'Cockpit');
            this.typeEnvoi = 'Autre Stock';

            if (this._objectApiName !== 'Envoi_Logistique__c') {
                this.cardTitle = 'Créer la commande';
                this.saveButtonLabel = 'Créer la Commande';

                const initialData = await getInitialData({ recordId: this._recordId, sObjectType: 'Commande_Pi_ces__c' });
                if (initialData.nTicketCorrectifId) {
                    this.nTicketCorrectifId = initialData.nTicketCorrectifId;
                    const label = initialData.nTicketName || '';
                    const sublabel = initialData.nTicketSubLabel || '';
                    this.selectedNTicket = {
                        value: initialData.nTicketCorrectifId,
                        label: label,
                        sublabel: sublabel,
                        pillLabel: label
                    };
                    this.g2r = initialData.g2r || '';
                    this.siteName = initialData.siteName || '';
                }
                this.compteProjet = initialData.compteProjet || '';

                if (initialData.lieuId) {
                    this.stockId = initialData.lieuId;
                    const label = initialData.lieuName || '';
                    const sublabel = initialData.lieuSubLabel || '';
                    this.selectedStock = {
                        value: initialData.lieuId,
                        label: label,
                        sublabel: sublabel,
                        pillLabel: sublabel ? `${label} - ${sublabel}` : label
                    };
                }
                if (initialData.destinataireId) {
                    this.destinataireId = initialData.destinataireId;
                    this.selectedDestinataire = { value: initialData.destinataireId, label: initialData.destinataireName };
                    this.contactAddress = initialData.destinataireAddress || '';
                }
                if (initialData.demandeurId) {
                    this.selectedDemandeur = { 
                        value: initialData.demandeurId, 
                        label: initialData.demandeurName 
                    };
                }
            }
        } catch (error) {
            this.showToast('Erreur', reduceErrors(error)[0], 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleTicketContext() {
        this.isLoading = true;
        try {
            this.cardTitle = 'Créer un Envoi';
            this.saveButtonLabel = 'Créer l\'Envoi';
            this.typeEnvoi = 'Autre Stock';

            let params = {};
            if (this._objectApiName === 'sitetracker__Job__c') {
                params = { recordId: this._recordId, sObjectType: 'sitetracker__Job__c' };
            } else if (this.ticketCorrectifID) {
                params = { recordId: this.ticketCorrectifID, sObjectType: 'Correctif__c' };
            }

            const initialData = await getInitialData(params);

            if (initialData.nTicketCorrectifId) {
                this.nTicketCorrectifId = initialData.nTicketCorrectifId;
                const label = initialData.nTicketName || '';
                const sublabel = initialData.nTicketSubLabel || '';
                this.selectedNTicket = {
                    value: initialData.nTicketCorrectifId,
                    label: label,
                    sublabel: sublabel,
                    pillLabel: label
                };
                this.g2r = initialData.g2r || '';
                this.siteName = initialData.siteName || '';
            }
        } catch (error) {
            this.showToast('Erreur', 'Impossible de charger les données du ticket', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async loadCommandeDetails(commandeId) {
        try {
            const allDetails = await getCommandeDetails({ commandeId: commandeId, envoiId: this._recordId });
            this.commandeDetails = allDetails.filter(d => d.typeLigne === 'Cockpit');
        } catch (error) {
            throw error;
        }
    }

    async loadEnvoiData(envoiIdToLoad) {
        this.isLoading = true;
        this.cardTitle = "Traiter la Commande";
        this.saveButtonLabel = "Valider la Commande";
        try {
            const envoiData = await getEnvoiDetails({ envoiId: envoiIdToLoad });
            this.envoiName = envoiData.envoiName || '';
            this.createdBy = envoiData.createdByName;

            this.nTicketCorrectifId = envoiData.nTicketCorrectifId;
            if (this.nTicketCorrectifId) {
                const label = envoiData.nTicketName || '';
                const sublabel = envoiData.nTicketSubLabel || '';
                this.selectedNTicket = {
                    value: envoiData.nTicketCorrectifId,
                    label: label,
                    sublabel: sublabel,
                    pillLabel: label
                };
                this.g2r = envoiData.g2r || '';
                this.siteName = envoiData.siteName || '';
            }
            this.statutEnvoi = envoiData.statutDeLEnvoi;
            this.typeEnvoi = envoiData.typeEnvoi;
            this.typeTransporteur = envoiData.transporteur || 'CHRONOPOST';
            this.typeReception = envoiData.typeReception || 'Livraison';
            this.dateEnvoi = envoiData.dateEnvoi;
            this.compteProjet = envoiData.compteProjet || '';

            this.destinataireId = envoiData.destinataireId;
            if (this.destinataireId) this.selectedDestinataire = { value: envoiData.destinataireId, label: envoiData.destinataireName };
            this.contactAddress = envoiData.destinataireAddress || '';

            this.stockId = envoiData.lieuId;
            if (this.stockId) {
                const label = envoiData.lieuName || '';
                const sublabel = envoiData.lieuSubLabel || '';
                this.selectedStock = {
                    value: envoiData.lieuId,
                    label: label,
                    sublabel: sublabel,
                    pillLabel: sublabel ? `${label} - ${sublabel}` : label
                };
            }
            this.commentaire = envoiData.commentaire;
            this.cart = envoiData.lines.map(line => ({ ...line, pieceUnitaireId: line.pieceUnitaireId }));

            if (envoiData.commandeId) {
                this.linkedCommandeId = envoiData.commandeId;
                this.isContextCommande = true;
                this.typeEnvoi = 'Autre Stock';
                await this.loadCommandeDetails(envoiData.commandeId);
            }
        } catch (error) {
            this.showToast('Erreur de chargement', reduceErrors(error)[0], 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleSearch(event) {
        const searchTerm = event.target.value;
        clearTimeout(this.delayTimeout);
        this.delayTimeout = setTimeout(() => {
            this.performSearch(searchTerm);
        }, 300);
    }

    async performSearch(searchTerm) {
        if (searchTerm.length < 3) {
            this.searchResults = [];
            this.isSearching = false;
            return;
        }
        this.isSearching = true;

        try {
            const results = await searchPiecesUnitaires({ searchTerm: searchTerm, typeEnvoi: this.typeEnvoi });
            const cartIds = new Set(this.cart.map(item => item.pieceUnitaireId));
            this.searchResults = results.filter(res => !cartIds.has(res.id)).map(r => ({
                id: r.id,
                name: r.name,
                cleEquipement: r.cleEquipement,
                rma: r.rma,
                sousLieu: r.sousLieu,
                mnemonique: r.mnemonique,
                description: r.description
            }));
        } catch (error) {
            this.showToast('Erreur', reduceErrors(error)[0], 'error');
        } finally {
            this.isSearching = false;
        }
    }

    handleAddToCart(event) {
        const pieceId = event.target.dataset.id;
        const piece = this.searchResults.find(p => p.id === pieceId);

        if (piece) {
            if (this.cart.some(item => item.pieceUnitaireId === pieceId)) {
                this.showToast('Info', 'Cette pièce est déjà dans le panier.', 'info');
                return;
            }

            let defaultStatus = '';
            if (this.typeReception === 'Livraison') {
                defaultStatus = 'En préparation chez l\'expéditeur';
            }

            this.cart = [...this.cart, {
                pieceUnitaireId: piece.id,
                name: piece.name,
                mnemonique: piece.mnemonique,
                cleEquipement: piece.cleEquipement,
                sousLieu: piece.sousLieu,
                numBonLivraison: '',
                statutChronopost: defaultStatus
            }];
            this.showToast('Succès', 'Pièce ajoutée au panier.', 'success');
            this.searchResults = this.searchResults.filter(res => res.id !== pieceId);
        }
    }

    handleCartItemChange(event) {
        const { id, field, value } = event.detail;
        this.cart = this.cart.map(item =>
            item.pieceUnitaireId === id ? { ...item, [field]: value } : item
        );
    }

    handleCartItemRemove(event) {
        const { id } = event.detail;
        this.cart = this.cart.filter(item => item.pieceUnitaireId !== id);
    }

    handleRemoveItem(event) {
        const id = event.target.dataset.id || event.currentTarget.dataset.id;
        this.cart = this.cart.filter(item => item.pieceUnitaireId !== id);
        this.showToast('Succès', 'Pièce retirée du panier.', 'success');
    }

    handleCartItemActionChronopost(event) {
        const { id, action } = event.detail;
        this.cart = this.cart.map(item => {
            if (item.pieceUnitaireId === id) {
                return { ...item, statutChronopost: action };
            }
            return item;
        });
    }

    handleLookupSelect(event) {
        const selectedValue = event.detail;
        const lookupType = event.target.dataset.lookup;

        switch (lookupType) {
            case 'ticket':
                this.nTicketCorrectifId = selectedValue.value;
                this.selectedNTicket = selectedValue;
                if (selectedValue.g2r) this.g2r = selectedValue.g2r;
                if (selectedValue.siteName) this.siteName = selectedValue.siteName;
                if (selectedValue.compteProjet) this.compteProjet = selectedValue.compteProjet;
                break;
            case 'destinataire':
                this.destinataireId = selectedValue.value;
                this.selectedDestinataire = selectedValue;
                if (selectedValue.address) this.contactAddress = selectedValue.address;
                break;
            case 'stock':
                this.stockId = selectedValue.value;
                this.selectedStock = selectedValue;
                break;
            case 'user':
                this.selectedDemandeur = selectedValue;
                break;
        }
    }

    handleLookupRemove(event) {
        const lookupType = event.target.dataset.lookup;

        switch (lookupType) {
            case 'ticket':
                this.nTicketCorrectifId = null;
                this.selectedNTicket = null;
                this.g2r = '';
                this.siteName = '';
                break;
            case 'destinataire':
                this.destinataireId = null;
                this.selectedDestinataire = null;
                this.contactAddress = '';
                break;
            case 'stock':
                this.stockId = null;
                this.selectedStock = null;
                break;
            case 'user':
                this.selectedDemandeur = null;
                break;
        }
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        let newStatusKey = null;
        if (actionName === 'set_validated') newStatusKey = 'Disponible';
        else if (actionName === 'set_refused') newStatusKey = 'Non Disponible';

        if (newStatusKey) {
            this.updateDetailStatus(row.articleName, row.siteName, newStatusKey);
        }
    }

    updateDetailStatus(articleName, siteName, newStatusKey) {
        const statusDef = STATUS_DEFINITIONS_BY_KEY[newStatusKey];
        if (!statusDef) return;

        this.commandeDetails = this.commandeDetails.map(d => {
            if (d.articleName === articleName && d.siteName === siteName) {
                return {
                    ...d,
                    statut: statusDef.apiValue,
                    statutForDisplay: statusDef.displayValue
                };
            }
            return d;
        });

        this.showToast('Statut mis à jour', `Ligne passée à "${statusDef.label}"`, 'success');
    }

    handleTypeChange(event) {
        this.typeEnvoi = event.detail.value;
        const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
        if (searchInput && searchInput.value && searchInput.value.length >= 3) {
            this.performSearch(searchInput.value);
        } else {
            this.searchResults = [];
        }
    }

    handleTypeTransporteurChange(event) {
        this.typeTransporteur = event.detail.value;
    }

    handleTypeReceptionChange(event) {
        this.typeReception = event.detail.value;
        if (this.typeReception === 'Remise en main propre') {
            this.contactAddress = '';
        }
    }

    handleDateEnvoiChange(event) {
        this.dateEnvoi = event.detail.value;
    }

    handleCommentChange(event) {
        this.commentaire = event.target.value;
    }

    handleCopyRef() {
        if (this.refDestinataireChronopost) {
            navigator.clipboard.writeText(this.refDestinataireChronopost);
            this.showToast('Succès', 'Référence copiée dans le presse-papier', 'success');
        }
    }

    async handleSave() {
        this.isLoading = true;
        try {
            const inputData = {
                recordId: this._recordId,
                contextObjectType: this._objectApiName,
                nTicketCorrectifId: this.nTicketCorrectifId,
                statutDeLEnvoi: this.dateEnvoi ? this.statutEnvoi : 'En cours de préparation',
                transporteur: this.typeTransporteur,
                typeEnvoi: this.typeEnvoi,
                typeReception: this.typeReception,
                dateEnvoi: this.dateEnvoi,
                destinataireId: this.destinataireId,
                lieuId: this.stockId,
                commentaire: this.commentaire,
                cart: this.cart.map(c => ({
                    pieceUnitaireId: c.pieceUnitaireId,
                    numBonLivraison: c.numBonLivraison,
                    statutChronopost: c.statutChronopost
                })),
                commandeParenteId: this.linkedCommandeId || null,
                orderLines: this.commandeDetails
            };

            const result = await saveEnvoi({ inputJSON: JSON.stringify(inputData) });
            this.showToast('Succès', 'Envoi sauvegardé.', 'success');

            if (this._recordId) {
                getRecordNotifyChange([{ recordId: this._recordId }]);
            } else {
                this.isSaveComplete = true;
                this.dispatchEvent(new FlowNavigationNextEvent());
            }
        } catch (error) {
            this.showToast('Erreur', reduceErrors(error)[0], 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async openTrackingModal(url) {
        await TrackingModal.open({
            size: 'large',
            description: 'Popup de suivi Chronopost',
            trackingUrl: url
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}