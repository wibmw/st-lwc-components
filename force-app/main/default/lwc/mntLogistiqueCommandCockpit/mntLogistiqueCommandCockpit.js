import { LightningElement, track } from 'lwc';
import getInventoryAggregatesMulti from '@salesforce/apex/MntLogistiqueCommandCockpitCtrl.getInventoryAggregatesMulti';
import searchSites from '@salesforce/apex/MntLogistiqueCommandCockpitCtrl.searchSites';
import searchArticles from '@salesforce/apex/MntLogistiqueCommandCockpitCtrl.searchArticles';
import createOrder from '@salesforce/apex/MntLogistiqueCommandCockpitCtrl.createOrder';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const COLS_AGG = [
  { label: 'Site', fieldName: 'siteName', type: 'text' },
  { label: 'Article', fieldName: 'articleName', type: 'text' },
  { label: 'Radical', fieldName: 'radical', type: 'text' },
  { label: 'Stock', fieldName: 'stock', type: 'number', cellAttributes: { alignment: 'right' } },
  {
    type: 'button',
    typeAttributes: {
      label: 'Ajouter',
      name: 'add',
      variant: 'brand-outline'
    }
  }
];

const COLS_CART = [
  { label: 'Site', fieldName: 'siteName', type: 'text' },
  { label: 'Article', fieldName: 'articleName', type: 'text' },
  {
    label: 'Quantité',
    fieldName: 'quantity',
    type: 'number',
    editable: true,
    cellAttributes: { alignment: 'right' }
  },
  { label: 'Commentaire', fieldName: 'comment', type: 'text', editable: true },
  {
    type: 'button-icon',
    initialWidth: 50,
    typeAttributes: { iconName: 'utility:delete', name: 'remove', alternativeText: 'Supprimer' }
  }
];

export default class MntLogistiqueCommandCockpit extends LightningElement {
  // Filtres
  @track selectedSiteIds = [];
  @track selectedSitePairs = []; 
  @track selectedArticleValues = [];
  @track selectedArticlePairs = [];

  // Données
  @track rows = [];
  @track loading = false;

  // Panier
  @track cart = [];
  cartCols = COLS_CART;
  aggCols = COLS_AGG;

  // Pagination
  pageSize = 20;
  offset = 0;
  hasMore = true;

  // === Autocomplete Sites ===
  @track siteSearchTerm = '';
  @track isDropdownOpen = false;
  @track isLoadingSites = false;
  @track siteSuggestions = [];
  _searchTimer;

