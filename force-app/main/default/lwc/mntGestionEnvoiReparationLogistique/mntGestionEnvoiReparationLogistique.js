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
import getPiecesByIds from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getPiecesByIds';
import getInitialRepairPieces from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getInitialRepairPieces';
import LightningConfirm from 'lightning/confirm';
import LightningAlert from 'lightning/alert';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import TrackingModal from 'c/trackingModal';
import { getRecord, getFieldValue, getRecordNotifyChange } from 'lightning/uiRecordApi';
import FORM_FACTOR from '@salesforce/client/formFactor';
import USER_ID from '@salesforce/user/Id';
import USER_NAME_FIELD from '@salesforce/schema/User.Name';
import getContactAddressBySiteName from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getContactAddressBySiteName'; // Keep for existing logic if any
import getContactBySiteName from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getContactBySiteName'; // NEW
import getAvailableRepairPieces from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.getAvailableRepairPieces'; // NEW

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

export default class MntGestionEnvoiReparationLogistique extends NavigationMixin(LightningElement) {
    @track linkedCommandeId;

    get formattedDateEnvoi() {
        if (!this.dateEnvoi) return '';
        try {
            return new Intl.DateTimeFormat('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short'
            }).format(new Date(this.dateEnvoi));
        } catch (e) {
            return this.dateEnvoi;
        }
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
    @api ticketCorrectifID;
    @api inputPieceIds; // NOUVEAU: IDs en entrée depuis le Flow
    @api outputPieceIds = [];
    @api isSaveComplete = false;

    @track isLoading = true; @track isSearching = false; @track cardTitle = 'Traiter la Commande'; @track saveButtonLabel = 'Traiter la Commande';
    @track nTicketCorrectifId; @track selectedNTicket = null; @track statutEnvoi = 'Livraison en Cours'; @track dateCreationEnvoi; @track typeEnvoi = 'Autre Stock'; @track envoiName = '';
    @track destinataireId; @track selectedDestinataire = null; @track stockId; @track selectedStock = null; @track commentaire = ''; @track createdBy = '';
    @track demandeurId; @track selectedDemandeur = null;
    @track lookupSuggestions = { ticket: [], destinataire: [], stock: [], user: [] }; @track lookupLoading = { ticket: false, destinataire: false, stock: false, user: false }; @track isLookupOpen = { ticket: false, destinataire: false, stock: false, user: false };
    @track searchResults = []; @track allAvailablePieces = []; @track cart = []; @track piecesMap = new Map(); @track draftValues = []; @track commandeDetails = []; @track initialContextIsCommande = false; delayTimeout;
    @track isContextCommande = false; @track envoiDataFromServer = null;
    @track g2r = ''; @track siteName = ''; @track compteProjet = ''; @track typeReception = 'Livraison'; @track dateEnvoi; @track contactAddress = '';@track typeTransporteur = 'CHRONOPOST';
    @track lieuId; // Origin Site ID tracked

    commandeDetailsCols = COMMANDE_DETAILS_COLS; cartCols = CART_COLS;

