import { LightningElement, api, wire } from 'lwc';
import { getListInfoByName, getListRecordsByName } from 'lightning/uiListsApi';

export default class MobileListView extends LightningElement {
    @api objectApiName;
    @api listViewApiName;

    listViewLabel;
    displayColumns = [];
    listViewFields; // New property for chaining
    records = [];
    error;
    loading = true;

    @wire(getListInfoByName, {
        objectApiName: '$objectApiName',
        listViewApiName: '$listViewApiName'
    })
    wiredListViewInfo({ error, data }) {
        if (data) {
            this.listViewLabel = data.label;
            // Get the first 4 display columns
            this.displayColumns = data.displayColumns.slice(0, 4).map(col => ({
                label: col.label,
                fieldApiName: col.fieldApiName
            }));
            
            // Extract field names for the records wire adapter and ensure they are fully qualified
            this.listViewFields = this.displayColumns.map(col => {
                return col.fieldApiName.includes('.') ? col.fieldApiName : `${this.objectApiName}.${col.fieldApiName}`;
            });
            
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.listViewLabel = undefined;
            this.displayColumns = [];
            this.loading = false;
        }
    }

    @wire(getListRecordsByName, {
        objectApiName: '$objectApiName',
        listViewApiName: '$listViewApiName',
        fields: '$listViewFields'
    })
    wiredRecords({ error, data }) {
        this.loading = true;
        if (data) {
            console.log('MobileListView Records Data:', JSON.stringify(data));
            this.records = data.records.map(record => {
                const fields = this.displayColumns.map(col => ({
                    label: col.label,
                    value: this.getValue(record, col.fieldApiName)
                }));

                return {
                    id: record.id,
                    topLeft: fields[0] ? fields[0].value : '',
                    topRight: fields[1] ? fields[1].value : '',
                    bottomLeft: fields[2] ? fields[2].value : '',
                    bottomRight: fields[3] ? fields[3].value : ''
                };
            });
            this.error = undefined;
            this.loading = false;
        } else if (error) {
            console.error('MobileListView Records Error:', error);
            this.error = error;
            this.records = [];
            this.loading = false;
        }
    }

    getValue(record, fieldName) {
        if (!record || !record.fields || !fieldName) return '';
        
        // Handle direct access first (common case)
        if (record.fields[fieldName]) {
            return record.fields[fieldName].displayValue || record.fields[fieldName].value || '';
        }

        // Handle fully qualified name access (Object.Field) if simple name was passed
        // OR handle simple name access if fully qualified name was passed
        // This makes the lookup robust regardless of how the key is stored vs requested
        const objectPrefix = this.objectApiName + '.';
        let altName = fieldName;
        if (fieldName.includes(objectPrefix)) {
            altName = fieldName.replace(objectPrefix, '');
        } else if (!fieldName.includes('.')) {
            altName = objectPrefix + fieldName;
        }

        if (record.fields[altName]) {
             return record.fields[altName].displayValue || record.fields[altName].value || '';
        }

        // Handle relationship fields (e.g., Account.Name)
        if (fieldName.includes('.')) {
            const parts = fieldName.split('.');
            let current = record.fields;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) return '';
                
                // If it's the last part, return the value
                if (i === parts.length - 1) {
                    return current[part].displayValue || current[part].value || '';
                }
                
                // Go deeper into the relationship
                if (current[part].value && current[part].value.fields) {
                    current = current[part].value.fields;
                } else {
                    return '';
                }
            }
        }
        
        return '';
    }

    get hasRecords() {
        return this.records && this.records.length > 0;
    }
}
