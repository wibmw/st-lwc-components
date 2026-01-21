/**
 * @description Generic lookup component with pill display and search functionality
 * @author Refactoring - Antigravity
 * @date 2026-01-20
 * 
 * @property {String} label - Field label
 * @property {String} placeholder - Input placeholder text
 * @property {Object} selectedValue - Selected record { value, label, sublabel, pillLabel, ...extra }
 * @property {String} iconName - SLDS icon name (e.g., 'standard:account')
 * @property {String} sObjectType - Salesforce object API name for search
 * @property {Boolean} disabled - Whether the field is disabled
 * @property {String} variant - label-stacked or label-hidden
 * 
 * @fires select - When a lookup option is selected
 * @fires remove - When the pill is removed
 */
import { LightningElement, api, track } from 'lwc';
import searchRecordsEnvoi from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchRecords';
import searchRecordsDemande from '@salesforce/apex/MntGestionDemandeLogistiqueCtrl.searchRecords';
import { debounce } from 'c/logisticsUtils';

export default class LookupPill extends LightningElement {
    // ==================== PUBLIC PROPERTIES ====================
    
    @api label = '';
    @api placeholder = 'Rechercher...';
    @api iconName = 'standard:record';
    
    // Debugging props with setters
    _sObjectType = 'Contact';
    @api 
    get sObjectType() { return this._sObjectType; }
    set sObjectType(val) {
        console.log('LookupPill: SET sObjectType =>', val);
        this._sObjectType = val;
    }

    _objectType;
    @api 
    get objectType() { return this._objectType; }
    set objectType(val) {
        console.log('LookupPill: SET objectType =>', val);
        this._objectType = val;
        // Immediate sync if needed, though connectedCallback handles init sync
        if (val && this._sObjectType === 'Contact') {
             this._sObjectType = val;
        }
    }

    @api disabled = false;
    @api variant = 'label-stacked';

    _controllerName = 'envoi';
    @api 
    get controllerName() { return this._controllerName; }
    set controllerName(val) {
        console.log('LookupPill: SET controllerName =>', val);
        this._controllerName = val;
    }

    connectedCallback() {
        console.log(`LookupPill Connected: Object=${this.sObjectType}, CTRL=${this.controllerName}`);
    }

    _selectedValue = null;
    @api 
    get selectedValue() {
        return this._selectedValue;
    }
    set selectedValue(value) {
        this._selectedValue = value;
    }

    // ==================== PRIVATE PROPERTIES ====================
    
    @track suggestions = [];
    @track isOpen = false;
    @track isLoading = false;

    // Debounced search function
    debouncedSearch = debounce(this.performSearch.bind(this), 300);

    // ==================== GETTERS ====================

    get comboboxClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isOpen ? 'slds-is-open' : ''}`;
    }

    get hasSelectedValue() {
        return this.selectedValue !== null && this.selectedValue !== undefined;
    }

    get pillLabel() {
        return this.selectedValue?.pillLabel || this.selectedValue?.label || '';
    }

    get hasSuggestions() {
        return this.suggestions && this.suggestions.length > 0;
    }

    get showLabel() {
        return this.variant === 'label-stacked';
    }

    // ==================== EVENT HANDLERS ====================

    /**
     * Handle search input changes
     */
    handleSearchInput(event) {
        const searchTerm = event.target.value;
        
        if (searchTerm && searchTerm.length >= 3) {
            this.isOpen = true;
            this.isLoading = true;
            this.debouncedSearch(searchTerm);
        } else {
            this.isOpen = false;
            this.suggestions = [];
        }
    }

    /**
     * Handle pill removal
     */
    handleRemove() {
        if (this.disabled) return;

        const previousValue = this.selectedValue;
        this._selectedValue = null;
        
        // Emit remove event
        this.dispatchEvent(new CustomEvent('remove', {
            detail: { previousValue }
        }));
    }

    /**
     * Handle suggestion selection
     */
    handleSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        const sublabel = event.currentTarget.dataset.sublabel;
        const pillLabel = event.currentTarget.dataset.pilllabel || label;
        
        // Extra data for specific object types
        const address = event.currentTarget.dataset.address;
        const g2r = event.currentTarget.dataset.g2r;
        const siteName = event.currentTarget.dataset.sitename;
        const compteProjet = event.currentTarget.dataset.compteprojet;

        // Build selected value object
        const selectedValue = {
            value,
            label,
            sublabel,
            pillLabel
        };

        // Add extra data if present
        if (address) selectedValue.address = address;
        if (g2r) selectedValue.g2r = g2r;
        if (siteName) selectedValue.siteName = siteName;
        if (compteProjet) selectedValue.compteProjet = compteProjet;

        this._selectedValue = selectedValue;
        this.isOpen = false;
        this.suggestions = [];

        // Clear input
        const input = this.template.querySelector('lightning-input');
        if (input) {
            input.value = '';
        }

        // Emit select event
        this.dispatchEvent(new CustomEvent('select', {
            detail: selectedValue
        }));
    }

    /**
     * Handle focus - open dropdown if there are cached suggestions
     */
    handleFocus() {
        if (this.suggestions.length > 0) {
            this.isOpen = true;
        }
    }

    /**
     * Handle blur - close dropdown after a delay
     */
    handleBlur() {
        // Delay to allow click on suggestion
        setTimeout(() => {
            this.isOpen = false;
        }, 200);
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Perform Apex search
     */
    async performSearch(searchTerm) {
        console.log('Performing search for:', searchTerm, 'on object:', this.sObjectType, 'with controller:', this.controllerName);
        
        // Select the correct Apex method based on controller name
        const apexSearchRecords = this.controllerName === 'demande' ? searchRecordsDemande : searchRecordsEnvoi;
        
        // Safety check for the import
        if (!apexSearchRecords) {
            console.error('CRITICAL: apexSearchRecords import is UNDEFINED. Check deployment of controllers.');
            this.isLoading = false;
            return;
        }

        try {
            const results = await apexSearchRecords({
                searchTerm: searchTerm,
                sObjectType: this.sObjectType
            });
            
            console.log('Search results:', results);
            this.suggestions = results || [];
            this.isLoading = false;
        } catch (error) {
            console.error('Lookup search error detail:', JSON.stringify(error));
            this.suggestions = [];
            this.isLoading = false;
            
            // Optionally emit error event
            this.dispatchEvent(new CustomEvent('error', {
                detail: { error }
            }));
        }
    }
}
