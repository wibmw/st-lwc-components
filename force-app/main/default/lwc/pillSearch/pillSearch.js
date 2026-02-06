/**
 * @description Generic pill search component for Screen Flows and Lightning Pages
 * @author Antigravity AI
 * @date 2026-01-30
 * 
 * @property {String} label - Field label
 * @property {String} placeholder - Search input placeholder
 * @property {String} iconName - SLDS icon name (e.g., 'standard:account')
 * @property {String} sObjectType - Salesforce object API name
 * @property {String} searchFields - Comma-separated fields to search (supports relationships)
 * @property {String} labelField - Field to display as main label (supports relationships)
 * @property {String} sublabelField - Field to display as sublabel (supports relationships)
 * @property {String} labelFormat - Optional template for label formatting (e.g., '{Name} - {Email}')
 * @property {String} sublabelFormat - Optional template for sublabel formatting
 * @property {String} filterClause - Optional WHERE clause filter
 * @property {Boolean} readOnly - Whether component is read-only
 * @property {Boolean} required - Whether field is required
 * @property {String} selectedRecordId - Output: Selected record ID
 * @property {String} selectedRecordName - Output: Selected record Name
 * 
 * @fires select - When a lookup option is selected
 * @fires remove - When the pill is removed
 */
import { LightningElement, api, track } from 'lwc';
import searchRecords from '@salesforce/apex/PillSearchCtrl.searchRecords';
import getRecordDetails from '@salesforce/apex/PillSearchCtrl.getRecordDetails';

export default class PillSearch extends LightningElement {
    
    _selectedRecordId = '';
    _initialized = false;
    // ==================== INPUT PROPERTIES ====================
    
    @api label = '';
    @api placeholder = 'Rechercher...';
    @api iconName = 'standard:record';
    @api sObjectType = '';
    @api searchFields = 'Name';
    @api labelField = 'Name';
    @api sublabelField = '';
    @api labelFormat = '';
    @api sublabelFormat = '';
    @api filterClause = '';
    @api readOnly = false;
    @api required = false;

    // ==================== OUTPUT PROPERTIES ====================
    
    @api 
    get selectedRecordId() {
        return this._selectedRecordId;
    }
    set selectedRecordId(value) {
        this._selectedRecordId = value;
        // If value changes after initialization (e.g. from flow), fetch details
        if (this._initialized && value && !this.selectedValue) {
            this.fetchRecordDetails(value);
        } else if (this._initialized && !value) {
            this.handleRemove();
        }
    }
    
    @api selectedRecordName = '';

    // ==================== PRIVATE PROPERTIES ====================
    
    @track suggestions = [];
    @track isOpen = false;
    @track isLoading = false;
    @track selectedValue = null;

    searchTimeout;

    // ==================== GETTERS ====================

    get comboboxClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isOpen ? 'slds-is-open' : ''}`;
    }

    connectedCallback() {
        this._initialized = true;
        if (this.selectedRecordId) {
            this.fetchRecordDetails(this.selectedRecordId);
        }
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

    get formattedSuggestions() {
        if (!this.suggestions) return [];
        return this.suggestions.map(suggestion => ({
            ...suggestion,
            hasSublabel: suggestion.sublabel && suggestion.sublabel.trim() !== ''
        }));
    }

    get isDisabled() {
        return this.readOnly;
    }

    get inputVariant() {
        return this.label ? 'label-hidden' : 'label-hidden';
    }

    // ==================== EVENT HANDLERS ====================

    /**
     * Handle search input changes
     */
    handleSearchInput(event) {
        const searchTerm = event.target.value;
        
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (searchTerm && searchTerm.length >= 3) {
            this.isOpen = true;
            this.isLoading = true;
            
            // Debounce search
            this.searchTimeout = setTimeout(() => {
                this.performSearch(searchTerm);
            }, 300);
        } else {
            this.isOpen = false;
            this.suggestions = [];
        }
    }

    /**
     * Handle pill removal
     */
    handleRemove() {
        if (this.readOnly) return;

        const previousValue = this.selectedValue;
        this.selectedValue = null;
        this.selectedRecordId = '';
        this.selectedRecordName = '';
        
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
        
        // Build selected value object
        const selectedValue = {
            value,
            label,
            sublabel,
            pillLabel
        };

        this.selectedValue = selectedValue;
        this.selectedRecordId = value;
        this.selectedRecordName = label;
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
        if (!this.sObjectType) {
            this.isLoading = false;
            return;
        }

        try {
            const results = await searchRecords({
                searchTerm: searchTerm,
                sObjectType: this.sObjectType,
                searchFields: this.searchFields,
                displayFields: `${this.labelField}${this.sublabelField ? ',' + this.sublabelField : ''}`,
                filterClause: this.filterClause,
                labelFormat: this.labelFormat,
                sublabelFormat: this.sublabelFormat
            });
            
            this.suggestions = results || [];
            this.isLoading = false;
        } catch (error) {
            this.suggestions = [];
            this.isLoading = false;
            
            // Optionally emit error event
            this.dispatchEvent(new CustomEvent('error', {
                detail: { error }
            }));
        }
    }

    /**
     * Fetch details for selected record ID
     */
    async fetchRecordDetails(recordId) {
        if (!recordId || !this.sObjectType) return;

        try {
            this.isLoading = true;
            const result = await getRecordDetails({
                recordId: recordId,
                sObjectType: this.sObjectType,
                displayFields: `${this.labelField}${this.sublabelField ? ',' + this.sublabelField : ''}`,
                labelFormat: this.labelFormat,
                sublabelFormat: this.sublabelFormat
            });

            if (result) {
                this.selectedValue = {
                    value: result.value,
                    label: result.label,
                    sublabel: result.sublabel,
                    pillLabel: result.pillLabel
                };
                this.selectedRecordName = result.label;
            } else {
                // If record not found, clear selection
                this.handleRemove();
            }
        } catch (error) {
            console.error('Error fetching record details:', error);
            this.handleRemove();
        } finally {
            this.isLoading = false;
        }
    }

    // ==================== PUBLIC API METHODS ====================

    /**
     * Clear the selection programmatically
     */
    @api
    clear() {
        this.handleRemove();
    }

    /**
     * Set selection programmatically
     */
    @api
    setSelection(recordId, recordName) {
        this.selectedValue = {
            value: recordId,
            label: recordName,
            pillLabel: recordName
        };
        this.selectedRecordId = recordId;
        this.selectedRecordName = recordName;
    }
}
