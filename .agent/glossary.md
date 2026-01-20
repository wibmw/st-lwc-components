# Business Glossary

## Attributes & Concepts
- **G2R**: Code site (e.g. on Correctif `Code_site__c`).
- **Mnemonique**: Article identifier (on `Articles__c`).
- **Clé Equipement**: Unique identifier for a piece of equipment (`Cl_quipement__c`).
- **RMA**: Return Merchandise Authorization number (`RMA__c`).
- **BL**: Bon de Livraison / Delivery Note (`N_Bon_Livraison__c`).

## Objects Mapping
| Term | Salesforce Object | Details |
|------|-------------------|---------|
| **Site** | `sitetracker__Site__c` | Represents physical locations or Repairers. |
| **Contact** | `Contact` | Used for `Destinataire` (Shipping Address). |
| **Pièce Unitaire** (PU) | `Pi_ce_Unitaire__c` | Serialized item. Linked to `Articles__c`. |
| **Envoi** | `Envoi_Logistique__c` | A shipment record. Key fields: `Transporteur__c`, `N_Ticket_Correctif__c`. |
| **Commande** | `Commande_Pi_ces__c` | Order record. Parent of Envoi. |
| **Ligne Commande** | `Commande_Pi_ces_D_tails__c` | Line items of an order. |
| **Historique** | `Historique_Pi_ces__c` | History log for parts movement (Types: `ENV`, `PU`). |
| **Ticket / Correctif** | `Correctif__c` | The maintenance ticket initiating the flow. |
| **Job** | `sitetracker__Job__c` | Work order linked to the Ticket. |
| **Article** | `Articles__c` | Product definition. |

## Important Fields (Envoi_Logistique__c)
- **Stock** (`Stock__c`): The **Origin** site of the shipment.
- **Lieu de Destination** (`Lieu_de_Destination__c`): The **Destination** site (e.g., the Repairer workshop).
- **Destinataire** (`Destinataire__c`): The `Contact` record linked to the shipping address.
- **Demandeur** (`Demandeur__c`): The `User` requesting the shipment.

## Business Rules
- **Shipment Validation**:
    - **Valider**: Sets status to `Livraison en Cours`.
    - **Refuser**: Sets status to `Clôturer NOK`.
- **Repair Rules**:
    - All pieces in a "Repair" shipment must belong to the **same Reparateur**.
    - Origin is automatically set to the pieces' current location (`Stock__c`).
    - Destination is automatically set to the pieces' repairer (`Lieu_de_Destination__c`).
- **Read Only**: records are strictly read-only when status includes "Clôturer" (e.g. `Clôturer OK`, `Clôturer NOK`).
- **Mobile**:
    - Mobile detection uses `FORM_FACTOR === 'Large'` check in LWC.
    - Simplified views and "Card" layouts are preferred for mobile.