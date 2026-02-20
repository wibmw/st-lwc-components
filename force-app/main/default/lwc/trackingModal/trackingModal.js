import LightningModal from 'lightning/modal';
import { api } from 'lwc';

export default class TrackingModal extends LightningModal {
    @api url;
    @api title;

    // Backward compatibility for components that might still pass trackingUrl
    @api 
    get trackingUrl() {
        return this.url;
    }
    set trackingUrl(value) {
        this.url = value;
    }

    get modalTitle() {
        return this.title || "Suivi de l'envoi";
    }

    // Gère la fermeture de la modale
    handleClose() {
        this.close('close');
    }
}