  get comboboxClass() {
    return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isDropdownOpen ? 'slds-is-open' : ''}`;
  }
  get hasSuggestions() {
    return (this.siteSuggestions || []).length > 0;
  }
  get showNoResults() {
    return (
      this.isDropdownOpen &&
      !this.isLoadingSites &&
      this.siteSearchTerm &&
      this.siteSearchTerm.length >= 3 &&
      !this.hasSuggestions
    );
  }

  get selectedPills() {
    return (this.selectedSitePairs || []).map(p => ({ name: p.value, label: p.label }));
  }

  openDropdown = () => {
    this.isDropdownOpen = true;
  };
  closeDropdown = () => {
    window.setTimeout(() => {
      this.isDropdownOpen = false;
    }, 120);
  };

  handleSiteSearchInput(e) {
    this.siteSearchTerm = (e.target.value || '').trim();
    if (this.siteSearchTerm.length >= 3) {
      this.isDropdownOpen = true;
      window.clearTimeout(this._searchTimer);
      this._searchTimer = window.setTimeout(() => this.fetchSites(), 250);
    } else {
      this.siteSuggestions = [];
    }
  }

  async fetchSites() {
    this.isLoadingSites = true;
    try {
      const res = await searchSites({
        term: this.siteSearchTerm,
        excludeIds: this.selectedSiteIds,
        limitSize: 50
      });
      this.siteSuggestions = (res || []).map(r => ({ label: r.label, value: r.value }));
    } catch (e) {
      console.error('searchSites error', e);
      this.siteSuggestions = [];
    } finally {
      this.isLoadingSites = false;
    }
  }

  handleOptionSelect(e) {
    const value = e.currentTarget.dataset.value;
    const label = e.currentTarget.dataset.label;
    
    if (!this.selectedSiteIds.includes(value)) {
      this.selectedSiteIds = [...this.selectedSiteIds, value];
      this.selectedSitePairs = [...this.selectedSitePairs, { label, value }];
    }
    
    this.siteSearchTerm = '';
    this.siteSuggestions = [];
    this.isDropdownOpen = false;
  }

  handlePillRemove(e) {
    const value = e.detail?.item?.name ?? e.detail?.name;

    this.selectedSiteIds = this.selectedSiteIds.filter(v => v !== value);
    this.selectedSitePairs = this.selectedSitePairs.filter(p => p.value !== value);
  }

  // === Autocomplete Articles/Radicaux ===
  @track articleSearchTerm = '';
  @track isDropdownOpenArt = false;
  @track isLoadingArticles = false;
  @track articleSuggestions = [];
  _articleTimer;

  get articleComboboxClass() {
    return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isDropdownOpenArt ? 'slds-is-open' : ''}`;
  }
  get hasArticleSuggestions() {
    return (this.articleSuggestions || []).length > 0;
  }
  get showArticleNoResults() {
    return (
      this.isDropdownOpenArt &&
      !this.isLoadingArticles &&
      this.articleSearchTerm &&
      this.articleSearchTerm.length >= 3 &&
      !this.hasArticleSuggestions
    );
  }
  get articleSelectedPills() {
    return (this.selectedArticlePairs || []).map(p => ({ name: p.value, label: p.label }));
  }

  openArticleDropdown = () => {
    this.isDropdownOpenArt = true;
  };
  closeArticleDropdown = () => {
    window.setTimeout(() => {
      this.isDropdownOpenArt = false;
    }, 120);
  };

  handleArticleSearchInput(e) {
    this.articleSearchTerm = (e.target.value || '').trim();
    if (this.articleSearchTerm.length >= 3) {
      this.isDropdownOpenArt = true;
      window.clearTimeout(this._articleTimer);
      this._articleTimer = window.setTimeout(() => this.fetchArticles(), 250);
    } else {
      this.articleSuggestions = [];
    }
  }

  async fetchArticles() {
    this.isLoadingArticles = true;
    try {
      const res = await searchArticles({
        term: this.articleSearchTerm,
        limitSize: 50
      });
      this.articleSuggestions = res || [];
    } catch (e) {
      console.error('searchArticles error', e);
      this.articleSuggestions = [];
    } finally {
      this.isLoadingArticles = false;
    }
  }

  handleArticleOptionSelect(e) {
    const value = e.currentTarget.dataset.value;
    const label = e.currentTarget.dataset.label;
    if (!this.selectedArticleValues.includes(value)) {
      this.selectedArticleValues = [...this.selectedArticleValues, value];
      this.selectedArticlePairs = [...this.selectedArticlePairs, { label, value }];
    }
    this.articleSearchTerm = '';
    this.articleSuggestions = [];
    this.isDropdownOpenArt = false;
  }

  handleArticlePillRemove(e) {
    const value = e.detail?.item?.name ?? e.detail?.name;
    this.selectedArticleValues = this.selectedArticleValues.filter(v => v !== value);
    this.selectedArticlePairs = this.selectedArticlePairs.filter(p => p.value !== value);
  }

  // === Refresh résultats ===
  async refresh(reset = true) {
    // Bloque si aucun filtre
    if (
      (!this.selectedSiteIds || this.selectedSiteIds.length === 0) &&
      (!this.selectedArticleValues || this.selectedArticleValues.length === 0)
    ) {
      this.rows = [];
      this.hasMore = false;
      return;
    }

    if (reset) {
      this.offset = 0;
      this.rows = [];
    }
    this.loading = true;
    try {
      let res;
      if (      
        (this.selectedSiteIds && this.selectedSiteIds.length > 0) ||
        (this.selectedArticleValues && this.selectedArticleValues.length > 0)
     ) {
        res = await getInventoryAggregatesMulti({
          values: this.selectedArticleValues,
          siteIds: this.selectedSiteIds,
          limitSize: this.pageSize,
          offsetVal: this.offset
        });
      } 

      const data = (res || []).map((r, idx) => ({ ...r, key: `${r.siteId}-${r.articleId}-${idx}` }));
      this.rows = reset ? data : [...this.rows, ...data];
      this.hasMore = data.length === this.pageSize;
    } catch (e) {
      this.toast('Erreur', 'Chargement impossible', 'error');
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  handleApplyFilters() {
    this.refresh(true);
  }

  // === Panier + création commande ===
  handleAggRowAction(e) {
    const row = e.detail.row;
    const key = `${row.siteId}-${row.articleId}`;
    if (this.cart.find(c => c.key === key)) {
      this.toast('Info', 'Déjà dans le panier', 'info');
      return;
    }
    this.cart = [
      ...this.cart,
      {
        key,
        siteId: row.siteId,
        siteName: row.siteName,
        articleId: row.articleId,
        articleName: row.articleName,
        quantity: null,
        comment: ''
      }
    ];
  }

  handleCartAction(e) {
    if (e.detail.action?.name === 'remove') {
      this.cart = this.cart.filter(c => c.key !== e.detail.row.key);
    }
  }

  handleCartSave(e) {
    const drafts = e.detail.draftValues || [];
    const mapDraft = new Map(drafts.map(d => [d.key, d]));
    this.cart = this.cart.map(c => {
      const d = mapDraft.get(c.key);
      return d
        ? {
            ...c,
            ...(d.quantity !== undefined ? { quantity: Number(d.quantity) } : {}),
            ...(d.comment !== undefined ? { comment: d.comment } : {})
          }
        : c;
    });
    const dt = this.template.querySelector('lightning-datatable[data-id=\"cart\"]');
    if (dt) dt.draftValues = [];
  }

  get isDisabled() {
    return !(this.cart.length > 0 && this.cart.every(c => c.quantity && c.quantity > 0));
  }

  async handleCreateOrder() {
    if (this.isDisabled) {
      this.toast('Attention', 'Renseigne une quantité > 0', 'warning');
      return;
    }
    const globalComment = this.template.querySelector('lightning-textarea[data-id=\"globalCmt\"]')?.value || '';
    try {
      this.loading = true;
      const input = {
        orderName: null,
        globalComment,
        lines: this.cart.map(c => ({
          siteId: c.siteId,
          articleId: c.articleId,
          quantity: c.quantity,
          comment: c.comment
        }))
      };
      const orderId = await createOrder({ input });
      this.toast('Succès', 'Commande créée: ' + orderId, 'success');
      this.cart = [];
    } catch (e) {
      console.error(e);
      this.toast('Erreur', e?.body?.message || 'Erreur création', 'error');
    } finally {
      this.loading = false;
    }
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
