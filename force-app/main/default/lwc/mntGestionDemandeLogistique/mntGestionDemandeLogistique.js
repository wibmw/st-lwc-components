import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';
import getInventoryAggregatesMulti from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getInventoryAggregatesMulti';
import searchArticles from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.searchArticles';
import createOrder from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.createOrder';
import getOrderDetails from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getOrderDetails';
import updateOrder from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.updateOrder';
import searchRecords from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.searchRecords';
import uploadFiles from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.uploadFiles';
import getAttachedFiles from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getAttachedFiles';
import getInitialData from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getInitialData';
import updatePec from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.updatePec';
import { NavigationMixin } from 'lightning/navigation';
import { getRecord, getFieldValue, deleteRecord, notifyRecordUpdateAvailable, getRecordNotifyChange } from 'lightning/uiRecordApi';
import FORM_FACTOR from '@salesforce/client/formFactor';

// --- GESTION CENTRALISÉE DES STATUTS ---
const STATUS_DEFINITIONS_BY_KEY = {
    'Disponible':   { key: 'Disponible',   apiValue: 'Disponible',   displayValue: '🟢 Disponible',   label: '🟢Disponible' },
    'Non Disponible':   { key: 'Non Disponible',   apiValue: 'Non Disponible',   displayValue: '🔴 Non Disponible',   label: '🔴Non Disponible' }
};
const STATUS_DEFINITIONS_BY_APIVALUE = {
    'Disponible':   STATUS_DEFINITIONS_BY_KEY['Disponible'],
    'Non Disponible':   STATUS_DEFINITIONS_BY_KEY['Non Disponible']
};

// --- DÉFINITION DES COLONNES ---
const COLS_AGG = [
    { label: 'Stock', fieldName: 'stock', type: 'number', cellAttributes: { alignment: 'left' } },
    { label: 'Article', fieldName: 'articleName', type: 'text' },
    { label: 'Site', fieldName: 'siteName', type: 'text' },
    { type: 'button', typeAttributes: { label: 'Ajouter', name: 'add', variant: 'brand-outline', disabled: { fieldName: 'isAddedToCart' } } }
];

const COLS_CART_CREATE = [
    { label: 'Site', fieldName: 'siteName', type: 'text' },
    { label: 'Article', fieldName: 'articleName', type: 'text' },
    { label: 'Quantité', fieldName: 'quantity', type: 'number', editable: true, cellAttributes: { alignment: 'right' } },
    { label: 'Commentaire', fieldName: 'comment', type: 'text', editable: true },
    { type: 'button-icon', initialWidth: 50, typeAttributes: { iconName: 'utility:delete', name: 'remove', alternativeText: 'Supprimer' } }
];

const COLS_TECHNICIAN = [
    { label: 'Article', fieldName: 'articleName', type: 'text' },
    { label: 'Quantité', fieldName: 'quantity', type: 'number', cellAttributes: { alignment: 'right' } },
    { label: 'Commentaire', fieldName: 'comment', type: 'text' }
];

const getRowActions = (row, doneCallback) => {
    const actions = [];
    if (row.statut !== 'Disponible') actions.push({ label: 'Valider la ligne', name: 'set_validated', iconName: 'utility:check' });
    if (row.statut !== 'Non Disponible') actions.push({ label: 'Refuser la ligne', name: 'set_refused', iconName: 'utility:close' });
    actions.push({ label: 'Supprimer', name: 'remove', iconName: 'utility:delete' });
    doneCallback(actions);
};

const COLS_CART_EDIT = [
    { label: 'Site', fieldName: 'siteName', type: 'text' },
    { label: 'Article', fieldName: 'articleName', type: 'text' },
    { label: 'Quantité', fieldName: 'quantity', type: 'number', editable: true },
    { label: 'Motif Refus', fieldName: 'commentaireRefus', type: 'text', editable: true },
    { label: 'Commentaire', fieldName: 'comment', type: 'text', editable: true },
    { type: 'action', typeAttributes: { rowActions: getRowActions } }
];

