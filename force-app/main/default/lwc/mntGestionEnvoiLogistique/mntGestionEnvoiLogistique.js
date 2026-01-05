import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';
import getCommandeDetails from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getCommandeDetails';
import getEnvoiByCommandeId from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getEnvoiByCommandeId';
import getEnvoiDetails from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getEnvoiDetails';
import getInitialData from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getInitialData';
import searchPiecesUnitaires from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchPiecesUnitaires';
import saveEnvoi from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.saveEnvoi';
import searchRecords from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchRecords';
import updateLineStatus from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.updateLineStatus';
import TrackingModal from 'c/trackingModal';
import { getRecord, getFieldValue, getRecordNotifyChange } from 'lightning/uiRecordApi';

const COMMANDE_FIELD = 'Envoi_Logistique__c.Commande_Pi_ces__c';

// --- GESTION CENTRALISÉE DES STATUTS (COPIÉ DE COMMAND COCKPIT) ---
const STATUS_DEFINITIONS_BY_KEY = {
    'Disponible':   { key: 'Disponible',   apiValue: 'Disponible',   displayValue: '🟢 Disponible',   label: '🟢Disponible' },
    'Non Disponible':   { key: 'Non Disponible',   apiValue: 'Non Disponible',   displayValue: '🔴 Non Disponible',   label: '🔴Non Disponible' }
};
const STATUS_DEFINITIONS_BY_APIVALUE = {
    'Disponible':   STATUS_DEFINITIONS_BY_KEY['Disponible'],
    'Non Disponible':   STATUS_DEFINITIONS_BY_KEY['Non Disponible']
};

const getRowActions = (row, doneCallback) => {
    const actions = [];
    // On vérifie une propriété 'isReadOnly' qu'on injectera dans la row
    if (!row.isReadOnly) {
        if (row.statut !== 'Disponible') actions.push({ label: 'Valider la Demande', name: 'set_validated', iconName: 'utility:check' });
        if (row.statut !== 'Non Disponible') actions.push({ label: 'Refuser la Demande', name: 'set_refused', iconName: 'utility:close' });
    }
    doneCallback(actions);
};

// On rajoute la colonne de type 'action' à la fin
const CART_COLS = [
    { label: 'Pièce', fieldName: 'name', type: 'text' },
    { label: 'Clé Equipement', fieldName: 'cleEquipement', type: 'text' },
    { 
        label: 'N° Bon Livraison', 
        fieldName: 'numBonLivraison', 
        type: 'text',
        editable: true,
    },
    {
        type: 'button-icon',
        initialWidth: 50,
        typeAttributes: {
            iconName: 'utility:new_window',
            name: 'track_shipment',
            title: 'Suivre le colis',
            variant: 'bare',
            disabled: { fieldName: 'isTrackingDisabled' },
            class: { fieldName: 'trackingButtonClass' }
        }
    },
    { 
        type: 'action',
        typeAttributes: { 
            rowActions: [
                { label: 'Supprimer', name: 'remove', iconName: 'utility:delete' }
            ]
        }
    }
];

const COMMANDE_DETAILS_COLS = [
    { label: 'Article', fieldName: 'articleName', type: 'text' },
    // { label: 'Lieu', fieldName: 'siteName', type: 'text' },
    { label: 'Qte', fieldName: 'quantite', type: 'number' },
    { label: 'Statut de la Pièce', fieldName: 'statutForDisplay', type: 'text' },
    { label: 'Commentaire', fieldName: 'commentaire', type: 'text' },
    { type: 'action', typeAttributes: { rowActions: getRowActions } }
];

export default class MntGestionEnvoiLogistique extends NavigationMixin(LightningElement) {
    @track linkedCommandeId;

    get canValidateOrder() {
        // Actif si on a des lignes ET que tout est "Disponible" (ou Validée)
        if (!this.commandeDetails || this.commandeDetails.length === 0) return false;
        // Si TOUTES les lignes sont 'Disponible' (ou déjà 'Validée'), le bouton s'affiche
        return this.commandeDetails.every(d => d.statut === 'Disponible' || d.statut === 'Validée');
    }

