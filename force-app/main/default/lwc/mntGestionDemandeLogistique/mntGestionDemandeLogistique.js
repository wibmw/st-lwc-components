import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';
import { NavigationMixin } from 'lightning/navigation';
import { deleteRecord, getRecordNotifyChange } from 'lightning/uiRecordApi';

import { isDesktopDevice, STATUS_DEFINITIONS_BY_KEY, STATUS_DEFINITIONS_BY_APIVALUE } from 'c/logisticsUtils';

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

    _viewCommandInfo;
    delayTimeout;

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
        if (this.isDesktop) return this.hasExistingCockpitLines;
        return true;
    }

    get cardTitle() {
        return this.isEditMode ? 'Modifier la Commande' : 'Créer une nouvelle Commande';
    }

    get cartCols() {
        return COLS_CART_EDIT;
    }

    get isDisabled() {
        if (this.isDesktop) {
            if (this.isEditMode) {
                const forbiddenStatusesForUpdate = ['Nouveau', 'Clôturer'];
                if (forbiddenStatusesForUpdate.includes(this.status)) return true;
            } else {
                if (this.ticketStatus && this.ticketStatus !== 'PEC Cockpit') return true;
            }
        }

        if (this.cart.length === 0) return !this.isEditMode;

        return !this.cart.every(c => {
            const hasQuantity = c.quantity && c.quantity > 0;
            const isAutre = c.articleName && c.articleName.toLowerCase() === 'autre';
            const hasCommentIfRequired = isAutre ? (c.comment && c.comment.trim().length > 0) : true;
            return hasQuantity && hasCommentIfRequired;
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
        if (!this.isEditMode) return 'Créer la Demande';
        if (!this.isDesktop) return 'Mettre à jour la Demande';
        return this.hasExistingCockpitLines ? 'Mettre à jour' : 'Créer la Demande';
    }

    get hasFilesToUpload() {
        return this.filesToUpload.length > 0;
    }

    get hasAttachedFiles() {
        return this.attachedFiles.length > 0;
    }

    get isPecCockpitDisabled() {
        return this.status !== 'Nouveau';
    }

    get isPecRetraitementDisabled() {
        return this.status !== 'À Retraiter';
    }

    connectedCallback() {
        if (this.ticketCorrectifID && !this.nTicketId) {
            this.nTicketId = this.ticketCorrectifID;
        }

        if (this.objectApiName === 'Correctif__c' && this.recordId) {
            this.nTicketId = this.recordId;
            this.loadInitialData();
        } else if (this.objectApiName === 'sitetracker__Job__c' && this.recordId) {
            this.loadInitialData();
        } else if (this.ticketCorrectifID) {
            // Prioritize Ticket Creation flow if ticket ID is explicitly provided
            this.loadInitialData();
        } else if (this.recordId) {
            // Assume Order Edit flow if recordId is present but NOT a ticket creation flow
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
            } else if (this.objectApiName === 'Correctif__c' && this.recordId) {
                params = { nTicketId: this.recordId, sObjectType: 'Correctif__c' };
            }

            const data = await getInitialData(params);

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
                    pillLabel: sublabel ? `${label} - ${sublabel}` : label,
                    g2r: data.g2r,
                    siteName: data.siteName
                };
                this.g2r = data.g2r;
                this.siteName = data.siteName;

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
                getRecordNotifyChange([{ recordId: this.recordId }]);
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

                if (this.filesToUpload.length > 0) {
                    const filesData = this.filesToUpload.map(f => ({ title: f.name, base64Data: f.base64 }));
                    await uploadFiles({ recordId: newOrderId, files: filesData });
                }

                this.toast('Succès', 'Commande créée avec succès.', 'success');
                getRecordNotifyChange([{ recordId: this.recordId }]);
                this.isSaveComplete = true;
                this.dispatchEvent(new FlowNavigationNextEvent());
            }
        } catch (e) {
            this.toast('Erreur', e?.body?.message || 'Erreur lors de la sauvegarde.', 'error');
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
        if (uploadedFiles && uploadedFiles.length > 0) {
            const newFiles = uploadedFiles.map(file => ({
                id: file.documentId,
                title: file.name,
                previewUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`
            }));
            this.attachedFiles = [...this.attachedFiles, ...newFiles];
        }

        setTimeout(() => {
            this.refreshAttachedFiles();
        }, 1000);
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
                // Silent fail
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
            const articlesFound = await searchArticles({ term: this.articleSearchTerm, limitSize: 100 });

            if (this.isDesktop) {
                const articleIds = articlesFound.map(art => art.value);
                if (articleIds.length > 0) {
                    let res = await getInventoryAggregatesMulti({ articleIds: articleIds, limitSize: 100, offsetVal: 0, groupBySite: this.isDesktop });
                    res = res.map(row => {
                        const suffix = row.siteNomDuSite ? ` - ${row.siteNomDuSite}` : '';
                        return {
                            ...row,
                            siteName: row.siteName + suffix
                        };
                    });
                    this.rows = [...res];
                } else {
                    this.rows = [];
                }
            } else {
                const res = articlesFound.map(art => ({
                    articleId: art.value,
                    articleName: art.label,
                    mnemonique: art.sublabel,
                    description: art.description,
                    siteId: null,
                    siteName: '',
                    stock: 0
                }));
                this.rows = [...res];
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

    handleCartItemChange(event) {
        const { id, field, value } = event.detail;
        this.cart = this.cart.map(item =>
            item.key === id ? { ...item, [field]: value } : item
        );
    }

    handleCartItemRemove(event) {
        const { id } = event.detail;
        this.cart = this.cart.filter(c => c.key !== id);
        this.updateCartKeys();
        if (this.isDesktop) {
            this.hasExistingCockpitLines = this.cart.length > 0;
        }
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