export default class MntGestionDemandeLogistique extends NavigationMixin(LightningElement) {
    @api recordId; 
    @api objectApiName;
    @api nTicketId; 
    @api ticketCorrectifID;
    @api componentLabel;
    @api isSaveComplete = false;
    @track selectedNTicket = null; 
    @track demandeurId;
    @track lieuId;
    @track compteProjet = '';
    @track adresseLivraisonId;
    @track selectedDemandeur = null;
    @track selectedLieu = null;
    @track selectedAdresseLivraison = null;
    @track lookupSuggestions = { demandeur: [], lieu: [], adresseLivraison: [], ticket: [] };
    @track lookupLoading = { demandeur: false, lieu: false, adresseLivraison: false, ticket: false };
    @track isLookupOpen = { demandeur: false, lieu: false, adresseLivraison: false, ticket: false };
    @track rows = [];
    @track loading = true;
    @track cart = [];
    @track globalComment = '';
    @track cartItemKeys = new Set();
    @track createdDate;
    @track createdByName;
    @track hasExistingCockpitLines = false;
    @track ticketPriority;
    @track ticketStatus;
    @track typeReception = 'Livraison';
    @track g2r;
    @track siteName;
    @track contactAddress;
    @track activeSections = ['info_demande'];

    get typeReceptionOptions() {
        return [
            { label: 'Livraison', value: 'Livraison' },
            { label: 'Remise en main propre', value: 'Remise en main propre' }
        ];
    }

    // Variable interne pour stocker l'état
    _viewCommandInfo;

    @api
    get viewCommandInfo() {
        // Si la valeur n'a jamais été définie (cas du Quick Action), on retourne TRUE par défaut.
        // Si la valeur a été définie (par App Builder/Flow), on retourne cette valeur.
        return this._viewCommandInfo !== undefined ? this._viewCommandInfo : true;
    }

    set viewCommandInfo(value) {
        this._viewCommandInfo = value;
    }

    aggCols = COLS_AGG;
    pageSize = 20;
    offset = 0;
    hasMore = true;
    @track articleSearchTerm = '';
    delayTimeout;

    // --- GETTERS POUR L'UI DYNAMIQUE ---
    get technicianRows() {
        return this.cart.filter(row => row.typeLigne === 'Technicien');
    }
    get cockpitRows() {
        return this.cart.filter(row => row.typeLigne === 'Cockpit'); // Default to Cockpit or undefined (legacy)
    }
    get isDesktop() {
        // Robust Mobile Detection
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
        const isSalesforceMobile = /SalesforceMobileSDK/i.test(userAgent);
        const isSmallScreen = window.innerWidth < 700;

        // If any mobile indicator is true, return false (Mobile Mode)
        if (isMobileDevice || isSalesforceMobile || isSmallScreen) {
            return false;
        }

        return FORM_FACTOR === 'Large';
    }