    get canRefuseOrder() {
        // Actif seulement si UNE pièce est "Non Disponible" (ou Refusée)
        if (!this.commandeDetails || this.commandeDetails.length === 0) return false;
        return this.commandeDetails.some(d => d.statut === 'Non Disponible' || d.statut === 'Refusée');
    }

        // --- NOUVELLE GESTION ACTIONS CHRONOPOST (PANIER) ---
    
    handleChronopostAction(event) {
        const pieceId = event.target.dataset.id;
        const action = event.target.dataset.action; // 'Livré' ou 'Perdu'
        
        this.cart = this.cart.map(item => {
            if (item.pieceUnitaireId === pieceId) {
                return { ...item, statutChronopost: action };
            }
            return item;
        });
    }

    // --- SEARCH FILTERING ---
    get filteredSearchResults() {
        if (!this.searchResults) return [];
        const cartIds = new Set(this.cart.map(c => c.pieceUnitaireId));
        return this.searchResults.filter(item => !cartIds.has(item.id));
    }

    async handleSearch(event) {
        const searchTerm = event.target.value;
        if (searchTerm && searchTerm.length >= 3) {
            this.isSearching = true;
            try {
                const results = await searchPiecesUnitaires({ searchTerm: searchTerm });
                this.searchResults = results.map(r => ({
                    id: r.Id,
                    name: r.Name,
                    cleEquipement: r.Cle_Equipement__c,
                    rma: r.RMA__c,
                    sousLieu: r.Sous_Lieu__c,
                    mnemonique: r.mnemonique, 
                    description: r.description   
                }));
            } catch (error) {
                console.error('Erreur recherche', error);
            } finally {
                this.isSearching = false;
            }
        } else {
            this.searchResults = [];
        }
    }

    handleAddToCart(event) {
        const itemId = event.target.dataset.id;
        const item = this.searchResults.find(r => r.id === itemId);
        if (item) {
            this.cart = [...this.cart, {
                pieceUnitaireId: item.id,
                name: item.name,
                cleEquipement: item.cleEquipement,
                numBonLivraison: '',
                statutChronopost: 'En préparation chez l\'expéditeur',
                sousLieu: item.sousLieu,
                mnemonique: item.mnemonique
            }];

        }
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        let newStatusKey = null;
        // Correspondance avec les actions définies dans getRowActions
        if (actionName === 'set_validated') newStatusKey = 'Disponible';
        else if (actionName === 'set_refused') newStatusKey = 'Non Disponible';

        if (newStatusKey) {
            this.updateDetailStatus(row.articleName, row.siteName, newStatusKey);
        }
    }

    // --- MOBILE STATUS ACTIONS ---
    handleMobileStatusAction(event) {
        const action = event.currentTarget.dataset.action;
        const articleName = event.currentTarget.dataset.articlename; 
        const siteName = event.currentTarget.dataset.sitename;

        let newStatusKey = null;
        if (action === 'validate') newStatusKey = 'Disponible';
        else if (action === 'refuse') newStatusKey = 'Non Disponible';

        if (newStatusKey) {
            this.updateDetailStatus(articleName, siteName, newStatusKey);
        }
    }
    
    updateDetailStatus(articleName, siteName, newStatusKey) {
        const statusDef = STATUS_DEFINITIONS_BY_KEY[newStatusKey];
        if (!statusDef) {
            console.error('Statut non trouvé pour la clé :', newStatusKey);
            return;
        }

        // On recrée le tableau pour forcer le rafraîchissement de l'interface (LWC reactivity)
        this.commandeDetails = this.commandeDetails.map(d => {
            // On identifie la ligne par la combinaison Article + Site
            if (d.articleName === articleName && d.siteName === siteName) {
                return { 
                    ...d, 
                    statut: statusDef.apiValue, 
                    statutForDisplay: statusDef.displayValue 
                };
            }
            return d;
        });
        
        // Petit feedback visuel (Toast) optionnel
        this.showToast('Statut mis à jour', `Ligne passée à "${statusDef.label}"`, 'success');
    }

    @api componentLabel; 
    _recordId; _objectApiName;
    @api get recordId() { return this._recordId; }
    set recordId(value) { this._recordId = value; }
    @api get objectApiName() { return this._objectApiName; }
    set objectApiName(value) { this._objectApiName = value; }
    @api isSaveComplete = false;

