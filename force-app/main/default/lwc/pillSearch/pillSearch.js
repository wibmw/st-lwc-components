/**
 * @description Generic pill search component for Screen Flows and Lightning Pages.
 *              Supports single selection and multi-selection mode.
 * @author Antigravity AI
 * @date 2026-01-30
 *
 * @property {String}  label           - Field label
 * @property {String}  placeholder     - Search input placeholder
 * @property {String}  iconName        - SLDS icon name (e.g., 'standard:account')
 * @property {String}  sObjectType     - Salesforce object API name
 * @property {String}  searchFields    - Comma-separated fields to search (supports relationships)
 * @property {String}  labelField      - Field to display as main label (supports relationships)
 * @property {String}  sublabelField   - Field to display as sublabel (supports relationships)
 * @property {String}  labelFormat     - Optional template for label formatting
 * @property {String}  sublabelFormat  - Optional template for sublabel formatting
 * @property {String}  filterClause    - Optional WHERE clause filter
 * @property {Boolean} readOnly        - Whether component is read-only
 * @property {Boolean} required        - Whether field is required
 * @property {Boolean} multiSelect     - Enable multi-selection mode
 *
 * Single mode outputs:
 * @property {String} selectedRecordId   - Output: Selected record ID
 * @property {String} selectedRecordName - Output: Selected record Name
 *
 * Multi mode outputs (via events):
 * @fires select - detail.selectedValues : Array of { value, label, sublabel, pillLabel }
 * @fires remove - detail.selectedValues : Array of { value, label, sublabel, pillLabel }
 */
import { LightningElement, api, track } from 'lwc';
import searchRecords from '@salesforce/apex/PillSearchCtrl.searchRecords';
import getRecordDetails from '@salesforce/apex/PillSearchCtrl.getRecordDetails';
import getRecordsDetails from '@salesforce/apex/PillSearchCtrl.getRecordsDetails';

export default class PillSearch extends LightningElement {

    _selectedRecordId = '';
    _initialized = false;
    _selectedRecordIds = []; // Private backing field
    _clearingId = false;     // Guard flag to prevent infinite loop in selectedRecordId setter

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
    @api multiSelect = false;

    // ==================== OUTPUT PROPERTIES (single mode) ====================

    @api
    get selectedRecordId() {
        return this._selectedRecordId;
    }
    set selectedRecordId(value) {
        this._selectedRecordId = value;
        if (this._initialized && value && !this.selectedValue) {
            this.fetchRecordDetails(value);
        } else if (this._initialized && !value && !this._clearingId) {
            this._clearingId = true;
            this.handleRemoveSingle();
            this._clearingId = false;
        }
    }

    @api selectedRecordName = '';

    // Multi mode output for Flow (Collection Variable)
    @api
    get selectedRecordIds() {
        return this._selectedRecordIds;
    }
    set selectedRecordIds(value) {
        this.handleIdsChange(value);
    }

    // New: CSV String output/input for direct Text Field binding
    @api
    get selectedRecordIdsCSV() {
        return this._selectedRecordIds ? this._selectedRecordIds.join(',') : '';
    }
    set selectedRecordIdsCSV(value) {
        if (value) {
            const ids = value.split(',').map(id => id.trim()).filter(id => id.length > 0);
            
            // Set oldRecordIds only if it's the first load (empty)
            if (!this.oldRecordIds || this.oldRecordIds.length === 0) {
                this.oldRecordIds = [...ids];
            }
            
            this.handleIdsChange(ids);
        } else {
            this.handleIdsChange([]);
        }
    }

    // New: Output for initial state (Old Record IDs)
    @api oldRecordIds = [];

    // Helper to handle ID changes from either Array or CSV source
    handleIdsChange(newIds) {
        newIds = newIds ? [...newIds] : [];
        
        // Deep comparison - sort both arrays to ensure order doesn't matter
        const currentIdsSorted = [...this._selectedRecordIds].sort().join(',');
        const newIdsSorted = [...newIds].sort().join(',');

        if (currentIdsSorted === newIdsSorted) {
            return;
        }

        this._selectedRecordIds = newIds;

        if (this._initialized && this.multiSelect) {
            if (newIds.length > 0) {
                // Fetch details only for IDs we don't already have in selectedValues
                const idsToFetch = newIds.filter(id => !this.selectedValues.find(sv => sv.value === id));
                if (idsToFetch.length > 0) {
                    this.fetchRecordsDetails(newIds);
                }
            } else {
                this.selectedValues = [];
            }
        }
    }

    // ==================== PRIVATE PROPERTIES ====================

    @track suggestions = [];
    @track isOpen = false;
    @track isLoading = false;

    // Single mode
    @track selectedValue = null;

    // Multi mode
    @track selectedValues = [];

    searchTimeout;

    // ==================== LIFECYCLE ====================

    connectedCallback() {
        this._initialized = true;
        
        // Single mode pre-selection
        if (!this.multiSelect && this.selectedRecordId) {
            this.fetchRecordDetails(this.selectedRecordId);
        }
        
        // Multi mode pre-selection
        if (this.multiSelect && this.selectedRecordIds && this.selectedRecordIds.length > 0) {
            this.fetchRecordsDetails(this.selectedRecordIds);
        }
    }

    // ==================== GETTERS ====================

