import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { deleteRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAttachedFiles from '@salesforce/apex/MntFilesManagerCtrl.getAttachedFiles';

export default class MntFilesManager extends NavigationMixin(LightningElement) {
    @api recordId;
    @track attachedFiles = [];
    @track loading = false;

    get acceptedFormats() {
        return ['.jpg', '.jpeg', '.png', '.pdf'];
    }

    get hasAttachedFiles() {
        return this.attachedFiles.length > 0;
    }

    connectedCallback() {
        this.refreshAttachedFiles();
    }

    async refreshAttachedFiles() {
        if (this.recordId) {
            try {
                const files = await getAttachedFiles({ recordId: this.recordId });
                this.attachedFiles = files.map(file => {
                    const id = file.id || file.Id;
                    const title = file.title || file.Title;
                    return {
                        ...file,
                        id: id,
                        title: title,
                        previewUrl: `/sfc/servlet.shepherd/document/download/${id}`
                    };
                });
            } catch (e) {
                console.error('Erreur chargement fichiers', e);
                this.showToast('Erreur', 'Impossible de charger les fichiers', 'error');
            }
        }
    }

    handleUploadFinished(event) {
        this.showToast('Succès', 'Fichiers téléchargés avec succès.', 'success');
        
        // Optimistic UI Update
        const uploadedFiles = event.detail.files;
        if (uploadedFiles && uploadedFiles.length > 0) {
            const newFiles = uploadedFiles.map(file => ({
                id: file.documentId,
                title: file.name,
                previewUrl: `/sfc/servlet.shepherd/document/download/${file.documentId}`
            }));
            this.attachedFiles = [...this.attachedFiles, ...newFiles];
        }

        // Refresh from server to ensure consistency
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.refreshAttachedFiles();
        }, 1000);
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
            this.showToast('Succès', 'Fichier supprimé.', 'success');
            this.attachedFiles = this.attachedFiles.filter(file => file.id !== fileId);
        } catch (error) {
            this.showToast('Erreur', 'Impossible de supprimer le fichier : ' + (error.body?.message || error.message), 'error');
        } finally {
            this.loading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}