    @track isLoading = true; @track isSearching = false; @track cardTitle = 'Traiter la Commande'; @track saveButtonLabel = 'Traiter la Commande';
    @track nTicketCorrectifId; @track selectedNTicket = null; @track statutEnvoi = 'Commande à Traiter'; @track dateCreationEnvoi; @track typeEnvoi = 'Autre Stock'; @track envoiName = '';
    @track destinataireId; @track selectedDestinataire = null; @track stockId; @track selectedStock = null; @track commentaire = ''; @track createdBy = '';
    @track lookupSuggestions = { ticket: [], destinataire: [], stock: [] }; @track lookupLoading = { ticket: false, destinataire: false, stock: false }; @track isLookupOpen = { ticket: false, destinataire: false, stock: false };
    @track searchResults = []; @track cart = []; @track piecesMap = new Map(); @track draftValues = []; @track commandeDetails = []; @track initialContextIsCommande = false; delayTimeout;
    @track isDestinationLocked = false; @track isContextCommande = false; @track envoiDataFromServer = null;
    @track g2r = ''; @track siteName = ''; @track compteProjet = ''; @track typeReception = 'Livraison'; @track dateEnvoi; @track contactAddress = '';@track typeTransporteur = 'CHRONOPOST';

    commandeDetailsCols = COMMANDE_DETAILS_COLS; cartCols = CART_COLS;

