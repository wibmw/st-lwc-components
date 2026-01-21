/**
 * @description Cart item component with 3 display modes
 * @author Refactoring - Antigravity
 * @date 2026-01-20
 * 
 * @property {Object} item - Cart item data
 * @property {String} mode - Display mode: 'demande' | 'envoi' | 'reparation'
 * @property {Boolean} isDesktop - Desktop vs mobile layout
 * @property {Boolean} isReadOnly - Read-only mode
 * 
 * @fires change - When a field value changes
 * @fires remove - When item should be removed from cart
 * @fires statuschange - When status changes (demande mode only)
 * @fires actionchronopost - When Chronopost action clicked (envoi/reparation modes)
 */
import { LightningElement, api } from 'lwc';

export default class CartItem extends LightningElement {
    // ==================== PUBLIC PROPERTIES ====================
    
    @api item;
    @api mode = 'demande'; // 'demande' | 'envoi' | 'reparation'
    @api isDesktop = false;
    @api isReadOnly = false;

    // ==================== GETTERS ====================

    get isDemandeMode() {
        return this.mode === 'demande';
    }

    get isEnvoiMode() {
        return this.mode === 'envoi';
    }

    get isReparationMode() {
        return this.mode === 'reparation';
    }

    get showQuantity() {
        return this.isDemandeMode;
    }

    get showBonLivraison() {
        return this.isEnvoiMode || this.isReparationMode;
    }

    get showChronopostStatus() {
        return this.isEnvoiMode || this.isReparationMode;
    }

    get showChronopostActions() {
        return (this.isEnvoiMode || this.isReparationMode) && !this.isReadOnly;
    }

    get showTracking() {
        return this.isEnvoiMode && this.item?.numBonLivraison;
    }

    get trackingUrl() {
        return this.item?.numBonLivraison 
            ? `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${this.item.numBonLivraison}` 
            : null;
    }

    get statutDisplay() {
        return this.item?.statutForDisplay || this.item?.statut || '';
    }

    get chronopostStatus() {
        return this.item?.statutChronopost || 'En préparation chez l\'expéditeur';
    }

    // ==================== EVENT HANDLERS ====================

    /**
     * Handle field change (quantity, BL, comment)
     */
    handleChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                id: this.item.pieceUnitaireId || this.item.key,
                field: field,
                value: value
            }
        }));
    }

    /**
     * Handle remove button click
     */
    handleRemove() {
        this.dispatchEvent(new CustomEvent('remove', {
            detail: {
                id: this.item.pieceUnitaireId || this.item.key
            }
        }));
    }

    /**
     * Handle status change (Demande mode)
     */
    handleStatusChange(event) {
        const newStatus = event.target.dataset.status;
        
        this.dispatchEvent(new CustomEvent('statuschange', {
            detail: {
                id: this.item.pieceUnitaireId || this.item.key,
                newStatus: newStatus
            }
        }));
    }

    /**
     * Handle Chronopost action (Livré/Perdu)
     */
    handleChronopostAction(event) {
        const action = event.target.dataset.action;
        
        this.dispatchEvent(new CustomEvent('actionchronopost', {
            detail: {
                id: this.item.pieceUnitaireId || this.item.key,
                action: action // 'Livré' or 'Perdu'
            }
        }));
    }

    /**
     * Handle tracking button click
     */
    handleTrack() {
        if (this.trackingUrl) {
            window.open(this.trackingUrl, '_blank');
        }
    }
}
