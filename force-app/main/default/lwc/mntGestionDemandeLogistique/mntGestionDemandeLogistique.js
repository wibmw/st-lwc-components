import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { FlowNavigationNextEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { NavigationMixin } from 'lightning/navigation';
import { deleteRecord, getRecordNotifyChange, getRecord } from 'lightning/uiRecordApi';
import { CloseActionScreenEvent } from 'lightning/actions';
import { isDesktopDevice, STATUS_DEFINITIONS_BY_KEY, STATUS_DEFINITIONS_BY_APIVALUE } from 'c/logisticsUtils';
import * as workspaceApi from 'lightning/platformWorkspaceApi';
import { RefreshEvent } from 'lightning/refresh';

// ... (existing imports)

import getInventoryAggregatesMulti from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getInventoryAggregatesMulti';
import searchArticles from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.searchArticles';
import createOrder from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.createOrder';
import getOrderDetails from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getOrderDetails';
import updateOrder from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.updateOrder';
import uploadFiles from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.uploadFiles';
import getAttachedFiles from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getAttachedFiles';
import getInitialData from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.getInitialData';
import updatePec from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.updatePec';

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
    @track selectedDemandeur = null;
    @track selectedLieu = null;
    @track selectedAdresseLivraison = null;
    
    @track demandeurId;
    @track lieuId;
    @track compteProjet = '';
    @track adresseLivraisonId;
    @track globalComment = '';
    @track typeReception = 'Livraison';
    @track contactAddress;
    
    @track rows = [];
    @track cart = [];
    @track cartItemKeys = new Set();
    @track loading = true;
    @track hasExistingCockpitLines = false;
    
    @track ticketPriority;
    @track ticketName;
    @track ticketStatus;
    @track g2r;
    @track siteName;
    @track createdByName;
    @track pecCockpitDate;
    @track pecCockpitBy;
    @track pecRetraitementDate;
    @track pecRetraitementBy;
    @track status;
    
    @track filesToUpload = [];
    @track attachedFiles = [];
    @track activeSections = ['info_demande'];
    @track articleSearchTerm = '';
    
    // Flag pour éviter la double initialisation
    isInitialized = false;

    _viewCommandInfo;
    delayTimeout;

    // Getter pour la détection de l'objet - retourne recordId seulement s'il est valide
    get recordIdForDetection() {
        if (!this.recordId || typeof this.recordId !== 'string') return undefined;
        if (this.recordId.trim() === '') return undefined;
        return this.recordId;
    }

    // Wire pour détecter automatiquement l'objectApiName depuis le recordId
    // Utile quand le composant est dans un Flow où objectApiName n'est pas passé automatiquement
    @wire(getRecord, { recordId: '$recordIdForDetection', layoutTypes: ['Compact'] })
    wiredRecord({ error, data }) {
        if (data) {
            // Alimenter objectApiName avec le type d'objet détecté
            if (!this.objectApiName) {
                this.objectApiName = data.apiName;
                console.log('🔍 Object API Name auto-détecté:', this.objectApiName, 'depuis recordId:', this.recordId);
                
                // Initialiser le composant maintenant que objectApiName est disponible
                this.initializeComponent();
            }
        } else if (error) {
            console.log('⚠️ Erreur détection object (normal si pas de recordId):', error);
        }
    }

    @api get viewCommandInfo() {
        return this._viewCommandInfo !== undefined ? this._viewCommandInfo : true;
    }
    set viewCommandInfo(value) {
        this._viewCommandInfo = value;
    }

    get typeReceptionOptions() {
        return [
            { label: 'Livraison', value: 'Livraison' },
            { label: 'Remise en main propre', value: 'Remise en main propre' }
        ];
    }

    get isDesktop() {
        return isDesktopDevice();
    }

    get isViewCommandInfo() {
        return !!this.viewCommandInfo;
    }

    get isEditMode() {
        if (!this.recordId) return false;
        // En mobile, si recordId est présent, c'est une édition.
        // Mais attention aux IDs vides ou nulls passés par Flow
        if (typeof this.recordId === 'string' && this.recordId.trim() === '') return false;
        
        // Si on est sur un Ticket (Correctif__c) ou un Job, c'est une création (contexte parent)
        if (this.objectApiName === 'Correctif__c' || this.objectApiName === 'sitetracker__Job__c') {
            return false;
        }

        // Si on a un recordId et qu'on n'est pas dans un contexte parent, c'est une édition,
        // peu importe s'il y a des lignes ou non (ex: dossier 'À Retraiter').
        return true;
    }

    get cardTitle() {
        return this.isEditMode ? 'Modifier la Demande' : 'Créer une nouvelle Demande';
    }

    get cartCols() {
        return COLS_CART_EDIT;
    }

    get isDisabled() {
        if (this.isDesktop) {
            if (this.isEditMode) {
                const forbiddenStatusesForUpdate = ['Nouveau', 'Clôturé','À Retraiter'];
                if (forbiddenStatusesForUpdate.includes(this.status)) return true;
            } else {
                if (this.ticketStatus && this.ticketStatus !== 'PEC Cockpit' && this.ticketStatus !== 'PEC Retraitement') return true;
            }
        }

        // Validation Panier Vide
        if (this.cart.length === 0) {
             // Cas Création : on ne peut pas créer une demande vide
             if (!this.isEditMode) return true;

             // Cas Première Validation (PEC Cockpit) : on doit avoir des lignes pour valider
             if (this.status === 'PEC Cockpit') return true;

             // Cas Mise à jour (Commande en Cours, PEC Retraitement...) :
             // On AUTORISE un panier vide (pour passer en 'À Retraiter')
             return false;
        }

        return !this.cart.every(c => {
            // Validation quantité: doit être un nombre > 0
            const quantity = parseFloat(c.quantity);
            const hasValidQuantity = !isNaN(quantity) && quantity > 0;
            
            const isAutre = c.articleName && c.articleName.toLowerCase() === 'autre';
            const hasCommentIfRequired = isAutre ? (c.comment && c.comment.trim().length > 0) : true;
            return hasValidQuantity && hasCommentIfRequired;
        });
    }

    get enhancedRows() {
        return this.rows
            .filter(row => {
                const key = row.siteId ? `${row.siteId}-${row.articleId}` : row.articleId;
                return !this.cartItemKeys.has(key);
            })
            .map(row => ({
                ...row,
                key: row.siteId ? `${row.siteId}-${row.articleId}` : row.articleId,
                isAddedToCart: false
            }));
    }

    get showNoResultsMessage() {
        return this.articleSearchTerm.length >= 3 && this.rows.length === 0 && !this.loading;
    }

    get saveButtonLabel() {
        // Mobile behavior: always "Créer" unless editing an existing one (which is rare/different view)
        if (!this.isDesktop) {
            return this.isEditMode && this.status !== '' ? 'Mettre à jour' : 'Créer la Demande';
        }
        
        // Desktop behavior
        if (!this.isEditMode && this.status == 'Nouveau') return 'Créer la Demande';
        return this.hasExistingCockpitLines && this.status == 'PEC Cockpit' ? 'Valider la Demande' : 'Mettre à jour';
    }

    get hasFilesToUpload() {
        return this.filesToUpload.length > 0;
    }

    get hasAttachedFiles() {
        return this.attachedFiles.length > 0;
    }

    get isMobile() {
        return !this.isDesktop;
    }

    get isPecCockpitDisabled() {
        return this.status !== 'Nouveau';
    }

    get isPecRetraitementDisabled() {
        return this.status !== 'À Retraiter';
    }

    get showAddressFields() {
        return this.typeReception !== 'Remise en main propre';
    }

    get showMobileTicketLookup() {
        return this.isMobile && !this.recordId;
    }

    get showCancelButton() {
        // Mode création uniquement : Pas d'ID, ou contexte parent (Ticket/Job)
        if (!this.recordId) return true;
        if (this.objectApiName === 'Correctif__c' || this.objectApiName === 'sitetracker__Job__c') return true;
        return false;
    }

    connectedCallback() {
        console.log('mntGestionDemandeLogistique connected. recordId:', this.recordId, 'objectApiName:', this.objectApiName, 'nTicketId:', this.nTicketId);
        
        if (this.ticketCorrectifID && !this.nTicketId) {
            this.nTicketId = this.ticketCorrectifID;
        }

        // Si ticketCorrectifID est fourni mais pas de recordId valide, on sait que c'est un Correctif__c
        if (this.ticketCorrectifID && !this.recordIdForDetection && !this.objectApiName) {
            this.objectApiName = 'Correctif__c';
            console.log('📋 Object API Name défini depuis ticketCorrectifID:', this.objectApiName);
        }

        // Si objectApiName est déjà défini (Record Page), initialiser immédiatement
        // Sinon, attendre que le @wire(getRecord) le détecte
        if (this.objectApiName) {
            console.log('✅ objectApiName déjà disponible, initialisation immédiate');
            this.initializeComponent();
        } else if (!this.recordIdForDetection) {
            // Pas de recordId valide et pas d'objectApiName → création standard
            console.log('ℹ️ Pas de recordId, chargement initial pour création');
            this.initializeComponent();
        } else {
            console.log('⏳ Attente de la détection automatique de objectApiName via @wire...');
        }
    }

    // Méthode d'initialisation appelée une fois que objectApiName est disponible
    initializeComponent() {
        if (this.isInitialized) {
            console.log('⚠️ Déjà initialisé, ignorer');
            return;
        }
        this.isInitialized = true;

        console.log('🚀 Initialisation du composant avec objectApiName:', this.objectApiName);

        const hasValidRecordId = this.recordId && typeof this.recordId === 'string' && this.recordId.trim().length > 0;

        if (this.objectApiName === 'Correctif__c' && hasValidRecordId) {
            this.nTicketId = this.recordId;
            this.loadInitialData();
        } else if (this.objectApiName === 'sitetracker__Job__c' && hasValidRecordId) {
            this.loadInitialData();
        } else if (this.ticketCorrectifID) {
            this.loadInitialData();
        } else if (hasValidRecordId) {
            // recordId présent mais pas Correctif ni Job → Commande existante
            this.loadOrderData();
        } else {
            this.loadInitialData();
        }
    }

    async loadInitialData() {
        this.loading = true;
        try {
            let params = { nTicketId: this.nTicketId, isMobile: !this.isDesktop };
            if (this.objectApiName === 'sitetracker__Job__c' && this.recordId) {
                params = { recordId: this.recordId, sObjectType: 'sitetracker__Job__c', isMobile: !this.isDesktop };
            } else if (this.objectApiName === 'Correctif__c' && this.recordId) {
                params = { nTicketId: this.recordId, sObjectType: 'Correctif__c', isMobile: !this.isDesktop };
            }

            console.log('🔍 loadInitialData PARAMS:', JSON.stringify(params));
            const data = await getInitialData(params);
            console.log('🔍 loadInitialData RESPONSE:', JSON.stringify(data));

            if (!this.demandeurId) {
                this.demandeurId = data.currentUserId;
                this.selectedDemandeur = { value: data.currentUserId, label: data.currentUserName };
            }

            if (data.nTicketCorrectifId) {
                this.nTicketId = data.nTicketCorrectifId;
                const label = data.nTicketName || '';
                const sublabel = data.nTicketSubLabel || '';
                // Reassign to trigger reactivity
                this.selectedNTicket = {
                    value: data.nTicketCorrectifId,
                    label: label,
                    sublabel: sublabel,
                    pillLabel: label, //sublabel ? `${label} - ${sublabel}` : label,
                    g2r: data.g2r,
                    siteName: data.siteName
                };
                this.g2r = data.g2r;
                this.siteName = data.siteName;
                this.ticketName = label;
            }

            // Pré-remplissage Compte Projet sur Mobile
            if (this.isMobile && data.userCompteProjet) {
                this.compteProjet = data.userCompteProjet;
                console.log('📱 Mobile: Compte Projet pré-rempli depuis User:', this.compteProjet);
            }

            if (data.lieuId && !this.lieuId) {
                this.lieuId = data.lieuId;
                this.selectedLieu = {
                    value: data.lieuId,
                    label: data.lieuName,
                    sublabel: data.lieuNomDuSite,
                    pillLabel: data.pillLabels
                };
            }
        } catch (error) {
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
                this.selectedNTicket = {
                    value: orderData.nTicketCorrectifId,
                    label: orderData.nTicketName,
                    sublabel: sublabel,
                    pillLabel: sublabel ? `${label} - ${sublabel}` : label
                };
                this.ticketPriority = orderData.ticketPriority;
                this.ticketStatus = orderData.ticketStatus;
                this.g2r = orderData.g2r;
                this.siteName = orderData.siteName;
                this.ticketName = orderData.nTicketName;
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
            this.createdByName = orderData.createdByName;
            this.status = orderData.status;
            this.pecCockpitDate = orderData.pecCockpitDate;
            this.pecCockpitBy = orderData.pecCockpitBy;
            this.pecRetraitementDate = orderData.pecRetraitementDate;
            this.pecRetraitementBy = orderData.pecRetraitementBy;
            this.typeReception = orderData.typeReception || 'Livraison';

            this.refreshAttachedFiles();

            const cartLines = orderData.lines
                .filter(line => {
                    if (this.isDesktop) return line.typeLigne === 'Cockpit';
                    else return line.typeLigne === 'Technicien';
                })
                .map(line => {
                    const siteSuffix = line.siteNomDuSite ? ` - ${line.siteNomDuSite}` : '';
                    const fullSiteName = line.siteName + siteSuffix;
                    const statusDef = STATUS_DEFINITIONS_BY_APIVALUE[line.statut];
                    const key = `${line.siteId}-${line.articleId}`;
                    return {
                        ...line,
                        key: key,
                        statutForDisplay: statusDef ? statusDef.displayValue : line.statut || '',
                        isAutre: line.articleName && line.articleName.toLowerCase() === 'autre',
                        mnemonique: line.mnemonique,
                        description: line.description,
                        siteName: fullSiteName
                    };
                });
            if (this.isDesktop) {
                this.hasExistingCockpitLines = cartLines.length > 0;
            }
            this.cart = cartLines;
            this.updateCartKeys();
        } catch (error) {
            this.toast('Erreur', 'Impossible de charger la commande : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }

    updateCartKeys() {
        this.cartItemKeys = new Set(this.cart.map(c => c.key));
    }

    async handleSaveOrder() {
        if (this.isDisabled) {
            this.toast('Attention', 'Veuillez renseigner une quantité valide (> 0) et un commentaire pour les articles "Autre".', 'warning');
            return;
        }

        const targetType = this.isDesktop ? 'Cockpit' : 'Technicien';
        const linesInput = this.cart.map(c => ({
            detailId: c.detailId,
            siteId: c.siteId,
            articleId: c.articleId,
            quantity: parseInt(c.quantity, 10),
            comment: c.comment,
            statut: c.statut,
            commentaireRefus: c.commentaireRefus,
            typeLigne: targetType
        }));

        this.loading = true;
        try {
            if (this.isEditMode) {
                const typeLigneContext = this.isDesktop ? 'Cockpit' : 'Technicien';
                const input = {
                    orderId: this.recordId,
                    nTicketCorrectifId: this.nTicketId,
                    globalComment: this.globalComment,
                    lines: linesInput,
                    demandeurId: this.demandeurId,
                    lieuId: this.lieuId,
                    compteProjet: this.compteProjet,
                    adresseLivraisonId: this.adresseLivraisonId,
                    typeLigneContext: typeLigneContext
                };
                const newIdsMap = await updateOrder({ inputJSON: JSON.stringify(input) });

                this.cart = this.cart.map(item => {
                    if (newIdsMap && newIdsMap[item.key]) {
                        return { ...item, detailId: newIdsMap[item.key] };
                    }
                    return item;
                });

                this.toast('Succès', 'Commande mise à jour.', 'success');
                
                // Rafraîchir le composant après délai pour s'assurer que le backend est à jour
                setTimeout(() => {
                    getRecordNotifyChange([{ recordId: this.recordId }]);
                    this.dispatchEvent(new RefreshEvent());
                    this.loadOrderData();
                }, 500);
            } else {
                const input = {
                    nTicketCorrectifId: this.nTicketId,
                    globalComment: this.globalComment,
                    lines: linesInput,
                    demandeurId: this.demandeurId,
                    lieuId: this.lieuId,
                    compteProjet: this.compteProjet,
                    adresseLivraisonId: this.adresseLivraisonId
                };
                const newOrderId = await createOrder({ inputJSON: JSON.stringify(input) });

                // Assigner recordId pour permettre les opérations suivantes
                this.recordId = newOrderId;

                if (this.filesToUpload.length > 0) {
                    const filesData = this.filesToUpload.map(f => ({ title: f.name, base64Data: f.base64 }));
                    await uploadFiles({ recordId: newOrderId, files: filesData });
                    
                    // Rafraîchir la liste des fichiers après upload
                    // await this.refreshAttachedFiles();
                }

                this.toast('Succès', 'Commande créée avec succès.', 'success');
                getRecordNotifyChange([{ recordId: newOrderId }]);
                this.isSaveComplete = true;
                
                // Mobile: retour arrière vers page précédente
                setTimeout(() => {
                    if (!this.isDesktop) {
                        window.history.back();
                        this.handleCancel(); //this.dispatchEvent(new FlowNavigationNextEvent());
                    } else if (this.isDesktop && !this.isEditMode){
                        window.location.assign('/lightning/r/Commande_Pi_ces__c/' + newOrderId + '/view');
                    }
                }, 1000);
            }
        } catch (e) {
            this.toast('Erreur', e?.body?.message || 'Erreur lors de la sauvegarde.', 'error');
        } finally {
            this.loading = false;
        }
    }

    async handlePecAction(event) {
        const actionName = event.target.name;
        const newStatus = actionName === 'pec_cockpit' ? 'PEC Cockpit' : 'PEC Retraitement';
        
        this.loading = true;
        try {
            await updatePec({ 
                orderId: this.recordId, 
                status: newStatus 
            });
            
            this.toast('Succès', `Statut mis à jour vers ${newStatus}.`, 'success');
            
            // Rafraîchir le composant après délai pour s'assurer que le backend est à jour
            setTimeout(() => {
                getRecordNotifyChange([{ recordId: this.recordId }]);
                // Rafraîchement global des listes
                this.dispatchEvent(new RefreshEvent());
                this.loadOrderData();
            }, 500);

        } catch (error) {
            this.toast('Erreur', 'Impossible de mettre à jour le statut : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }

    handleLookupSelect(event) {
        const selectedValue = event.detail;
        const lookupType = event.target.dataset.lookup;

        switch (lookupType) {
            case 'ticket':
                this.nTicketId = selectedValue.value;
                this.selectedNTicket = selectedValue;
                this.ticketName = selectedValue.label;
                // Auto-populate extra fields from ticket
                if (selectedValue.g2r) this.g2r = selectedValue.g2r;
                if (selectedValue.siteName) this.siteName = selectedValue.siteName;
                break;
            case 'demandeur':
                this.demandeurId = selectedValue.value;
                this.selectedDemandeur = selectedValue;
                break;
            case 'lieu':
                this.lieuId = selectedValue.value;
                this.selectedLieu = selectedValue;
                break;
            case 'adresseLivraison':
                this.adresseLivraisonId = selectedValue.value;
                this.selectedAdresseLivraison = selectedValue;
                // Auto-populate contact address if available
                if (selectedValue.address) {
                    this.contactAddress = selectedValue.address;
                } else if (selectedValue.sublabel) {
                    this.contactAddress = selectedValue.sublabel;
                }
                break;
        }
    }

    handleLookupRemove(event) {
        const lookupType = event.target.dataset.lookup;

        switch (lookupType) {
            case 'ticket':
                this.nTicketId = null;
                this.selectedNTicket = null;
                break;
            case 'demandeur':
                this.demandeurId = null;
                this.selectedDemandeur = null;
                break;
            case 'lieu':
                this.lieuId = null;
                this.selectedLieu = null;
                break;
            case 'adresseLivraison':
                this.adresseLivraisonId = null;
                this.selectedAdresseLivraison = null;
                break;
        }
    }

    handleCompteProjetChange(event) {
        if (event.target.value.trim()) {
            this.compteProjet = event.target.value.trim();
        }
    }

    handleGlobalCommentChange(event) {
        this.globalComment = event.target.value;
    }

    handleTypeReceptionChange(event) {
        this.typeReception = event.detail.value;
        if (this.typeReception === 'Remise en main propre') {
            this.contactAddress = '';
        } else if (this.selectedAdresseLivraison && this.selectedAdresseLivraison.sublabel) {
            this.contactAddress = this.selectedAdresseLivraison.sublabel;
        }
    }

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
                        previewUrl: URL.createObjectURL(file),
                        key: Date.now() + i
                    });
                };
                reader.readAsDataURL(file);
            }
        }
    }

    handleRemoveFileToUpload(event) {
        const index = event.target.dataset.index;
        this.filesToUpload.splice(index, 1);
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

            getRecordNotifyChange([{ recordId: this.recordId }]);
        } catch (error) {
            this.toast('Erreur', 'Impossible de mettre à jour la PEC : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }

    handleUploadFinished(event) {
        this.toast('Succès', 'Fichiers téléchargés avec succès.', 'success');

        const uploadedFiles = event.detail.files;
        console.log('📸 handleUploadFinished files:', JSON.stringify(uploadedFiles));
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            const newFiles = uploadedFiles.map(file => {
                console.log('📸 File Debug:', file.name, file.documentId);
                return {
                    id: file.documentId,
                    title: file.name,
                    previewUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`
                };
            });
            this.attachedFiles = [...this.attachedFiles, ...newFiles];
            console.log('📸 Attached Files Updated:', JSON.stringify(this.attachedFiles));
        }
    }

    async refreshAttachedFiles() {
        if (this.recordId) {
            try {
                const files = await getAttachedFiles({ recordId: this.recordId });
                this.attachedFiles = files.map(file => {
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
                // Afficher l'erreur pour déboguer
                this.toast('Erreur', 'Impossible de charger les fichiers: ' + (e.body?.message || e.message), 'error');
                console.error('refreshAttachedFiles error:', e);
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
            this.attachedFiles = this.attachedFiles.filter(file => file.id !== fileId);
        } catch (error) {
            this.toast('Erreur', 'Impossible de supprimer la photo : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }

    handleArticleSearchInput(e) {
        this.articleSearchTerm = (e.target.value || '').trim();
        window.clearTimeout(this.delayTimeout);
        this.delayTimeout = setTimeout(() => this.refresh(true), 300);
    }

    async refresh(reset = true) {
        if (this.articleSearchTerm.length < 3) {
            this.rows = [];
            return;
        }
        if (reset) {
            this.rows = [];
        }
        this.loading = true;
        try {
            // Limiter à 10 résultats
            const articlesFound = await searchArticles({ 
                term: this.articleSearchTerm, 
                limitSize: 10,
                includePieces: this.isDesktop
            });
            const articleIds = articlesFound.map(art => art.value);

            if (articleIds.length > 0) {
                // Appel unifié pour Desktop et Mobile
                let res = await getInventoryAggregatesMulti({ 
                    articleIds: articleIds, 
                    limitSize: 10, 
                    offsetVal: 0, 
                    groupBySite: this.isDesktop 
                });

                if (this.isDesktop) {
                    res = res.map(row => {
                        const suffix = row.siteNomDuSite ? ` - ${row.siteNomDuSite}` : '';
                        return {
                            ...row,
                            siteName: row.siteName + suffix
                        };
                    });
                }
                
                this.rows = [...res];
            } else {
                this.rows = [];
            }
        } catch (e) {
            this.toast('Erreur', 'Chargement impossible: ' + (e.body?.message || e.message), 'error');
        } finally {
            this.loading = false;
        }
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
            statutForDisplay: '🟢 Disponible',
            isAutre: row.articleName && row.articleName.toLowerCase() === 'autre',
            typeLigne: this.isDesktop ? 'Cockpit' : 'Technicien',
            stock: row.stock
        };
        this.cart = [...this.cart, newItem];
        this.updateCartKeys();
        this.toast('Succès', `${row.articleName} ajouté.`, 'success');
        if (this.isDesktop) {
            this.hasExistingCockpitLines = this.cart.length > 0;
        }
        
        // Refresh search results to show items that were previously filtered out
        if (this.articleSearchTerm.length >= 3) {
            this.refresh(false);
        }
    }

    async handleCancel() {

        // Rediriger vers la List View
        setTimeout(() => {
            this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: 'Commandes_Pieces__c', // Remplacez par votre API Name
                    actionName: 'list'
                },
                state: {
                    filterName: 'All' // Ou l'API name de votre vue : 'All', '00B...'
                }
            });
        }, 300);
        // 1. Try closing Quick Action Screen
        const closeEvent = new CloseActionScreenEvent();
        this.dispatchEvent(closeEvent);

        // 2. Try finishing Flow
        const navigateFinishEvent = new FlowNavigationFinishEvent();
        this.dispatchEvent(navigateFinishEvent);

        // 3. Fallback: Navigate to Record Page if possible (closes modal)
        const { tabId } = await workspaceApi.getFocusedTabInfo();
        await workspaceApi.closeTab({ tabId: tabId });

        // 4. Dispatch close event
        this.dispatchEvent(new CustomEvent('close', {
            bubbles: true,
            composed: true
        }));
    }

    updateCartKeys() {
        this.cartItemKeys = new Set(this.cart.map(item => item.key));
    }

    handleCartRemove(event) {
        const key = event.target.dataset.key || event.currentTarget.dataset.key;
        this.cart = this.cart.filter(c => c.key !== key);
        this.updateCartKeys();
        if (this.isDesktop) {
            this.hasExistingCockpitLines = this.cart.length > 0;
        }
        this.toast('Succès', 'Article retiré du panier.', 'success');
    }


    handleCartCommentChange(event) {
        const key = event.target.dataset.key;
        const value = event.target.value;
        this.cart = this.cart.map(item =>
            item.key === key ? { ...item, comment: value } : item
        );
    }

    handleMobileQuantityChange(event) {
        const key = event.target.dataset.key;
        let value = event.target.value;
        
        // Validation: convertir en nombre, si invalide ou <= 0, mettre à 1
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue <= 0) {
            value = '1';
            event.target.value = '1';
        }
        
        this.cart = this.cart.map(item =>
            item.key === key ? { ...item, quantity: value } : item
        );
    }

    handleMobileCommentChange(event) {
        const key = event.target.dataset.key;
        const value = event.target.value;
        this.cart = this.cart.map(item =>
            item.key === key ? { ...item, comment: value } : item
        );
    }

    handleCartItemChange(event) {
        const { id, field, value } = event.detail;
        this.cart = this.cart.map(item =>
            item.key === id ? { ...item, [field]: value } : item
        );
    }



    handleCartItemStatusChange(event) {
        const { id, newStatus } = event.detail;
        const statusDef = STATUS_DEFINITIONS_BY_KEY[newStatus];
        if (statusDef) {
            this.cart = this.cart.map(item => {
                if (item.key === id) {
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

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
