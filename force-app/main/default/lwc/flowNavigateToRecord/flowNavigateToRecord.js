import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { FlowNavigationFinishEvent } from 'lightning/flowSupport';

/**
 * A Flow component that navigates to a specified record when the Flow finishes.
 * This overrides the default finish behavior of the Flow.
 * 
 * Usage: Add this component to the last screen of a Flow, pass the recordId,
 * and the Flow will redirect to the record page upon completion.
 */
export default class FlowNavigateToRecord extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;
    @api availableActions = [];

    connectedCallback() {
        // Automatically navigate when the component is rendered
        this.navigateAndFinish();
    }

    navigateAndFinish() {
        if (!this.recordId) {
            console.warn('FlowNavigateToRecord: No recordId provided');
            // Just finish the flow without navigation
            this.finishFlow();
            return;
        }

        // Navigate to the record
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: this.objectApiName || '',
                actionName: 'view'
            }
        }).then(() => {
            // Navigation initiated, now finish the flow
            this.finishFlow();
        }).catch((error) => {
            console.error('FlowNavigateToRecord: Navigation error', error);
            // Still finish the flow even if navigation fails
            this.finishFlow();
        });
    }

    finishFlow() {
        // Check if FINISH action is available
        if (this.availableActions && this.availableActions.includes('FINISH')) {
            const finishEvent = new FlowNavigationFinishEvent();
            this.dispatchEvent(finishEvent);
        } else {
            console.log('FlowNavigateToRecord: FINISH action not available, flow may already be complete.');
        }
    }
}