    get isDestinationLocked() { return this.isContextCommande || (this.envoiDataFromServer && this.envoiDataFromServer.isLinkedToCommande); }
    get cartData() {
        if (!this.cart) return [];
        return this.cart.map(item => {
            const hasTrackingNumber = !!item.numBonLivraison;
            
            // Calcul des variantes pour les boutons Chronopost ici (pas dans le HTML)
            const isLivre = item.statutChronopost === 'Livré';
            const isPerdu = item.statutChronopost === 'Perdu';

            return {
                ...item,
                isTrackingDisabled: !hasTrackingNumber,
                trackingButtonClass: hasTrackingNumber ? '' : 'slds-hidden',
                trackingUrl: hasTrackingNumber 
                    ? `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${item.numBonLivraison}` 
                    : null,
                
                // NOUVEAUX CHAMPS CALCULÉS POUR LE HTML
                variantLivre: isLivre ? 'brand' : 'border-filled',
                variantPerdu: isPerdu ? 'destructive' : 'border-filled'
            };
        });
    }
    get envoiTitle() { if (this.envoiName) { return `Informations sur l'envoi : ${this.envoiName}`; } return "Informations sur l'envoi"; }
    get isFromCommande() { return this.linkedCommandeId ? true : false; }
    get typeOptions() { return [{ label: 'Vers Réparateur', value: 'Réparateur' }, { label: 'Vers Autre Stock', value: 'Autre Stock' }]; }
    get typeReceptionOptions() { return [{ label: 'Livraison', value: 'Livraison' }, { label: 'Remise en main propre', value: 'Remise en main propre' }]; }
    get typeTransporteurOptions() { return [{ label: 'CHRONOPOST', value: 'CHRONOPOST' }, { label: 'DHL', value: 'DHL' }, { label: 'TNT', value: 'TNT' }, { label: 'COLISSIMO', value: 'COLISSIMO' }]; }
    get isReparateurType() { return this.typeEnvoi === 'Réparateur'; }
    get isAutreStockType() { return this.typeEnvoi === 'Autre Stock'; }
    get showDestinationPlaceholder() { return !this.isReparateurType && !this.isAutreStockType; }
    get isMainPropre() { return this.typeReception === 'Remise en main propre'; }
    get refDestinataireChronopost() { 
        const ticket = this.selectedNTicket ? this.selectedNTicket.label : '';
        return (this.compteProjet && ticket) ? `${this.compteProjet} - ${ticket}` : ''; 
    }
    get isSaveDisabled() {
        const isInEditMode = (this._objectApiName === 'Envoi_Logistique__c');
        if (isInEditMode) return false; // En édition, on peut toujours sauvegarder (sauf règles métier)
        return this.cart.length === 0; // En création, il faut au moins une pièce
    }
    get datatableColumns() { return this.isFromCommande ? this.commandeDetailsCols : this.cartCols; }
    get nTicketComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.ticket ? 'slds-is-open' : ''}`; }
    get destinataireComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.destinataire ? 'slds-is-open' : ''}`; }
    get stockComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.stock ? 'slds-is-open' : ''}`; }

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
            this.linkedCommandeId = this._recordId; // Fix: Set linkedCommandeId to the current recordId
            this.initialContextIsCommande = true;
            // this.isDestinationLocked = true;
            this.isContextCommande = true;
            this.handleCommandeContext();
        } else if (this._objectApiName === 'Envoi_Logistique__c') {
            this.loadEnvoiData(this._recordId);
        } else {
            this.isLoading = false;
        }
    }
    
    async handleCommandeContext() {
        this.isLoading = true;
        try {
            // En création depuis une commande, on ne filtre pas par envoi (envoiId = null)
            const allDetails = await getCommandeDetails({ commandeId: this.linkedCommandeId, envoiId: null });
            this.commandeDetails = allDetails.filter(d => d.typeLigne === 'Cockpit');
            // const envoiId = await getEnvoiByCommandeId({ commandeId: this.linkedCommandeId });
            this.typeEnvoi = this.linkedCommandeId ? 'Autre Stock' : 'Réparateur';
            if (this._objectApiName == 'Envoi_Logistique__c') {
                await this.loadEnvoiData(this._recordId);
            } else {
                this.cardTitle = 'Créer la commande'; this.saveButtonLabel = 'Créer la Commande';
                this.typeEnvoi = 'Autre Stock';
                // this.cart = allDetails.map(d => ({ ...d, key: d.pieceUnitaireId }));
                const initialData = await getInitialData({ recordId: this._recordId, sObjectType: 'Commande_Pi_ces__c' });
                // Préchargement des champs
                if(initialData.nTicketCorrectifId) {
                    this.nTicketCorrectifId = initialData.nTicketCorrectifId;
                    const label = initialData.nTicketName || '';
                    const sublabel = initialData.nTicketSubLabel || '';
                    this.selectedNTicket = { value: initialData.nTicketCorrectifId, label: label , sublabel: sublabel, pillLabel: label }; // sublabel ? `${label} - ${sublabel}` : label };
                    this.g2r = initialData.g2r || '';
                    this.siteName = initialData.siteName || '';
                }
                this.compteProjet = initialData.compteProjet || '';

                console.log('Initial Data from Apex:', JSON.stringify(initialData));
                if(initialData.lieuId) {
                    this.stockId = initialData.lieuId;
                    console.log('Setting stockId to:', this.stockId);
                    const label = initialData.lieuName || '';
                    const sublabel = initialData.lieuSubLabel || '';
                    this.selectedStock = { value: initialData.lieuId, label: label, sublabel: sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label };
                } else {
                    console.warn('No lieuId found in initialData');
                }
                if(initialData.destinataireId) {
                    this.destinataireId = initialData.destinataireId;
                    this.selectedDestinataire = { value: initialData.destinataireId, label: initialData.destinataireName };
                this.contactAddress = initialData.destinataireAddress || '';
                }
                // this.cart = initialData.lines.map(line => ({ ...line, key: line.pieceUnitaireId }));
            }
        } catch(error) { this.showToast('Erreur', this.reduceErrors(error)[0], 'error'); } 
        finally { this.isLoading = false; }
    }
    
    // --- WIRE SERVICE POUR CHARGEMENT FIABLE DE LA COMMANDE ---
    @wire(getRecord, { recordId: '$recordId', fields: [COMMANDE_FIELD] })
    wiredEnvoi({ error, data }) {
        if (data) {
            const commandeId = getFieldValue(data, COMMANDE_FIELD);

            if (commandeId) {
                this.linkedCommandeId = commandeId;
                this.initialContextIsCommande = true;
                this.isContextCommande = true;
                this.typeEnvoi = this.linkedCommandeId ? 'Autre Stock' : 'Réparateur';
            }
            if (commandeId && (!this.commandeDetails || this.commandeDetails.length === 0)) {
                this.loadCommandeDetails(commandeId);
            }
        } else if (error) {
            this.isLoading = false;
            console.error('Error loading envoi record via wire:', error);
        }
    }

    async loadCommandeDetails(commandeId) {
        try {
            // On passe l'envoiId actuel pour filtrer les lignes sur cet envoi spécifique
            const currentEnvoiId = (this._objectApiName === 'Envoi_Logistique__c') ? this._recordId : null;
            const details = await getCommandeDetails({ commandeId: commandeId, envoiId: currentEnvoiId });
            
            this.commandeDetails = details
                .filter(d => {
                    const matchesType = d.typeLigne === 'Cockpit';
                    return matchesType;
                })
                .map(d => {
                const statusDef = STATUS_DEFINITIONS_BY_APIVALUE[d.statut] || STATUS_DEFINITIONS_BY_KEY['Disponible'];
                return {
                    ...d,
                    statut: statusDef.apiValue,
                    statutForDisplay: statusDef.displayValue,
                    isReadOnly: this.isReadOnly // Injecté pour getRowActions
                };
            });
            
            console.log('Filtered commandeDetails:', this.commandeDetails);
        } catch (error) {
            console.error('Erreur chargement détails commande', error);
        }
    }



    async loadEnvoiData(envoiIdToLoad) {
        this.isLoading = true; this.cardTitle = "Traiter la Commande"; this.saveButtonLabel = "Valider la Commande";
        try {
            const envoiData = await getEnvoiDetails({ envoiId: envoiIdToLoad });
            this.isDestinationLocked = envoiData.isLinkedToCommande;
            this.envoiName = envoiData.envoiName || ''; this.createdBy = envoiData.createdByName;
            this.demandeurCommande = envoiData.demandeurCommande; // Fix: Map demandeur fallback
            this.nTicketCorrectifId = envoiData.nTicketCorrectifId; 
            if (this.nTicketCorrectifId) {
                const label = envoiData.nTicketName || ''; 
                const sublabel = envoiData.nTicketSubLabel || ''; 
                this.selectedNTicket = { value: envoiData.nTicketCorrectifId, label: label, sublabel: sublabel, pillLabel: label }; // sublabel ? `${label} - ${sublabel}` : label }; 
                this.g2r = envoiData.g2r || '';
                this.siteName = envoiData.siteName || '';
            }
            this.statutEnvoi = envoiData.statutDeLEnvoi; this.dateCreationEnvoi = envoiData.dateCreation; this.typeEnvoi = envoiData.typeEnvoi;
            this.typeTransporteur = envoiData.transporteur || 'CHRONOPOST';
            this.typeReception = envoiData.typeReception || 'Livraison';
            this.dateEnvoi = envoiData.dateEnvoi;
            this.compteProjet = envoiData.compteProjet || '';

            this.destinataireId = envoiData.destinataireId; if (this.destinataireId) this.selectedDestinataire = { value: envoiData.destinataireId, label: envoiData.destinataireName };
            this.contactAddress = envoiData.destinataireAddress || '';
            this.stockId = envoiData.lieuId; if (this.stockId) {const label = envoiData.lieuName || ''; const sublabel = envoiData.lieuSubLabel || ''; this.selectedStock = { value: envoiData.lieuId, label: label, sublabel: sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label }; }
            this.commentaire = envoiData.commentaire; this.envoiDataFromServer = envoiData;
            this.cart = envoiData.lines.map(line => ({ ...line, pieceUnitaireId: line.pieceUnitaireId, key: line.pieceUnitaireId }));

            // --- AUTO-LOAD COMMANDE DETAILS ---
            if (envoiData.commandeId) {
                this.linkedCommandeId = envoiData.commandeId;
                this.initialContextIsCommande = true; 
                this.isContextCommande = true; 
                this.typeEnvoi = 'Autre Stock';
                await this.loadCommandeDetails(envoiData.commandeId);
            } else if (envoiData.isLinkedToCommande) {
                console.warn('L\'Id de la commande n\'a pas pu être retrouvé');
            }
            // ----------------------------------

        } catch (error) { this.showToast('Erreur de chargement', this.reduceErrors(error)[0], 'error'); } 
        finally { this.isLoading = false; }
    }
    
    handleTypeChange(event) { 
        // if (this.isDestinationLocked) return;
        this.typeEnvoi = event.detail.value; 
        this.destinataireId = null; 
        this.selectedDestinataire = null; 
        this.stockId = null; 
        this.selectedStock = null;

        // On ré-exécute la recherche si un terme de recherche est déjà saisi
        const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
        if (searchInput && searchInput.value && searchInput.value.length >= 3) {
            this.performSearch(searchInput.value);
        } else {
            // Sinon, on vide simplement les résultats
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
    handleCopyRef() {
        if (this.refDestinataireChronopost) {
            navigator.clipboard.writeText(this.refDestinataireChronopost);
            this.showToast('Succès', 'Référence copiée dans le presse-papier', 'success');
        }
    }

    performSearch(searchTerm) {
        if (searchTerm.length < 3) {
            this.searchResults = [];
            this.isSearching = false;
            return;
        }
        this.isSearching = true;

        // On passe maintenant le typeEnvoi à la méthode Apex
        searchPiecesUnitaires({ searchTerm: searchTerm, typeEnvoi: this.typeEnvoi })
            .then(results => {
                results.forEach(res => this.piecesMap.set(res.id, res));
                const cartIds = new Set(this.cart.map(item => item.pieceUnitaireId));
                this.searchResults = results.filter(res => !cartIds.has(res.id));
            })
            .catch(error => this.showToast('Erreur', this.reduceErrors(error)[0], 'error'))
            .finally(() => this.isSearching = false);
    }
    handleCommentChange(event) { this.commentaire = event.target.value; }
    // handleDateChange(event) { this.dateEnvoi = event.target.value; }
    handleLookupSearch(event) { const lookupType = event.target.dataset.lookup; const searchTerm = event.target.value; window.clearTimeout(this.delayTimeout); this.delayTimeout = setTimeout(() => { if (searchTerm.length >= 3) this.fetchLookupSuggestions(searchTerm, lookupType); }, 300); }
    async fetchLookupSuggestions(searchTerm, lookupType) { this.lookupLoading[lookupType] = true; const sObjectTypeMap = { ticket: 'Correctif__c', destinataire: 'Contact', stock: 'sitetracker__Site__c' }; try { this.lookupSuggestions[lookupType] = await searchRecords({ searchTerm: searchTerm, sObjectType: sObjectTypeMap[lookupType] }); } catch (error) { this.showToast('Erreur', 'Recherche impossible', 'error'); } finally { this.lookupLoading[lookupType] = false; } }
    handleLookupSelect(event) { 
        const { value, label, sublabel, pillLabel, lookup, address, g2r, sitename } = event.currentTarget.dataset; 
        switch (lookup) { 
            case 'ticket': 
                this.nTicketCorrectifId = value; 
                this.selectedNTicket = { value, label, sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label }; 
                this.g2r = g2r || '';
                this.siteName = sitename || '';
                break; 
            case 'destinataire': 
                this.destinataireId = value; 
                this.selectedDestinataire = { value, label }; 
                if (address) this.contactAddress = address;
                break; 
            case 'stock': 
                this.stockId = value; 
                this.selectedStock = { value, label, sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label }; 
                break; 
        } 
        this.lookupSuggestions[lookup] = []; 
        const input = this.template.querySelector(`lightning-input[data-lookup="${lookup}"]`); 
        if (input) input.value = ''; 
        this.isLookupOpen[lookup] = false; 
    }
    handleLookupPillRemove(event) { 
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
        } 
    }
    handleLookupFocus(event) { this.isLookupOpen[event.target.dataset.lookup] = true; }
    handleLookupBlur(event) { const inputElement = event.target; const lookupType = inputElement.dataset.lookup; setTimeout(() => { let selectedId; switch (lookupType) { case 'ticket': selectedId = this.nTicketCorrectifId; break; case 'destinataire': selectedId = this.destinataireId; break; case 'stock': selectedId = this.stockId; break; } if (inputElement.value && !selectedId) { this.showToast('Erreur', `"${inputElement.value}" n'est pas une valeur valide.`, 'error'); inputElement.value = ''; } this.isLookupOpen[lookupType] = false; }, 250); }
    handleSearch(event) { 
        const searchTerm = event.target.value; 
        clearTimeout(this.delayTimeout); 
        this.delayTimeout = setTimeout(() => { 
            this.performSearch(searchTerm);
        }, 300); 
    }
    get isBlReadOnly() {
        return this.isReadOnly || this.typeReception !== 'Livraison';
    }

    handleAddToCart(event) {
        const pieceId = event.target.dataset.id;
        const piece = this.searchResults.find(p => p.id === pieceId);

        if (piece) {
            // Vérifier si déjà dans le panier
            if (this.cart.some(item => item.pieceUnitaireId === pieceId)) {
                this.showToast('Info', 'Cette pièce est déjà dans le panier.', 'info');
                return;
            }
            
            // Logique conditionnelle pour le statut
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
                statutChronopost: defaultStatus,
                trackingUrl: '', // À définir si dispo
                isTrackingDisabled: true // Désactivé par défaut si pas d'URL
            }];
            this.showToast('Succès', 'Pièce ajoutée au panier.', 'success');
            
            // Retirer des résultats de recherche
            this.searchResults = this.searchResults.filter(res => res.id !== pieceId);
        }
    }
    handleCartAction(event){ 
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'remove') { 
            this.cart = this.cart.filter(item => item.pieceUnitaireId !== row.pieceUnitaireId); 
            // Refresh search results to show the removed item again if applicable
            const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
            if (searchInput && searchInput.value && searchInput.value.length >= 3) {
                this.performSearch(searchInput.value);
            }
        } 
        // L'action du bouton-icône est aussi interceptée ici
        else if (actionName === 'track_shipment') {
            if(row.trackingUrl) {
                this.openTrackingModal(row.trackingUrl);
            }
        }
    }
    // Cette méthode intercepte le clic sur la cellule "N° Bon Livraison"
    // Fonction pour ouvrir la modale de suivi
    async openTrackingModal(url) {
        await TrackingModal.open({
            size: 'large',
            description: 'Popup de suivi Chronopost',
            // Passe l'URL au composant modal
            trackingUrl: url,
        });
    }

    // --- Mobile Handlers ---
    handleCartInputChange(event) {
        const pieceId = event.target.dataset.id;
        const newVal = event.target.value;
        
        this.cart = this.cart.map(item => {
            if (item.pieceUnitaireId === pieceId) {
                return { ...item, numBonLivraison: newVal };
            }
            return item;
        });
    }

    handleRemoveItem(event) {
        const pieceId = event.target.dataset.id;
        this.cart = this.cart.filter(item => item.pieceUnitaireId !== pieceId);
        
        // Rafraîchir la recherche pour réafficher l'élément supprimé si pertinent
        const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
        if (searchInput && searchInput.value && searchInput.value.length >= 3) {
            this.performSearch(searchInput.value);
        }
    }

    handleTrackItem(event) {
        const url = event.target.dataset.url;
        if (url) {
            this.openTrackingModal(url);
        }
    }

    handleSetStatusLivre(event) {
        const pieceId = event.target.dataset.id;
        this.updateCartItemStatus(pieceId, 'Livré');
    }

    handleSetStatusPerdu(event) {
        const pieceId = event.target.dataset.id;
        this.updateCartItemStatus(pieceId, 'Perdu');
    }

    updateCartItemStatus(pieceId, newStatus) {
        // 1. Optimistic UI Update
        this.cart = this.cart.map(item => {
            if (item.pieceUnitaireId === pieceId) {
                return { ...item, statutChronopost: newStatus };
            }
            return item;
        });

        // 2. Call Apex if we have an Envoi ID (existing record)
        if (this._recordId && this._objectApiName === 'Envoi_Logistique__c') {
            this.isLoading = true;
            updateLineStatus({ envoiId: this._recordId, pieceId: pieceId, newStatus: newStatus })
                .then(() => {
                    this.showToast('Succès', `Statut mis à jour à "${newStatus}"`, 'success');
                    
                    // Rafraîchir l'enregistrement pour que les autres composants soient notifiés
                    getRecordNotifyChange([{ recordId: this._recordId }]);
                    
                    // Recharger les données du composant pour être sûr d'avoir l'état le plus frais
                    return this.loadEnvoiData(this._recordId);
                })
                .catch(error => {
                    this.showToast('Erreur', 'Erreur lors de la mise à jour du statut', 'error');
                    console.error(error);
                    // Revert UI on error? (Optional, but good practice)
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }
    }

    // -----------------------
    handleCartSave(event) {
        const draftValues = event.detail.draftValues;
        this.cart = this.cart.map(cartItem => {
            let draft = draftValues.find(d => d.pieceUnitaireId === cartItem.pieceUnitaireId);
            return draft ? { ...cartItem, ...draft } : cartItem;
        });
        this.draftValues = [];
    }
    
    handleSave(event) {
        const actionGlobale = event.target.dataset.globalAction || null;
        this.isLoading = true;
        // Préparation des lignes de détail pour l'envoi
        // On s'assure d'envoyer l'ID et le statut technique (apiValue)
        const orderLinesToSend = this.commandeDetails.map(detail => ({
            id: detail.id, // Assurez-vous que getCommandeDetails retourne bien l'Id
            statut: detail.statut // 'Disponible', 'Non Disponible', etc.
        }));
        const isCreation = !this._recordId || this._objectApiName !== 'Envoi_Logistique__c';

        const input = { 
            recordId: this._recordId, 
            contextObjectType: this._objectApiName, 
            nTicketCorrectifId: this.nTicketCorrectifId, 
            statutDeLEnvoi: this.statutEnvoi, 
            typeEnvoi: this.typeEnvoi, 
            transporteur: this.typeTransporteur,
            typeReception: this.typeReception,
            dateEnvoi: this.dateEnvoi,
            destinataireId: this.destinataireId, 
            lieuId: this.stockId, 
            commentaire: this.commentaire, 
            cart: this.cart,
            actionGlobale: actionGlobale,
            commandeParenteId: this.linkedCommandeId,
            orderLines: orderLinesToSend 
        };

        // Si on a déjà une date d'envoi et qu'on demande à VALIDER, on change en UPDATE simple
        if (this.dateEnvoi && actionGlobale === 'VALIDER') {
            input.actionGlobale = 'UPDATE';
        }

        saveEnvoi({ inputJSON: JSON.stringify(input) })
            .then(envoiId => {
                let successMsg = "L'envoi a été sauvegardé.";
                if (actionGlobale === 'VALIDER' && !this.dateEnvoi) successMsg = "Commande Validée. Envoi passé à 'Livraison en Cours'.";
                if (actionGlobale === 'REFUSER') successMsg = "Commande Refusée. Envoi passé à 'Clôturé NOK'.";

                this.showToast('Succès', successMsg, 'success');

                const recordsToRefresh = [];
                
                // 1. Rafraîchir l'Envoi créé ou mis à jour
                if (envoiId) recordsToRefresh.push({ recordId: envoiId });
                
                // 2. Rafraîchir la Commande liée (car son statut a pu changer)
                if (this.linkedCommandeId) recordsToRefresh.push({ recordId: this.linkedCommandeId });

                // 3. Rafraîchir le record courant si différent (cas rare mais possible)
                if (this._recordId && this._recordId !== envoiId && this._recordId !== this.linkedCommandeId) {
                    recordsToRefresh.push({ recordId: this._recordId });
                }

                if (recordsToRefresh.length > 0) {
                    getRecordNotifyChange(recordsToRefresh);
                }

                if (actionGlobale) {
                    // ... On met à jour la propriété de sortie pour le Flow
                    this.isSaveComplete = true;
                    this.isLoading = false; 
                    this.dispatchEvent(new FlowNavigationNextEvent());
                } else if (!this._recordId) {
                    this._recordId = envoiId;
                    this._objectApiName = 'Envoi_Logistique__c';
                    this.loadEnvoiData(envoiId);

                } else {
                    this.loadEnvoiData(this._recordId);
                }
            })
            .catch(error => {
                this.showToast('Erreur', this.reduceErrors(error)[0], 'error');
                this.isLoading = false;
            });
    }
    handleGenericChange(event) { this[event.target.dataset.field] = event.detail.value[0] || event.detail.value; }
    showToast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
    reduceErrors(errors) { if (!Array.isArray(errors)) { errors = [errors]; } return errors.filter(error => !!error).map(error => { if (error.body && error.body.message) { return error.body.message; } if (error.message) { return error.message; } return 'Unknown error'; }); }
}