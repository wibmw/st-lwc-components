import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

export default class DynamicMultiVarIframe extends LightningElement {
    // --- PROPRIÉTÉS CONFIGURABLES PAR L'ADMINISTRATEUR ---
    @api recordId;
    @api objectApiName;
    @api urlTemplate;
    @api dynamicFieldNames; // Peut contenir une liste de champs séparés par des virgules
    @api iframeHeight = '500px';

    // --- PROPRIÉTÉS INTERNES ---
    iframeUrl = null;
    errorMessage = null;

    /**
     * Service Wire qui réagit aux changements et récupère les données des champs demandés.
     */
    @wire(getRecord, { recordId: '$recordId', fields: '$fieldsToQuery' })
    wiredRecord({ error, data }) {
        if (data) {
            // S'assurer que le composant est bien configuré avant de continuer
            if (!this.urlTemplate || !this.dynamicFieldNames) {
                this.errorMessage = 'Configuration incomplète. Veuillez renseigner "URL Template" et "Dynamic Field Names".';
                return;
            }

            let finalUrl = this.urlTemplate;
            const fieldList = this.dynamicFieldNames.split(',').map(f => f.trim());
            let allFieldsHaveValue = true;

            // Boucle sur chaque champ demandé pour construire l'URL
            for (let i = 0; i < fieldList.length; i++) {
                const fullFieldName = `${this.objectApiName}.${fieldList[i]}`;
                const fieldValue = getFieldValue(data, fullFieldName);

                if (fieldValue === null || fieldValue === undefined) {
                    allFieldsHaveValue = false;
                }
                
                // On remplace le marqueur {i} par la valeur du champ (même si elle est vide)
                // L'utilisation d'une expression régulière globale garantit le remplacement de toutes les occurrences.
                finalUrl = finalUrl.replace(new RegExp(`\\{${i}\\}`, 'g'), fieldValue || '');
            }

            // Affiche l'iframe si tous les champs requis ont une valeur
            if (allFieldsHaveValue) {
                this.iframeUrl = finalUrl;
                this.errorMessage = null;
            } else {
                this.iframeUrl = null;
                this.errorMessage = `Un ou plusieurs champs requis (${this.dynamicFieldNames}) sont vides.`;
            }

        } else if (error) {
            this.errorMessage = 'Erreur lors de la récupération des données.';
            console.error('Erreur DynamicIframe LWC:', JSON.stringify(error));
        }
    }

    /**
     * Getter qui transforme la liste de champs séparés par des virgules
     * en un format que le service @wire peut comprendre (ex: ['Account.Name', 'Account.Industry'])
     */
    get fieldsToQuery() {
        if (this.dynamicFieldNames) {
            // Split, trim, and map to full API name format
            return this.dynamicFieldNames.split(',').map(field => field.trim()).map(fieldName => `${this.objectApiName}.${fieldName}`);
        }
        return undefined;
    }
}