    get isDestinationLocked() { return this.isContextCommande || (this.envoiDataFromServer && this.envoiDataFromServer.isLinkedToCommande); }
    get cartData() {
        if (!this.cart) return [];
        return this.cart.map(item => {
            const hasTrackingNumber = !!item.numBonLivraison;
            return {
                ...item,
                isTrackingDisabled: !hasTrackingNumber,
                trackingButtonClass: hasTrackingNumber ? '' : 'slds-hidden',
                trackingUrl: hasTrackingNumber 
                    ? `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${item.numBonLivraison}` 
                    : null
            };
        });
    }
    get envoiTitle() { if (this.envoiName) { return `Informations sur l'envoi : ${this.envoiName}`; } return "Informations sur l'envoi"; }
    get isFromCommande() { return this.linkedCommandeId ? true : false; }
    get typeOptions() { return [{ label: 'Vers Réparateur', value: 'Réparateur' }, { label: 'Vers Autre Stock', value: 'Autre Stock' }]; }
    get typeReceptionOptions() { return [{ label: 'Livraison', value: 'Livraison' }, { label: 'Remise en main propre', value: 'Remise en main propre' }]; }
    get typeTransporteurOptions() { return [{ label: 'CHRONOPOST', value: 'CHRONOPOST' }, { label: 'DHL', value: 'DHL' }, { label: 'TNT', value: 'TNT' }, { label: 'COLISSIMO', value: 'COLISSIMO' }, { label: 'UPS', value: 'UPS' }, { label: 'Palette', value: 'Palette' }]; }
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
    get userComboboxClass() { return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isLookupOpen.user ? 'slds-is-open' : ''}`; }

    get isReadOnly() {
        return this.statutEnvoi === 'Clôturer NOK' || this.statutEnvoi === 'Clôturer OK';
    }

    get isChronopost() {
        return this.typeTransporteur === 'CHRONOPOST';
    }


    get hasCommandeDetails() {
        return this.commandeDetails && this.commandeDetails.length > 0;
    }

    get validateButtonLabel() {
        return this.dateEnvoi ? 'Enregistrer les modifications' : 'Valider la Commande';
    }

    get validateButtonVariant() {
        return this.dateEnvoi ? 'brand' : 'success';
    }


    connectedCallback() {
        // Mode Spécial : Input Piece Ids (depuis Flow) ou Chargement par défaut (Repair)
        if (this.inputPieceIds && (Array.isArray(this.inputPieceIds) ? this.inputPieceIds.length > 0 : this.inputPieceIds)) {
            this.handleInputPiecesContext();
        } 
        else if (!this._recordId && this._objectApiName !== 'Envoi_Logistique__c' && this._objectApiName !== 'Commande_Pi_ces__c') {
            // Si pas d'input mais qu'on est en création sans contexte spécifique, on charge le stock
            console.log('No input IDs, loading initial repair pieces');
            this.handleInitialRepairContext();
        }
        else if (this._objectApiName === 'Commande_Pi_ces__c') {
            this.linkedCommandeId = this._recordId; // Fix: Set linkedCommandeId to the current recordId
            this.initialContextIsCommande = true;
            // this.isDestinationLocked = true;
            this.isContextCommande = true;
            this.handleCommandeContext();
        } else if (this._objectApiName === 'Envoi_Logistique__c') {
            this.loadEnvoiData(this._recordId);
        } else if (this._objectApiName === 'Correctif__c') {
            this.ticketCorrectifID = this._recordId;
            this.handleTicketContext();
        } else if (this._objectApiName === 'sitetracker__Job__c') {
            // Handle Job context: fetch ticket from Job
            this.handleTicketContext();
        } else if (this.ticketCorrectifID) {
            // Auto-populate from Ticket ID input
            this.handleTicketContext();
        } else {
            this.isLoading = false;
        }
    }

    
    async handleInitialRepairContext() {
        this.isLoading = true;
        this.cardTitle = "Envoi en Réparation";
        this.saveButtonLabel = "Envoyer en Réparation";
        this.typeReception = 'Livraison'; 
        
        try {
            const pieces = await getInitialRepairPieces();
            await this.processLoadedPieces(pieces);
        } catch (error) {
            console.error(error);
            this.showToast('Erreur', 'Erreur lors du chargement initial : ' + error.body?.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleInputPiecesContext() {
        this.isLoading = true;
        this.cardTitle = "Envoi en Réparation";
        this.saveButtonLabel = "Valider l'Envoi";
        this.typeReception = 'Livraison';
        
        try {
            // Parsing safe si c'est une string délimitée
            let idsToLoad = this.inputPieceIds;
            if (typeof idsToLoad === 'string') {
                idsToLoad = idsToLoad.split(/[ ,;]+/).filter(id => id.length >= 15);
            }

            const pieces = await getPiecesByIds({ pieceIds: idsToLoad });
            await this.processLoadedPieces(pieces);

        } catch (error) {
            console.error(error);
            this.showToast('Erreur', 'Erreur lors du chargement des pièces : ' + error.body?.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async processLoadedPieces(pieces) {
        if (!pieces || pieces.length === 0) {
            this.showToast('Info', 'Aucune pièce à traiter trouvée.', 'info');
            return;
        }

        // Validation Réparateur Unique
        const firstReparateurId = pieces[0].reparateurId;
        const firstReparateurName = pieces[0].reparateurName;
        // Recuperation du Lieu (Site) pour redirection et filtrage
        const firstLieuId = pieces[0].lieuId; 
        
        // SWAP: stockId = Origin Site, lieuId = Destination (Repairer)
        this.stockId = firstLieuId; // Origin Site
        this.lieuId = firstReparateurId; // Destination (Repairer)
        
        // On vérifie si toutes les pièces ont le MEME réparateur
        const allSameRepairer = pieces.every(p => p.reparateurId === firstReparateurId);

        if (!allSameRepairer) {
            await LightningAlert.open({
                message: "Vous ne pouvez pas sélectionner des pièces qui ont des réparateurs différents, merci de vérifier votre sélection.",
                theme: 'error',
                label: 'Erreur de sélection',
            });
            window.location.assign('/lightning/r/sitetracker__Site__c/' + firstLieuId + '/view');
            return;
        }

        // Chargement du Panier
        this.cart = pieces.map(item => ({
            pieceUnitaireId: item.id,
            name: item.name,
            cleEquipement: item.cleEquipement,
            rma: item.rma, 
            sousLieu: item.sousLieu,
            mnemonique: item.mnemonique,
            nSerie: item.nSerie,
            description: item.description, // Added for preservation
            numBonLivraison: '',
            statutChronopost: 'En préparation chez l\'expéditeur'
        }));

        // --- AUTO-LOAD OTHER PIECES ---
        try {
            // New: Pass also stockId (Origin) to filter available pieces by same Location
            this.allAvailablePieces = await getAvailableRepairPieces({ reparateurId: firstReparateurId, lieuId: firstLieuId });
            
            // Filter out items already in cart
            const cartIds = new Set(this.cart.map(c => c.pieceUnitaireId));
            this.searchResults = this.allAvailablePieces.filter(p => !cartIds.has(p.id));
        } catch (e) {
             console.error('Error fetching available pieces', e);
        }

        // Préchargement Destination (Lieu de destination = Reparateur)
        if (firstReparateurId) {
            this.selectedStock = { 
                value: firstReparateurId, 
                label: firstReparateurName, 
                pillLabel: firstReparateurName 
            };
            this.typeEnvoi = 'Réparateur';
            
            // --- NOUVEAU: Pré-remplissage du Contact (Adresse de Livraison) ---
            try {
                const contact = await getContactBySiteName({ siteName: firstReparateurName });
                if (contact) {
                    this.destinataireId = contact.Id;
                    this.selectedDestinataire = { value: contact.Id, label: contact.Name };
                    
                    const addressParts = [];
                    if (contact.MailingStreet) addressParts.push(contact.MailingStreet);
                    if (contact.MailingPostalCode) addressParts.push(`${contact.MailingPostalCode} ${contact.MailingCity || ''}`);
                    
                    this.contactAddress = addressParts.join('\n');
                }
            } catch (err) {
                 console.warn('Could not auto-fetch contact for repairer:', err);
            }
            // -------------------------------------------------------------
        } else {
             this.showToast('Attention', 'Aucun réparateur n\'est associé à la première pièce.', 'warning');
        }
    }



    handleRemoveFromCart(event) {
        const pieceId = event.target.dataset.id;
        this.cart = this.cart.filter(item => item.pieceUnitaireId !== pieceId);
        
        // Always restore from allAvailablePieces after removal
        if (this.allAvailablePieces && this.allAvailablePieces.length > 0) {
            const cartIds = new Set(this.cart.map(c => c.pieceUnitaireId));
            this.searchResults = this.allAvailablePieces.filter(p => !cartIds.has(p.id));
        }
        
        // Fallback: Re-trigger search if active
        const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
        if (searchInput && searchInput.value && searchInput.value.length >= 3) {
            this.performSearch(searchInput.value);
        }
    }
    
    async handleCommandeContext() {
        this.isLoading = true;
        try {
            // En création depuis une commande, on ne filtre pas par envoi (envoiId = null)
            const allDetails = await getCommandeDetails({ commandeId: this.linkedCommandeId, envoiId: null });
            this.commandeDetails = allDetails.filter(d => d.typeLigne === 'Cockpit');
            // const envoiId = await getEnvoiByCommandeId({ commandeId: this.linkedCommandeId });
            
            // LOGIQUE MOBILE: Forcer 'Autre Stock'
            if (!this.isDesktop) {
                 this.typeEnvoi = 'Autre Stock';
            } else {
                 this.typeEnvoi = this.linkedCommandeId ? 'Autre Stock' : 'Réparateur';
            }

            if (this._objectApiName == 'Envoi_Logistique__c') {
                await this.loadEnvoiData(this._recordId);
            } else {
                this.cardTitle = 'Créer la commande'; this.saveButtonLabel = 'Créer la Commande';
                if (!this.isDesktop) {
                     this.typeEnvoi = 'Autre Stock';
                     this.demandeurCommande = this.currentUserName; // Pré-remplissage mobile
                } else {
                     this.typeEnvoi = 'Autre Stock';
                     this.demandeurCommande = this.currentUserName; // Pré-remplissage desktop
                }
                
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
                // DIRECT MAPPING: lieuId (Apex) -> this.lieuId (Destination)
                if(initialData.lieuId) {
                    this.lieuId = initialData.lieuId;
                    console.log('Setting lieuId (Destination) to:', this.lieuId);
                    const label = initialData.lieuName || '';
                    const sublabel = initialData.lieuSubLabel || '';
                    this.selectedStock = { value: initialData.lieuId, label: label, sublabel: sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label };
                } else {
                    console.warn('No lieuId found in initialData');
                }
                // stockId (Apex) -> this.stockId (Origin)
                if(initialData.stockId) {
                    this.stockId = initialData.stockId;
                    console.log('Setting stockId (Origin) to:', this.stockId);
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
    
    @wire(getRecord, { recordId: USER_ID, fields: [USER_NAME_FIELD] })
    wiredUser({ error, data }) {
        if (data) {
            this.currentUserName = getFieldValue(data, USER_NAME_FIELD);
            // Si pas d'enregistrement (création) et champ vide, on préremplit
            if (!this._recordId && !this.demandeurCommande) {
                this.demandeurCommande = this.currentUserName;
                this.demandeurId = USER_ID;
                this.selectedDemandeur = { value: USER_ID, label: this.currentUserName };
            }
        }
    }
    
    currentUserName;
    @track isReadOnly = false; // Nouvelle propriété pour le mode lecture seule


    async loadEnvoiData(envoiIdToLoad) {
        this.isLoading = true; this.cardTitle = "Traiter la Commande"; this.saveButtonLabel = "Enregistrer les modifications";
        try {
            const envoiData = await getEnvoiDetails({ envoiId: envoiIdToLoad });
            // this.isDestinationLocked = envoiData.isLinkedToCommande; // REMOVED: Managed by getter now
            this.envoiName = envoiData.envoiName || ''; this.createdBy = envoiData.createdByName;
            this.demandeurCommande = envoiData.demandeurCommande; 
            this.demandeurId = envoiData.demandeurId;
            if (this.demandeurId) {
                this.selectedDemandeur = { value: this.demandeurId, label: this.demandeurCommande };
            }
            
            this.nTicketCorrectifId = envoiData.nTicketCorrectifId; 
            if (this.nTicketCorrectifId) {
                const label = envoiData.nTicketName || ''; 
                const sublabel = envoiData.nTicketSubLabel || ''; 
                this.selectedNTicket = { value: envoiData.nTicketCorrectifId, label: label, sublabel: sublabel, pillLabel: label }; // sublabel ? `${label} - ${sublabel}` : label }; 
                this.g2r = envoiData.g2r || '';
                this.siteName = envoiData.siteName || '';
            }
            this.statutEnvoi = envoiData.statutDeLEnvoi; this.dateCreationEnvoi = envoiData.dateCreation; this.typeEnvoi = envoiData.typeEnvoi;
            
            // LOGIQUE READ-ONLY ROBUSTE : Normalisation pour éviter les soucis d'accents (ô, é)
            // "Clôturé OK" -> "cloture ok"
            const rawStatus = this.statutEnvoi || '';
            const normalizedStatus = rawStatus.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            
            // On cherche "clotur" (pour couvrir cloture, cloturer, clôturé) combiné à "ok" ou "nok"
            // Ou simplement si le statut normalisé correspond aux cibles
            const isClosed = normalizedStatus.includes('clotur') && (normalizedStatus.includes('ok') || normalizedStatus.includes('nok'));
            
            this.isReadOnly = isClosed;
            
            console.log('--- READ ONLY DEBUG V2 ---');
            console.log('Statut Envoi (raw):', rawStatus);
            console.log('Statut Envoi (norm):', normalizedStatus);
            console.log('Is Read Only:', this.isReadOnly);
            
            this.typeTransporteur = envoiData.transporteur || 'CHRONOPOST';
            this.typeReception = envoiData.typeReception || 'Livraison';
            this.dateEnvoi = envoiData.dateEnvoi;
            this.compteProjet = envoiData.compteProjet || '';

            this.destinataireId = envoiData.destinataireId; if (this.destinataireId) this.selectedDestinataire = { value: envoiData.destinataireId, label: envoiData.destinataireName };
            this.contactAddress = envoiData.destinataireAddress || '';
            
            // DIRECT MAPPING (NO INVERSION)
            // stockId (LWC) = stockId (Apex) = Stock__c = Origin Site
            this.stockId = envoiData.stockId; 
            
            // lieuId (LWC) = lieuId (Apex) = Lieu_de_Destination__c = Destination (Repairer)
            this.lieuId = envoiData.lieuId; 
            if (this.lieuId) {
                const label = envoiData.lieuName || ''; 
                const sublabel = envoiData.lieuSubLabel || ''; 
                this.selectedStock = { value: envoiData.lieuId, label: label, sublabel: sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label }; 
            } 

            this.commentaire = envoiData.commentaire; this.envoiDataFromServer = envoiData;
            this.cart = envoiData.lines.map(line => ({ ...line, pieceUnitaireId: line.pieceUnitaireId, key: line.pieceUnitaireId }));

            // --- AUTO-LOAD COMMANDE DETAILS ---
            // --- COMMANDE DETAILS (IGNORED IN REPAIR CONTEXT) ---
            if (envoiData.commandeId) {
                // Warning only - Repair logic does not need full command details
                console.warn('Envoi is linked to a Commande, but Repair component does not load full command details.');
            }
            // ----------------------------------
            // ----------------------------------

        } catch (error) { this.showToast('Erreur de chargement', this.reduceErrors(error)[0], 'error'); } 
        finally { this.isLoading = false; }
    }
    
    handleAddressChange(event) {
         this.contactAddress = event.target.value;
    }

    handleTypeChange(event) { 
        // if (this.isDestinationLocked) return;
        this.typeEnvoi = event.detail.value; 
        // this.destinataireId = null; 
        // this.selectedDestinataire = null; 
        // this.stockId = null; 
        // this.selectedStock = null;

        // On ré-exécute la recherche si un terme de recherche est déjà saisi
        const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
        if (searchInput && searchInput.value && searchInput.value.length >= 3) {
            this.performSearch(searchInput.value);
        } else {
            // Sinon, on vide simplement les résultats
            this.searchResults = [];
        }
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
    handleTypeReceptionChange(event) { this.typeReception = event.detail.value; }
    handleTypeTransporteurChange(event) { this.typeTransporteur = event.detail.value; }
    // handleDateChange(event) { this.dateEnvoi = event.target.value; }
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
        const sObjectTypeMap = {
            ticket: 'Correctif__c',
            destinataire: 'Contact',
            stock: 'sitetracker__Site__c',
            user: 'User'
        };
        try {
            this.lookupSuggestions[lookupType] = await searchRecords({
                searchTerm: searchTerm,
                sObjectType: sObjectTypeMap[lookupType]
            });
        } catch (error) {
            console.error('Search error:', error);
            this.showToast('Erreur', 'Recherche impossible: ' + (error.body ? error.body.message : error.message), 'error');
        } finally {
            this.lookupLoading[lookupType] = false;
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
            
            if(initialData.nTicketCorrectifId) {
                this.nTicketCorrectifId = initialData.nTicketCorrectifId;
                const label = initialData.nTicketName || '';
                const sublabel = initialData.nTicketSubLabel || '';
                this.selectedNTicket = { value: initialData.nTicketCorrectifId, label: label , sublabel: sublabel, pillLabel: label }; 
                this.g2r = initialData.g2r || '';
                this.siteName = initialData.siteName || '';
            }
        } catch (error) {
            console.error('Erreur chargement contexte ticket', error);
            this.showToast('Erreur', 'Impossible de charger les données du ticket', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    handleLookupSelect(event) { 
        const { value, label, sublabel, pillLabel, lookup, address, g2r, sitename, compteprojet } = event.currentTarget.dataset; 
        switch (lookup) { 
            case 'ticket': 
                this.nTicketCorrectifId = value; 
                this.selectedNTicket = { value, label, sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label }; 
                this.g2r = g2r || '';
                this.siteName = sitename || '';
                if (compteprojet) {
                    this.compteProjet = compteprojet;
                }
                break; 
            case 'destinataire': 
                this.destinataireId = value; 
                this.selectedDestinataire = { value, label }; 
                if (address) this.contactAddress = address;
                break; 
            case 'stock': 
                this.stockId = value; 
                this.selectedStock = { value, label, sublabel, pillLabel: sublabel ? `${label} - ${sublabel}` : label }; 
                
                // Fetch Address from Contact matching Site Name
                if (label) {
                    getContactAddressBySiteName({ siteName: label })
                        .then(addr => {
                            if (addr) this.contactAddress = addr;
                        })
                        .catch(err => console.error('Error fetching address', err));
                }
                break; 
            case 'user':
                this.demandeurId = value;
                this.selectedDemandeur = { value, label };
                break;
        } 
        this.lookupSuggestions[lookup] = []; 
        const input = this.template.querySelector(`lightning-input[data-lookup="${lookup}"]`); 
        if (input) input.value = ''; 
        this.isLookupOpen[lookup] = false; 
    }
    handleLookupPillRemove(event) { 
        if (this.isReadOnly) return; // Bloquer la suppression en mode lecture seule
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
                // this.contactAddress = ''; // Keep editable
                break; 
            case 'user':
                this.demandeurId = null;
                this.selectedDemandeur = null;
                break; 
        } 
    }
    handleLookupFocus(event) { this.isLookupOpen[event.target.dataset.lookup] = true; }
    handleLookupBlur(event) { const inputElement = event.target; const lookupType = inputElement.dataset.lookup; setTimeout(() => { let selectedId; switch (lookupType) { case 'ticket': selectedId = this.nTicketCorrectifId; break; case 'destinataire': selectedId = this.destinataireId; break; case 'stock': selectedId = this.stockId; break; case 'user': selectedId = this.demandeurId; break; } if (inputElement.value && !selectedId) { this.showToast('Erreur', `"${inputElement.value}" n'est pas une valeur valide.`, 'error'); inputElement.value = ''; } this.isLookupOpen[lookupType] = false; }, 250); }
    handleSearch(event) { 
        const searchTerm = event.target.value; 
        clearTimeout(this.delayTimeout); 
        this.delayTimeout = setTimeout(() => { 
            this.performSearch(searchTerm);
        }, 300); 
    }
    get isBlReadOnly() {
        return this.isReadOnly || this.typeReception !== 'Livraison'; // Devrait toujours être Livraison ici
    }