    get isViewCommandInfo() { return !!this.viewCommandInfo; }
    // En mode Desktop, on est en "édition" seulement s'il y a un recordId ET des lignes Cockpit existantes
    // En mode Mobile, on est en "édition" simplement s'il y a un recordId
    get isEditMode() { 
        if (!this.recordId) return false;
        if (this.isDesktop) {
            return this.hasExistingCockpitLines;
        }
        return true; // Mobile : édition si recordId existe
    }
    get cardTitle() { return this.isEditMode ? 'Modifier la Commande' : 'Créer une nouvelle Commande'; }
    // saveButtonLabel removed (duplicate)
    get cartCols() { return this.isEditMode ? COLS_CART_EDIT : COLS_CART_CREATE; }
    get isDisabled() { 
        // --- RESTRICTIONS BASÉES SUR LE STATUT (DESKTOP UNIQUEMENT) ---
        // En mode mobile, pas de restriction de statut pour la création
        if (this.isDesktop) {
            // En mode édition sur Desktop, on vérifie les statuts autorisés pour la mise à jour
            if (this.isEditMode) {
                // Les statuts 'Nouveau', 'PEC Cockpit' et 'Clôturer' NE permettent PAS la mise à jour
                const forbiddenStatusesForUpdate = ['Nouveau', 'Clôturer'];
                if (forbiddenStatusesForUpdate.includes(this.status)) {
                    return true; // Désactivé
                }
            } else {
                // En création sur Desktop : autorisé uniquement si ticketStatus = 'PEC Cockpit'
                if (this.ticketStatus && this.ticketStatus !== 'PEC Cockpit') {
                    return true; // Désactivé - création non autorisée
                }
            }
        }
        // En mode mobile : pas de restriction de statut, la création est toujours possible

        // --- VALIDATIONS DU PANIER (logique existante) ---
        // Si le panier est vide
        if (this.cart.length === 0) {
            // En mode "Mise à jour" (isEditMode = true), on active le bouton (return false) pour permettre la suppression totale.
            // En mode "Création", on laisse désactivé (return true) car créer une commande vide n'a pas de sens.
            return !this.isEditMode;
        }

        // Si le panier contient des articles, on vérifie qu'ils sont valides (Quantité > 0, Commentaire si "Autre")
        return !this.cart.every(c => {
            const hasQuantity = c.quantity && c.quantity > 0;
            // "Autre" requires a comment
            const isAutre = c.articleName && c.articleName.toLowerCase() === 'autre';
            const hasCommentIfRequired = isAutre ? (c.comment && c.comment.trim().length > 0) : true;
            return hasQuantity && hasCommentIfRequired;
        });
    }
    get enhancedRows() { return this.rows.map(row => ({...row, key: row.siteId ? `${row.siteId}-${row.articleId}` : row.articleId, isAddedToCart: this.cartItemKeys.has(row.siteId ? `${row.siteId}-${row.articleId}` : row.articleId), siteDisplayName: row.siteName ? (row.siteDescription ? `${row.siteName} - ${row.siteDescription}` : row.siteName) : '' })); }
    get demandeurComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.demandeur ? 'slds-is-open' : ''}`; }
    get lieuComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.lieu ? 'slds-is-open' : ''}`; }
    get adresseLivraisonComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.adresseLivraison ? 'slds-is-open' : ''}`; }
    get nTicketComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.ticket ? 'slds-is-open' : ''}`; }
    
    get showNoResultsMessage() {
        return this.articleSearchTerm.length >= 3 && this.rows.length === 0 && !this.loading;
    }

    get saveButtonLabel() {
        if (!this.isEditMode) {
            return 'Créer la Demande';
        }
        if (!this.isDesktop) {
            return 'Mettre à jour la Demande';
        }
        return this.hasExistingCockpitLines ? 'Mettre à jour' : 'Créer la Demande';
    }

    // Getter pour afficher un message d'erreur sur le statut (Desktop uniquement)
    get statusRestrictionMessage() {
        // Pas de message de restriction en mobile
        if (!this.isDesktop) {
            return null;
        }
        
        if (this.isEditMode) {
            const forbiddenStatusesForUpdate = ['Nouveau', 'PEC Cockpit', 'Clôturer'];
            if (forbiddenStatusesForUpdate.includes(this.status)) {
                return `La mise à jour n'est pas autorisée pour le statut "${this.status}".`;
            }
        } else {
            // En création sur Desktop
            if (this.ticketStatus && this.ticketStatus !== 'PEC Cockpit') {
                return `La création de demande n'est autorisée que lorsque le statut du ticket est "PEC Cockpit". Statut actuel : "${this.ticketStatus}".`;
            }
        }
        return null;
    }

    get hasStatusRestriction() {
        return !!this.statusRestrictionMessage;
    }
    // --- LOGIQUE PRINCIPALE ---
    
    connectedCallback() {
        // Auto-populate ticket ID if provided via input variable
        if (this.ticketCorrectifID && !this.nTicketId) {
            this.nTicketId = this.ticketCorrectifID;
        }

        // Handle context where component is on a Ticket record page
        if (this.objectApiName === 'Correctif__c' && this.recordId) {
            this.nTicketId = this.recordId;
            this.loadInitialData();
        } 
        // Handle context where component is on a Job record page
        else if (this.objectApiName === 'sitetracker__Job__c' && this.recordId) {
            this.loadInitialData();
        }
        // On utilise recordId directement car isEditMode dépend de hasExistingCockpitLines 
        // qui n'est pas encore chargé à ce stade
        else if (this.recordId) { 
            this.loadOrderData(); 
        } else { 
            this.loadInitialData(); 
        }
    }

    async loadInitialData() {
        this.loading = true;
        try {
            let params = { nTicketId: this.nTicketId };
            if (this.objectApiName === 'sitetracker__Job__c' && this.recordId) {
                params = { recordId: this.recordId, sObjectType: 'sitetracker__Job__c' };
            }

            const data = await getInitialData(params);
            
            // 1. User Info
            this.currentUserName = data.currentUserName;
            if (!this.demandeurId) {
                this.demandeurId = data.currentUserId;
                this.selectedDemandeur = { value: data.currentUserId, label: this.currentUserName };
            }

            // 2. Ticket Info
            if (data.nTicketCorrectifId) {
                this.nTicketId = data.nTicketCorrectifId;
                const label = data.nTicketName || '';
                const sublabel = data.nTicketSubLabel || '';
                this.selectedNTicket = {
                    value: data.nTicketCorrectifId,
                    label: label,
                    sublabel: sublabel,
                    pillLabel: sublabel ? `${label} - ${sublabel}` : label
                };
                this.g2r = data.g2r;
                this.siteName = data.siteName;

                // 3. Site Info from Ticket
                if (data.lieuId && !this.lieuId) {
                    this.lieuId = data.lieuId;
                    this.selectedLieu = {
                        value: data.lieuId,
                        label: data.lieuName,
                        sublabel: data.lieuNomDuSite,
                        pillLabel: data.pillLabels
                    };
                }
            }
        } catch (error) {
            console.error('Error loading initial data', error);
            this.showToast('Erreur', 'Impossible de charger les données initiales', 'error');
        } finally {
            this.loading = false;
        }
    }

    async loadOrderData() {
        this.loading = true;

        try {
            const orderData = await getOrderDetails({ orderId: this.recordId });
            this.nTicketId = orderData.nTicketCorrectifId;
            if (orderData.nTicketCorrectifId) {
                const label = orderData.nTicketName || ''; 
                const sublabel = orderData.nTicketSubLabel || ''; 
                this.selectedNTicket = { value: orderData.nTicketCorrectifId, label: orderData.nTicketName, sublabel: sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label };
                this.ticketPriority = orderData.ticketPriority;
                this.ticketStatus = orderData.ticketStatus;
                this.g2r = orderData.g2r;
                this.siteName = orderData.siteName;
            }
            this.globalComment = orderData.globalComment || '';
            this.demandeurId = orderData.demandeurId;
            this.lieuId = orderData.lieuId;
            this.adresseLivraisonId = orderData.adresseLivraisonId;
            if (orderData.demandeurId) this.selectedDemandeur = { value: orderData.demandeurId, label: orderData.demandeurName, sublabel: orderData.demandeurPhone };
            if (orderData.lieuId) this.selectedLieu = { value: orderData.lieuId, label: orderData.lieuName, sublabel: orderData.lieuNomDuSite, pillLabel: orderData.pillLabels }; 
            this.compteProjet = orderData.compteProjet;
            if (orderData.adresseLivraisonId) this.selectedAdresseLivraison = { value: orderData.adresseLivraisonId, label: orderData.adresseLivraisonName, sublabel: orderData.adresseLivraisonFull };
            this.contactAddress = orderData.adresseLivraisonFull;
            this.createdDate = orderData.createdDate;
            this.createdByName = orderData.createdByName;
            this.status = orderData.status;
            this.pecCockpitDate = orderData.pecCockpitDate;
            this.pecCockpitBy = orderData.pecCockpitBy;
            this.pecRetraitementDate = orderData.pecRetraitementDate;
            this.pecRetraitementBy = orderData.pecRetraitementBy;
            this.typeReception = orderData.typeReception || 'Livraison';

            // Load attached files
            this.refreshAttachedFiles();

            const cartLines = orderData.lines
                .filter(line => {
                    // Context-aware filtering
                    if (this.isDesktop) {
                        // Desktop: Show ONLY Cockpit lines
                        return line.typeLigne === 'Cockpit';
                    } else {
                        // Mobile: Show Technicien lines
                        return line.typeLigne === 'Technicien';
                    }
                })
                .map(line => {
                    const siteSuffix = line.siteNomDuSite ? ` - ${line.siteNomDuSite}` : '';
                    const fullSiteName = line.siteName + siteSuffix;
                    const statusDef = STATUS_DEFINITIONS_BY_APIVALUE[line.statut];
                    const key = `${line.siteId}-${line.articleId}`;
                    return { ...line, key: key, statutForDisplay: statusDef ? statusDef.displayValue : line.statut || '', isAutre: line.articleName && line.articleName.toLowerCase() === 'autre', mnemonique: line.mnemonique, description: line.description, siteName: fullSiteName };
                });
                if (this.isDesktop) {
                    this.hasExistingCockpitLines = cartLines.length > 0;
                }   
            this.cart = cartLines;
            this.updateCartKeys();
            this.cartItemKeys = new Set(this.cart.map(c => c.key));
        } catch (error) { this.toast('Erreur', 'Impossible de charger la commande : ' + (error.body?.message || error.message), 'error'); } 
        finally { this.loading = false; }
    }

    // Fonction utilitaire pour centraliser la mise à jour des clés
    updateCartKeys() {
        this.cartItemKeys = new Set(this.cart.map(c => c.key));
    }
    async handleSaveOrder() {
        if (this.isDisabled) { this.toast('Attention', 'Veuillez renseigner une quantité valide (> 0) et un commentaire pour les articles "Autre".', 'warning'); return; }
        
        const targetType = this.isDesktop ? 'Cockpit' : 'Technicien';
        const linesInput = this.cart.map(c => ({ detailId: c.detailId, siteId: c.siteId, articleId: c.articleId, quantity: parseInt(c.quantity, 10), comment: c.comment, statut: c.statut, commentaireRefus: c.commentaireRefus, typeLigne: targetType }));
        this.loading = true;
        try {
            if (this.isEditMode) {
                // SYNCHRONISER L'ÉTAT APRÈS MISE À JOUR ---
                const typeLigneContext = this.isDesktop ? 'Cockpit' : 'Technicien';
                const input = { orderId: this.recordId, nTicketCorrectifId: this.nTicketId, globalComment: this.globalComment, lines: linesInput, demandeurId: this.demandeurId, lieuId: this.lieuId, compteProjet: this.compteProjet, adresseLivraisonId: this.adresseLivraisonId, typeLigneContext: typeLigneContext };
                const newIdsMap = await updateOrder({ inputJSON: JSON.stringify(input) });
                
                // On met à jour le panier avec les nouveaux detailId retournés par Apex
                this.cart = this.cart.map(item => {
                    if (newIdsMap && newIdsMap[item.key]) {
                        return { ...item, detailId: newIdsMap[item.key] };
                    }
                    return item;
                });

                this.toast('Succès', 'Commande mise à jour.', 'success');
                getRecordNotifyChange([{recordId: this.recordId}]);
            } 
            else { 
                const input = { nTicketCorrectifId: this.nTicketId, globalComment: this.globalComment, lines: linesInput, demandeurId: this.demandeurId, lieuId: this.lieuId, compteProjet: this.compteProjet, adresseLivraisonId: this.adresseLivraisonId };
                const newOrderId = await createOrder({ inputJSON: JSON.stringify(input) });
                
                // Upload files if any
                if (this.filesToUpload.length > 0) {
                    const filesData = this.filesToUpload.map(f => ({ title: f.name, base64Data: f.base64 }));
                    await uploadFiles({ recordId: newOrderId, files: filesData });
                }

                this.toast('Succès', 'Commande créée avec succès.', 'success'); 
                getRecordNotifyChange([{recordId: this.recordId}]);
                // On met à jour la variable de sortie pour indiquer au Flow que c'est terminé
                this.isSaveComplete = true;

                // On envoie l'événement pour que le Flow avance automatiquement
                this.dispatchEvent(new FlowNavigationNextEvent());
                // this.handleResetForm(); 
            }

        } catch (e) { 
            console.error('Error during save:', e); 
            this.toast('Erreur', e?.body?.message || 'Erreur lors de la sauvegarde.', 'error'); 
        } 
        finally { this.loading = false; }
    }

    // --- GESTION DES CHAMPS D'EN-TÊTE ET RECHERCHES ---
    handleLookupSearch(event) {
        const lookupType = event.target.dataset.lookup;
        const searchTerm = event.target.value;
        window.clearTimeout(this.delayTimeout);
        this.delayTimeout = setTimeout(() => {
            if (searchTerm.length >= 3) {
                this.isLookupOpen[lookupType] = true; // Ouvrir le dropdown
                this.fetchLookupSuggestions(searchTerm, lookupType);
            } else {
                this.isLookupOpen[lookupType] = false; // Fermer si moins de 3 caractères
                this.lookupSuggestions[lookupType] = [];
            }
        }, 300);
    }


    async fetchLookupSuggestions(searchTerm, lookupType) {
        this.lookupLoading[lookupType] = true;
        const sObjectTypeMap = { demandeur: 'User', lieu: 'sitetracker__Site__c', adresseLivraison: 'Contact', ticket: 'Correctif__c' };
        console.log('Searching for:', lookupType, searchTerm, sObjectTypeMap[lookupType]);
        try { 
            const results = await searchRecords({ searchTerm: searchTerm, sObjectType: sObjectTypeMap[lookupType] }); 
            console.log('Search results:', results);
            this.lookupSuggestions[lookupType] = results;
        } 
        catch (error) { 
            console.error('Search error:', error);
            this.toast('Erreur', 'Recherche impossible', 'error'); 
        } 
        finally { this.lookupLoading[lookupType] = false; }
    }

    handleLookupSelect(event) {
        const { value, label, sublabel, pillLabel, lookup } = event.currentTarget.dataset;
        switch (lookup) { case 'ticket': this.nTicketId = value; this.selectedNTicket = { value, label, sublabel, pillLabel: label }; break; case 'demandeur': this.demandeurId = value; this.selectedDemandeur = { value, label, sublabel }; break; case 'lieu': this.lieuId = value; this.selectedLieu = { value, label, sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label}; break; case 'adresseLivraison': this.adresseLivraisonId = value; this.selectedAdresseLivraison = { value, label, sublabel }; break; }
        this.lookupSuggestions[lookup] = [];
        const inputElement = this.template.querySelector(`lightning-input[data-lookup="${lookup}"]`);
        if (inputElement) { inputElement.value = ''; }
        this.isLookupOpen[lookup] = false;
    }

    handleLookupPillRemove(event) {
        const lookupType = event.target.dataset.lookup;
        const lookupMap = {
            'ticket': () => { this.nTicketId = null; this.selectedNTicket = null; },
            'demandeur': () => { this.demandeurId = null; this.selectedDemandeur = null; },
            'lieu': () => { this.lieuId = null; this.selectedLieu = null; },
            'adresseLivraison': () => { this.adresseLivraisonId = null; this.selectedAdresseLivraison = null; },
            'adresselivraison': () => { this.adresseLivraisonId = null; this.selectedAdresseLivraison = null; }
        };
        if (lookupMap[lookupType]) lookupMap[lookupType]();
    }
    
    handleLookupFocus(event) { this.isLookupOpen[event.target.dataset.lookup] = true; }

    handleLookupBlur(event) {
        // -- CORRECTION : Capturer les références AVANT le setTimeout pour éviter l'erreur --
        const inputElement = event.target;
        const lookupType = inputElement.dataset.lookup;

        setTimeout(() => {
            let selectedId = null;
            switch (lookupType) { case 'ticket': selectedId = this.nTicketId; break; case 'demandeur': selectedId = this.demandeurId; break; case 'lieu': selectedId = this.lieuId; break; case 'adresseLivraison': selectedId = this.adresseLivraisonId; break; }
            
            // Si le champ a une valeur mais qu'aucun ID n'a été enregistré, c'est une saisie invalide
            if (inputElement && inputElement.value && !selectedId) {
                this.toast('Erreur de saisie', `"${inputElement.value}" n'est pas une valeur valide. Veuillez sélectionner un enregistrement dans la liste.`, 'error');
                inputElement.value = ''; // On vide le champ invalide
            }
            this.isLookupOpen[lookupType] = false;
        }, 250);
    }

    handleCompteProjetChange(event) { if (event.target.value.trim()) { this.compteProjet = event.target.value.trim(); } }
    handleCompteProjetKeyDown(event) { if (event.key === 'Enter') { this.handleCompteProjetChange(event); event.target.blur(); } }
    handleCompteProjetPillRemove() { this.compteProjet = ''; }
    handleGlobalCommentChange(event) { this.globalComment = event.target.value; }

    handleTypeReceptionChange(event) {
        this.typeReception = event.detail.value;
        if (this.typeReception === 'Remise en main propre') {
            this.contactAddress = '';
        } else if (this.selectedAdresseLivraison && this.selectedAdresseLivraison.sublabel) {
            this.contactAddress = this.selectedAdresseLivraison.sublabel;
        }
    }

    // --- GESTION DES PHOTOS ---
    @track filesToUpload = []; // Pour le mode création : { name, base64, previewUrl }
    @track attachedFiles = []; // Pour le mode édition : { id, title, contentVersionId }
    
    get hasFilesToUpload() { return this.filesToUpload.length > 0; }
    get hasAttachedFiles() { return this.attachedFiles.length > 0; }

    handleFileSelect(event) {
        const files = event.target.files;
        if (files) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result.split(',')[1];
                    this.filesToUpload.push({
                        name: file.name,
                        base64: base64,
                        previewUrl: URL.createObjectURL(file), // Pour prévisualisation locale
                        key: Date.now() + i // Unique key
                    });
                };
                reader.readAsDataURL(file);
            }
        }
    }

    handleRemoveFileToUpload(event) {
        const index = event.target.dataset.index;
        this.filesToUpload.splice(index, 1);
        // Force refresh if needed (track handles it)
    }

    get isPecCockpitDisabled() {
        return this.status !== 'Nouveau';
    }

    get isPecRetraitementDisabled() {
        return this.status !== 'À Retraiter';
    }
    
    async handlePecAction(event) {
        const actionName = event.target.name; 
        const pecType = actionName === 'pec_cockpit' ? 'Cockpit' : 'Retraitement';
        
        this.loading = true;
        try {
            await updatePec({ orderId: this.recordId, pecType: pecType });
            this.toast('Succès', `PEC ${pecType} enregistrée.`, 'success');
            if (pecType === 'Cockpit') {
                this.status = 'PEC Cockpit'; 
            } else if (pecType === 'Retraitement') {
                this.status = 'PEC Retraitement'; 
            }

            getRecordNotifyChange([{recordId: this.recordId}]);
        } catch (error) {
            this.toast('Erreur', 'Impossible de mettre à jour la PEC : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }

    handleUploadFinished(event) {
        this.toast('Succès', 'Fichiers téléchargés avec succès.', 'success');
        
        // Optimistic UI Update: Add uploaded files immediately
        const uploadedFiles = event.detail.files;
        if (uploadedFiles && uploadedFiles.length > 0) {
            const newFiles = uploadedFiles.map(file => ({
                id: file.documentId,
                title: file.name,
                previewUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`
            }));
            this.attachedFiles = [...this.attachedFiles, ...newFiles];
        }

        // Still refresh from server after a delay to ensure consistency
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.refreshAttachedFiles();
        }, 1000);
    }

    async refreshAttachedFiles() {
        if (this.recordId) {
            try {
                const files = await getAttachedFiles({ recordId: this.recordId });
                this.attachedFiles = files.map(file => {
                    // Normalize keys to handle potential casing differences (Id vs id, Title vs title)
                    const id = file.Id || file.id;
                    const title = file.Title || file.title;
                    return {
                        ...file,
                        id: id,
                        title: title,
                        previewUrl: `/sfc/servlet.shepherd/document/download/${id}`
                    };
                });
            } catch (e) {
                console.error('Erreur chargement fichiers', e);
            }
        }
    }

    handlePreviewFile(event) {
        const fileId = event.currentTarget.dataset.id; 
        this[NavigationMixin.Navigate]({
            type: 'standard__namedPage',
            attributes: {
                pageName: 'filePreview'
            },
            state: {
                selectedRecordId: fileId
            }
        });
    }

    async handleDeleteAttachedFile(event) {
        event.stopPropagation(); 
        const fileId = event.target.dataset.id;
        if (!fileId) return;

        this.loading = true;
        try {
            await deleteRecord(fileId);
            this.toast('Succès', 'Photo supprimée.', 'success');
            // Update UI immediately and do NOT refresh from server to avoid stale data race condition
            this.attachedFiles = this.attachedFiles.filter(file => file.id !== fileId);
        } catch (error) {
            this.toast('Erreur', 'Impossible de supprimer la photo : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }
    
    // --- GESTION RECHERCHE D'ARTICLES ET PANIER ---
    handleArticleSearchInput(e) { this.articleSearchTerm = (e.target.value || '').trim(); window.clearTimeout(this.delayTimeout); this.delayTimeout = setTimeout(() => this.refresh(true), 300); }

    async refresh(reset = true) {
        if (this.articleSearchTerm.length < 3) { this.rows = []; this.hasMore = false; return; }
        if (reset) { this.offset = 0; this.rows = []; } this.loading = true;
        try {
            const articlesFound = await searchArticles({ term: this.articleSearchTerm, limitSize: 100 });
            
            if (this.isDesktop) {
                const articleIds = articlesFound.map(art => art.value);
                if (articleIds.length > 0) { 
                    let res = await getInventoryAggregatesMulti({ articleIds: articleIds, limitSize: this.pageSize, offsetVal: this.offset, groupBySite: this.isDesktop }); 
                    res = res.map(row => {
                        const suffix = row.siteNomDuSite ? ` - ${row.siteNomDuSite}` : '';
                        return { 
                            ...row, 
                            siteName: row.siteName + suffix 
                        };
                    });
                    this.rows = reset ? [...res] : [...this.rows, ...res]; 
                    this.hasMore = res.length === this.pageSize; 
                } 
                else { this.rows = []; }
            } else {
                // Mobile: Use articles directly without site aggregation
                const res = articlesFound.map(art => ({
                    articleId: art.value,
                    articleName: art.label,
                    mnemonique: art.sublabel,
                    description: art.description,
                    siteId: null,
                    siteName: '',
                    stock: 0
                }));
                this.rows = reset ? [...res] : [...this.rows, ...res];
                this.hasMore = false;
            }
        } catch (e) { this.toast('Erreur', 'Chargement impossible: ' + (e.body?.message || e.message), 'error'); } 
        finally { this.loading = false; }
    }

    handleLoadMore() { if (this.hasMore && !this.loading) { this.offset += this.pageSize; this.refresh(false); } }

    updateCartKeys() {
        this.cartItemKeys = new Set(this.cart.map(c => c.key));
    }

    handleAggRowAction(e) { 
        const row = e.detail.row;
        this.addToCart(row);
    }

    addToCart(row) {
        const rowKey = row.siteId ? `${row.siteId}-${row.articleId}` : row.articleId;
        if (this.cartItemKeys.has(rowKey)) return;
        
        const newItem = {
            key: rowKey,
            siteId: row.siteId,
            siteName: row.siteName,
            articleId: row.articleId,
            articleName: row.articleName,
            mnemonique: row.mnemonique,
            description: row.description,
            quantity: 1,
            comment: '',
            statut: 'Disponible', 
            statutForDisplay: 'Disponible',
            isAutre: row.articleName && row.articleName.toLowerCase() === 'autre',
            typeLigne: this.isDesktop ? 'Cockpit' : 'Technicien'
        };
        this.cart = [...this.cart, newItem];
        this.updateCartKeys();
        this.cartItemKeys.add(rowKey);
        this.toast('Succès', `${row.articleName} ajouté.`, 'success'); 
        if (this.isDesktop) {
            this.hasExistingCockpitLines = this.cart.length > 0;
        } 
    }

    handleCartAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'remove') { this.cart = this.cart.filter(c => c.key !== row.key); this.updateCartKeys(); this.cartItemKeys.delete(row.key); return; }
        let statusKey = null;
        if (actionName === 'set_validated') statusKey = 'Disponible'; if (actionName === 'set_refused') statusKey = 'Non Disponible'; 
        if (statusKey) {
            const statusDef = STATUS_DEFINITIONS_BY_KEY[statusKey];
            this.cart = this.cart.map(item => { if (item.key === row.key) { return { ...item, statut: statusDef.apiValue, statutForDisplay: statusDef.displayValue }; } return item; });
            this.toast('Statut mis à jour', `La ligne est maintenant "${statusDef.label}".`, 'success');
        }
        if (this.isDesktop) {
            this.hasExistingCockpitLines = this.cart.length > 0;
        }
    }

    handleCartSave(e) {
        const drafts = e.detail.draftValues || [];
        const mapDraft = new Map(drafts.map(d => [d.key, d]));
        this.cart = this.cart.map(c => { const draft = mapDraft.get(c.key); return draft ? { ...c, ...draft } : c; });
        this.template.querySelector('lightning-datatable[data-id="cart"]').draftValues = []; 
    }

    // --- GESTION PANIER (SHARED) ---

    updateCartItem(key, field, value) {
        this.cart = this.cart.map(item => 
            item.key === key ? { ...item, [field]: value } : item
        );
    }

    removeCartItem(key) {
        this.cart = this.cart.filter(c => c.key !== key);
        this.updateCartKeys();
        this.cartItemKeys.delete(key);
    }

    // --- GESTION PANIER DESKTOP (CARTES) ---

    handleCartQuantityChange(event) {
        this.updateCartItem(event.target.dataset.key, 'quantity', event.target.value);
    }

    handleCartCommentChange(event) {
        this.updateCartItem(event.target.dataset.key, 'comment', event.target.value);
    }

    handleCartRemove(event) {
        this.removeCartItem(event.target.dataset.key);
    }

    // --- MOBILE HANDLERS ---
    handleMobileQuantityChange(event) {
        this.updateCartItem(event.target.dataset.key, 'quantity', event.target.value);
    }

    handleMobileCommentChange(event) {
        this.updateCartItem(event.target.dataset.key, 'comment', event.target.value);
    }

    handleMobileRefusalChange(event) {
        this.updateCartItem(event.target.dataset.key, 'commentaireRefus', event.target.value);
    }

    handleMobileRemove(event) {
        this.removeCartItem(event.target.dataset.key);
    }

    handleMobileAction(event) {
        const key = event.target.dataset.key;
        const actionName = event.target.dataset.action;
        
        let statusKey = null;
        if (actionName === 'set_validated') statusKey = 'Disponible';
        if (actionName === 'set_refused') statusKey = 'Non Disponible';

        if (statusKey) {
            const statusDef = STATUS_DEFINITIONS_BY_KEY[statusKey];
            this.cart = this.cart.map(item => {
                if (item.key === key) {
                    return { ...item, statut: statusDef.apiValue, statutForDisplay: statusDef.displayValue };
                }
                return item;
            });
            this.toast('Statut mis à jour', `La ligne est maintenant "${statusDef.label}".`, 'success');
        }
    }

    handleMobileAggAdd(event) {
        const key = event.target.dataset.key;
        const row = this.enhancedRows.find(r => r.key === key);
        if (row) {
            this.addToCart(row);
        }
    }
    // -----------------------

    // --- UTILITAIRES ---
    handleResetForm() {
        this.cart = []; this.globalComment = ''; this.cartItemKeys = new Set();
        // -- CORRIGÉ : Réinitialisation correcte de tous les lookups --
        this.nTicketId = null; this.selectedNTicket = null;
        this.demandeurId = null; this.selectedDemandeur = null;
        this.lieuId = null; this.selectedLieu = null;
        this.adresseLivraisonId = null; this.selectedAdresseLivraison = null;
        this.compteProjet = '';
        this.rows = [];
        this.articleSearchTerm = '';
        this.filesToUpload = [];
        this.attachedFiles = [];
    }
    
    toast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
}
