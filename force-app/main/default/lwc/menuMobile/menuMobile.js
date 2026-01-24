import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';

export default class FlowMenuButtons extends NavigationMixin(LightningElement) {
  @api options;   // JSON: [{ label, value, iconName, url }]
  @api selected;
  @api autoNext = false; 

  get _opts() { 
    try { 
        return JSON.parse(this.options || '[]'); 
    } catch(e) { 
        return []; 
    } 
  }
  
  handleClick(e){
    const idx = Number(e.currentTarget.dataset.index);
    const opt = this._opts[idx];
    
    if (!opt) return;

    this.selected = opt.value;

    // Gestion des liens externes / Deep Links
    if (opt.url) {
        // Ouvre dans le navigateur système (gère les Custom Schemes comme sitetracker://)
        window.location.assign(opt.url);
    }

    // Navigation de Flow (si configuré)
    // On le fait même si on a ouvert un lien, pour passer à l'écran suivant si désiré
    if (this.autoNext) {
        const navigateNextEvent = new FlowNavigationNextEvent();
        this.dispatchEvent(navigateNextEvent);
    }
  }
}