    get isSaveDisabled() {
        return this.isLoading || this.isReadOnly;
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
                rma: piece.rma,
                nSerie: piece.nSerie,
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
            
            // Restore piece to search results if it exists in allAvailablePieces
            if (this.allAvailablePieces) {
                 const cartIds = new Set(this.cart.map(c => c.pieceUnitaireId));
                 this.searchResults = this.allAvailablePieces.filter(p => !cartIds.has(p.id));
            } else {
                 // Fallback if allAvailablePieces is not set (e.g. not loaded yet or cleared)
                 const searchInput = this.template.querySelector('lightning-input[data-search-input="true"]');
                 if (searchInput && searchInput.value && searchInput.value.length >= 3) {
                     this.performSearch(searchInput.value);
                 }
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



    handleTrackItem(event) {
        const url = event.target.dataset.url;
        if (url) {
            this.openTrackingModal(url);
        }
    }

    handleChronopostAction(event) {
        const pieceId = event.target.dataset.id;
        const action = event.target.dataset.action;
        if (pieceId && action) {
            this.updateCartItemStatus(pieceId, action);
        }
    }



    updateCartItemStatus(pieceId, newStatus) {
        // 1. Optimistic UI Update
        this.cart = this.cart.map(item => {
            if (item.pieceUnitaireId === pieceId) {
                return { ...item, statutChronopost: newStatus };
            }
            return item;
        });
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
    
    async handleSave(event) {
        console.log('handleSave called');
        
        // Capture event data immediately before any async operation
        const actionGlobale = event.target.dataset.globalAction || null;
        
        // Validation : Le BL est obligatoire pour chaque ligne du panier
        // Appeler reportValidity() sur tous les champs pour afficher l'erreur native Lightning
        const blInputs = this.template.querySelectorAll('lightning-input[data-field="numBonLivraison"]');
        let allValid = true;
        blInputs.forEach(input => {
            // MANUALLY SET VALIDITY because 'required' attribute was removed for UI reasons           
            if (!input.reportValidity()) {
                allValid = false;
            }
        });
        
        const missingBl = this.cart.some(item => !item.numBonLivraison || item.numBonLivraison.trim() === '');
        if (!allValid || missingBl) {
            this.showToast('Erreur', 'Le N° de Bon de Livraison est obligatoire pour toutes les pièces.', 'error');
            return;
        } 
        
        console.log('Validation passed, proceeding to confirmation');
        
        // Confirmation Popup pour la création
        const isCreationContext = !this._recordId || this._objectApiName !== 'Envoi_Logistique__c';
        if (isCreationContext) {
            console.log('Opening confirmation dialog...');
            const confirmed = await LightningConfirm.open({
                message: 'Confirmez-vous la création de cet envoi ?',
                variant: 'header',
                label: 'Confirmation',
                theme: 'warning',
            });
            console.log('Confirmation result:', confirmed);
            if (!confirmed) {
                return; 
            }
        }

        this.isLoading = true;
        // Préparation des lignes de détail pour l'envoi
        const orderLinesToSend = (this.commandeDetails || []).map(detail => ({
            id: detail.id,
            statut: detail.statut
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
            demandeurId: this.demandeurId,
            lieuId: this.lieuId, // Lieu_de_Destination__c = Repairer
            stockId: this.stockId, // Stock__c = Origin Site
            commentaire: this.commentaire, 
            cart: this.cart,
            actionGlobale: actionGlobale,
            commandeParenteId: this.linkedCommandeId,
            orderLines: orderLinesToSend 
        };
        
        console.log('Calling saveEnvoi with input:', this.dateEnvoi);
        console.log('Calling saveEnvoi 2:', actionGlobale);
        console.log('Calling saveEnvoi 3:', JSON.stringify(input));

        // Si on a déjà une date d'envoi et qu'on demande à VALIDER, on change en UPDATE simple
        if (this.dateEnvoi && actionGlobale === 'VALIDER') {
            input.actionGlobale = 'UPDATE';
        }



        console.log('Calling saveEnvoi NOW...');
        saveEnvoi({ inputJSON: JSON.stringify(input) })
            .then(envoiId => {
                console.log('saveEnvoi SUCCESS. envoiId:', envoiId);
                let successMsg = "L'envoi a été sauvegardé.";
                const isCreationContext = !this._recordId || this._objectApiName !== 'Envoi_Logistique__c';
                console.log('Save Contexte:', JSON.stringify(input));
                console.log('ActionGlobale:', actionGlobale);
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

                console.log('Determining redirect. actionGlobale:', actionGlobale, '_objectApiName:', this._objectApiName);
                if (actionGlobale) {
                    // --- LOGIQUE OUTPUT FLOW ---
                    const pieceIds = this.cart.map(item => item.pieceUnitaireId);
                    this.outputPieceIds = pieceIds;
                    this.dispatchEvent(new FlowAttributeChangeEvent('outputPieceIds', pieceIds));
                    // ---------------------------

                    // ... On met à jour la propriété de sortie pour le Flow
                    this.isSaveComplete = true;
                    this.isLoading = false; 
                    console.log('Redirecting (actionGlobale branch)...');
                    window.location.assign('/lightning/r/Envoi_Logistique__c/' + envoiId + '/view');
                } else if (this._objectApiName !== 'Envoi_Logistique__c') {
                    // Cas Création (depuis Commande, Ticket, ou Page Vierge) : Redirection vers la fiche de l'envoi créé
                    console.log('Redirecting (Creation branch)...');
                    this.isLoading = false;
                    window.location.assign('/lightning/r/Envoi_Logistique__c/' + envoiId + '/view');
                } else {
                    // Cas Mise à jour sur la fiche Envoi : On recharge les données
                    console.log('Reloading data...');
                    
                    // Reload LWC data
                    this.loadEnvoiData(envoiId).finally(() => {
                        this.isLoading = false;
                    });
                }
            })
            .catch(error => {
                console.error('saveEnvoi ERROR:', error);
                this.showToast('Erreur', this.reduceErrors(error)[0], 'error');
                this.isLoading = false;
            });
    }
    handleGenericChange(event) { this[event.target.dataset.field] = event.detail.value[0] || event.detail.value; }
    showToast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
    reduceErrors(errors) { if (!Array.isArray(errors)) { errors = [errors]; } return errors.filter(error => !!error).map(error => { if (error.body && error.body.message) { return error.body.message; } if (error.message) { return error.message; } return 'Unknown error'; }); }
}
