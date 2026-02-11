/**
 * @description Custom cards list component with configurable 6-position layout
 * Combines features from mobileListView and pillSearch
 * @author Antigravity AI
 * @date 2026-02-11
 * 
 * @property {String} sObjectType - Salesforce object API name (required)
 * @property {String} fields - Comma-separated field names to retrieve (required)
 * @property {String} filterClause - Optional WHERE clause filter
 * @property {String} orderBy - Optional field name to sort by
 * @property {Integer} limitRecords - Optional result limit (default 50)
 * @property {String} sectionName - Accordion section name
 * @property {String} iconName - SLDS icon name for cards
 * @property {String} flowUrl - URL for redirection on card click
 * @property {Boolean} techMode - Add &TechMode=true to URL
 * @property {String} topLeftField - Field for top left position
 * @property {String} topRightField - Field for top right position
 * @property {String} middleLeftField - Field for middle left position
 * @property {String} middleRightField - Field for middle right position
 * @property {String} bottomLeftField - Field for bottom left position
 * @property {String} bottomRightField - Field for bottom right position
 * @property {String} topLeftFormat - Template for top left (e.g., '{Name} - {Type}')
 * @property {String} topRightFormat - Template for top right
 * @property {String} middleLeftFormat - Template for middle left
 * @property {String} middleRightFormat - Template for middle right
 * @property {String} bottomLeftFormat - Template for bottom left
 * @property {String} bottomRightFormat - Template for bottom right
 */
import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getRecords from '@salesforce/apex/CustomCardsListCtrl.getRecords';

export default class CustomCardsList extends NavigationMixin(LightningElement) {
    @api sObjectType = '';
    @api fields = '';
    @api filterClause = '';
    @api orderBy = '';
    @api limitRecords = 50;
    @api sectionName = 'Records';
    @api iconName = 'standard:record';
    @api flowUrl = '';
    @api techMode = false;
    
    @api topLeftField = '';
    @api topRightField = '';
    @api middleLeftField = '';
    @api middleRightField = '';
    @api bottomLeftField = '';
    @api bottomRightField = '';
    
    @api topLeftFormat = '';
    @api topRightFormat = '';
    @api middleLeftFormat = '';
    @api middleRightFormat = '';
    @api bottomLeftFormat = '';
    @api bottomRightFormat = '';

    records = [];
    error = null;
    loading = true;

    connectedCallback() {
        this.loadRecords();
    }

    async loadRecords() {
        try {
            this.loading = true;
            this.error = null;

            if (!this.sObjectType || !this.fields) {
                this.error = 'sObjectType and fields are required';
                this.loading = false;
                return;
            }

            const rawRecords = await getRecords({
                sObjectType: this.sObjectType,
                fields: this.fields,
                filterClause: this.filterClause,
                orderBy: this.orderBy,
                limitRecords: this.limitRecords
            });

            this.records = this.transformRecords(rawRecords);
            this.loading = false;

        } catch (error) {
            this.error = error.body ? error.body.message : error.message;
            this.records = [];
            this.loading = false;
        }
    }

    transformRecords(rawRecords) {
        if (!rawRecords || rawRecords.length === 0) {
            return [];
        }

        return rawRecords.map(record => {
            const topLeft = this.getPositionValue(record.fieldValues, this.topLeftField, this.topLeftFormat);
            const topRight = this.getPositionValue(record.fieldValues, this.topRightField, this.topRightFormat);
            const middleLeft = this.getPositionValue(record.fieldValues, this.middleLeftField, this.middleLeftFormat);
            const middleRight = this.getPositionValue(record.fieldValues, this.middleRightField, this.middleRightFormat);
            const bottomLeft = this.getPositionValue(record.fieldValues, this.bottomLeftField, this.bottomLeftFormat);
            const bottomRight = this.getPositionValue(record.fieldValues, this.bottomRightField, this.bottomRightFormat);

            return {
                id: record.recordId,
                topLeft: topLeft,
                topRight: topRight,
                middleLeft: middleLeft,
                middleRight: middleRight,
                bottomLeft: bottomLeft,
                bottomRight: bottomRight,
                hasTopRow: topLeft || topRight,
                hasMiddleRow: middleLeft || middleRight,
                hasBottomRow: bottomLeft || bottomRight
            };
        });
    }

    getPositionValue(fieldValues, fieldName, formatTemplate) {
        if (formatTemplate && formatTemplate.trim()) {
            return this.formatTemplate(fieldValues, formatTemplate);
        } else if (fieldName && fieldName.trim()) {
            return fieldValues[fieldName] || '';
        }
        return '';
    }

    formatTemplate(fieldValues, template) {
        if (!template || !fieldValues) {
            return '';
        }

        let result = template;
        const regex = /\{([^}]+)\}/g;
        let match;

        while ((match = regex.exec(template)) !== null) {
            const fieldName = match[1].trim();
            const fieldValue = fieldValues[fieldName] || '';
            result = result.replace(match[0], fieldValue);
        }

        return result;
    }

    get hasRecords() {
        return this.records && this.records.length > 0;
    }

    handleRecordClick(event) {
        const recordId = event.currentTarget.dataset.id;
        if (recordId) {
            if (this.flowUrl && this.flowUrl.trim().length > 0) {
                let finalUrl = this.flowUrl + '?recordId=' + recordId;
                if (this.techMode) {
                    finalUrl += '&TechMode=true';
                }
                window.location.assign(finalUrl);
            }
        }
    }
}
