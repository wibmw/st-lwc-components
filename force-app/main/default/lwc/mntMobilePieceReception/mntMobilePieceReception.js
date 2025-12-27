import { LightningElement, wire, track, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getPiecesAReceptionner from '@salesforce/apex/MntMobilePieceReceptionCtrl.getPiecesAReceptionner';

export default class MntMobilePieceReception extends NavigationMixin(LightningElement) {
    @api recordId;
    @track pieces = [];
    @track loading = true;

    @wire(getPiecesAReceptionner, { siteId: '$recordId' })
    wiredPieces({ error, data }) {
        this.loading = true;
        if (data) {
            this.pieces = data;
            this.loading = false;
        } else if (error) {
            console.error('Error loading pieces', error);
            this.pieces = [];
            this.loading = false;
        }
    }

    get hasPieces() {
        return this.pieces && this.pieces.length > 0;
    }

    handleCreateDemand() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: '/flow/IL_MNT_Cr_ation_d_une_commande_de_pi_ce'
            }
        });
    }
}
