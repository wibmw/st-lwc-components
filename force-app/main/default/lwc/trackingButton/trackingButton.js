import { LightningElement, api } from 'lwc';
import TrackingModal from 'c/trackingModal';

/**
 * @description Composant bouton standalone qui ouvre une URL dans une modale iframe.
 * Peut être placé sur une Record Page ou dans un Screen Flow.
 * 
 * @property {String} url      - L'URL à afficher dans le popup iframe
 * @property {String} title    - Le titre de la modale (défaut : "Suivi de l'envoi")
 * @property {String} buttonLabel - Le label du bouton (défaut : "Voir le suivi")
 */
export default class TrackingButton extends LightningElement {
    /** URL à ouvrir dans la modale */
    @api url;

    /** Titre de la modale */
    @api title;

    /** Label du bouton */
    @api buttonLabel = "Voir le suivi";

    get isDisabled() {
        return !this.url;
    }

    async handleOpen() {
        if (!this.url) return;
        await TrackingModal.open({
            size: 'large',
            description: "Popup de suivi",
            url: this.url,
            title: this.title
        });
    }
}