    get comboboxClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isOpen ? 'slds-is-open' : ''}`;
    }

    get hasSelectedValue() {
        return !this.multiSelect && this.selectedValue !== null && this.selectedValue !== undefined;
    }

    get hasSelectedValues() {
        return this.multiSelect && this.selectedValues.length > 0;
    }

    // In multi mode, input is always visible. In single mode, hide when a value is selected.
    get isInputVisible() {
        return this.multiSelect || !this.hasSelectedValue;
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

    // ==================== EVENT HANDLERS ====================

    /**
     * Handle search input changes — forces uppercase
     */
    handleSearchInput(event) {
        const upperValue = event.target.value.toUpperCase();
        event.target.value = upperValue;
        const searchTerm = upperValue;

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        if (searchTerm && searchTerm.length >= 3) {
            this.isOpen = true;
            this.isLoading = true;
            this.searchTimeout = setTimeout(() => {
                this.performSearch(searchTerm);
            }, 300);
        } else {
            this.isOpen = false;
            this.suggestions = [];
        }
    }

    /**
     * Handle suggestion selection
     */
    handleSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        const sublabel = event.currentTarget.dataset.sublabel;
        const pillLabel = event.currentTarget.dataset.pilllabel || label;

        const selectedItem = { value, label, sublabel, pillLabel };

        if (this.multiSelect) {
            // Avoid duplicates
            const alreadySelected = this.selectedValues.some(v => v.value === value);
            if (!alreadySelected) {
                this.selectedValues = [...this.selectedValues, selectedItem];
                
                // Update specific backing field to avoid triggering setter logic unnecessarily
                const newIds = this.selectedValues.map(item => item.value);
                this._selectedRecordIds = newIds;
                
                // Notify parent/flow
                this.dispatchEvent(new CustomEvent('selectedrecordidschange', { detail: { value: newIds } }));
                this.dispatchEvent(new CustomEvent('selectedrecordidscsvchange', { detail: { value: newIds.join(',') } }));
            }
            // Keep dropdown open — clear input
            const input = this.template.querySelector('lightning-input');
            if (input) input.value = '';
            this.isOpen = false;
            this.suggestions = [];

            this.dispatchEvent(new CustomEvent('select', {
                detail: { selectedValues: [...this.selectedValues] }
            }));
        } else {
            this.selectedValue = selectedItem;
            this.selectedRecordId = value;
            this.selectedRecordName = label;
            this.isOpen = false;
            this.suggestions = [];

            const input = this.template.querySelector('lightning-input');
            if (input) input.value = '';

            this.dispatchEvent(new CustomEvent('select', { detail: selectedItem }));
        }
    }

    /**
     * Remove a single pill (multi mode) — called via data-id on the remove button
     */
    handleRemoveMulti(event) {
        event.stopPropagation();
        const idToRemove = event.currentTarget.dataset.id;
        this.selectedValues = this.selectedValues.filter(v => v.value !== idToRemove);
        
        // Update backing field
        const newIds = this.selectedValues.map(item => item.value);
        this._selectedRecordIds = newIds;

        this.dispatchEvent(new CustomEvent('remove', {
            detail: { selectedValues: [...this.selectedValues] }
        }));
        // Emit change for Flow
        this.dispatchEvent(new CustomEvent('selectedrecordidschange', { detail: { value: newIds } }));
        this.dispatchEvent(new CustomEvent('selectedrecordidscsvchange', { detail: { value: newIds.join(',') } }));
    }

    /**
     * Remove selected value (single mode)
     */
    handleRemoveSingle() {
        if (this.readOnly) return;
        const previousValue = this.selectedValue;
        this.selectedValue = null;
        this.selectedRecordId = '';
        this.selectedRecordName = '';
        this.dispatchEvent(new CustomEvent('remove', { detail: { previousValue } }));
    }

    /** Kept for backward compatibility */
    handleRemove() {
        this.handleRemoveSingle();
    }

    handleFocus() {
        if (this.suggestions.length > 0) {
            this.isOpen = true;
        }
    }

    handleBlur() {
        setTimeout(() => {
            this.isOpen = false;
        }, 200);
    }

    // ==================== PRIVATE METHODS ====================

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
            this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
        }
    }

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
                this.handleRemoveSingle();
            }
        } catch (error) {
            console.error('Error fetching record details:', error);
            this.handleRemoveSingle();
        } finally {
            this.isLoading = false;
        }
    }

    async fetchRecordsDetails(recordIds) {
        if (!recordIds || recordIds.length === 0 || !this.sObjectType) return;

        try {
            this.isLoading = true;
            const results = await getRecordsDetails({
                recordIds: recordIds,
                sObjectType: this.sObjectType,
                displayFields: `${this.labelField}${this.sublabelField ? ',' + this.sublabelField : ''}`,
                labelFormat: this.labelFormat,
                sublabelFormat: this.sublabelFormat
            });

            if (results && results.length > 0) {
                this.selectedValues = results.map(result => ({
                    value: result.value,
                    label: result.label,
                    sublabel: result.sublabel,
                    pillLabel: result.pillLabel
                }));
            } else {
                this.selectedValues = [];
            }
        } catch (error) {
            console.error('Error fetching records details:', error);
            this.selectedValues = [];
        } finally {
            this.isLoading = false;
        }
    }

    // ==================== PUBLIC API METHODS ====================

    /** Clear single selection */
    @api
    clear() {
        this.handleRemoveSingle();
    }

    /** Clear all selections (multi mode) */
    @api
    clearAll() {
        this.selectedValues = [];
        this.selectedValue = null;
        this.selectedRecordId = '';
        this.selectedRecordName = '';
    }

    /** Get all selected values (multi mode) */
    @api
    getSelectedValues() {
        return [...this.selectedValues];
    }

    /** Set selection programmatically (single mode) */
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
