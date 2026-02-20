# Project Context

## Salesforce Environment
- Org type: [Sandbox]
- Org name: [MNT]
- API Version: 60.0

## Architecture
- Salesforce org: [Sandbox/Production name]
- Namespaces: c (custom), customNamespace__c
- API Version: 60.0

## Project Structure
- LWC Components: force-app/main/default/lwc/
- Apex Classes: force-app/main/default/classes/
- Flows (IL_*): force-app/main/default/flows/ (local copies in /flows/)
- Data Model Doc: .agent/data_model.md
- Shared Apex:
  - Envoi Logistique: force-app/main/default/classes/MntGestionEnvoiLogistiqueCtrl.cls

## Common Patterns We Use
- State management: Plain reactive properties (no @track)
- Error handling: Centralized error service
- API calls: Always through service layer

## Naming Conventions
- Components: camelCase (accountCard)
- Apex: PascalCase + Controller suffix (AccountCardController)
- Custom Objects: PascalCase + __c (Invoice__c)

## Do NOT use
- localStorage/sessionStorage (not available in LWC)
- @track decorator (deprecated)
- document.querySelector (use template.querySelector)

## Common Components Already Built
- mntGestionEnvoiLogistique: Envoi Pièces entre Stock
- mntGestionEnvoiReparationLogistique: Envoi Pièces à un Réparateur de Pièces
- mntGestionDemandeLogistique: Demande d'Envoi de Pièces
- mntFilesManager: Upload and see pictures (used in flows as file attachment)
- trackingModal: Open an Iframe in a modal
- oneClickPrint: Fusionne les fichiers PDF de tous les records sélectionnés
- menuMobile: Afficher un menu de boutons au format mobile dans un flow
- mobileListView: Affiche une listview au format d'une liste de carte contenant les 4 premiers champs
- pillSearch: Lookup/Search component with single or multi-select mode, Flow-compatible (output: selectedRecordId, selectedRecordName, selectedRecordIds, selectedRecordIdsCSV)
- customCardsList: Configurable list view with card format, supports Flow URL navigation

## Technology Stack
- Framework: LWC (Lightning Web Components)
- Styling: SLDS (Salesforce Lightning Design System)
- State: React-like reactive properties
