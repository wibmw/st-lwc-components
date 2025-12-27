import LightningModal from 'lightning/modal';
import { api } from 'lwc';

export default class TrackingModal extends LightningModal {
    // Variable publique pour recevoir l'URL de suivi depuis le composant parent
    @api trackingUrl;

    // Gère la fermeture de la modale
    handleClose() {
        this.close('close');
    }
}