import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';

export default class FlowMenuButtons extends NavigationMixin(LightningElement) {
  @api options;   // JSON: [{ label, value, iconName, url }]
  @api selected;
  @api autoNext = false; // on navigue, pas besoin d'avancer

  get _opts() { try { return JSON.parse(this.options||'[]'); } catch(e){ return []; } }

  handleClick(e){
    const idx = Number(e.currentTarget.dataset.index);
    const opt = this._opts[idx];
    this.selected = opt?.value;

    if (opt?.url) {
      this[NavigationMixin.Navigate]({
        type: 'standard__webPage',
        attributes: { url: opt.url } // ex: /flow/MOB_Retour_Good?recordId=...
      });
    } else if (this.autoNext) {
      this.dispatchEvent(new FlowNavigationNextEvent());
    }
  }
}
