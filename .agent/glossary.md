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
| **Ticket / Correctif** | `Correctif__c` | The maintenance ticket initiating the flow. Links to Site via `Site__r`. |
| **Job** | `sitetracker__Job__c` | Work order linked to the Ticket. |
| **Job Task** | `sitetracker__Job_Task__c` | Individual task within a Job. Used to gate installation flow. |
| **Article** | `Articles__c` | Product definition. Searchable by `Name` + `Mnemonique__c`. |
| **Gamme OP** | `Gamme_OP__c` | SFR-specific operational range. Used in SFR flows only. |
| **RAN** | `RAN__c` | SFR-specific network object. Used in SFR project creation flows. |

## Important Fields (Envoi_Logistique__c)
- **Stock** (`Stock__c`): The **Origin** site of the shipment.
- **Lieu de Destination** (`Lieu_de_Destination__c`): The **Destination** site (e.g., the Repairer workshop).
- **Destinataire** (`Destinataire__c`): The `Contact` record linked to the shipping address.
- **Demandeur** (`Demandeur__c`): The `User` requesting the shipment.

## Business Rules
- **Statut__c (Pi_ce_Unitaire__c)**:
    - `En Stock` — Available at a stock location.
    - `Installé` — Installed at a customer site.
    - `A Retourner` — Must be returned (faulty / HS in its box).
    - `A Réceptionner` — Expected arrival.
    - `Remplacé ES` — Replaced by standard exchange (ECH).
    - `Rebut` — Discarded/scrapped.
- **Historique Types** (`Type__c`):
    - `PU` — Physical part movement event.
    - `ENV` — Shipment-level event.
- **Réparation Types** (used in `Retour de Réparation` flow):
    - `NTF` / `REPARE` — Part returned repaired or No Trouble Found.
    - `ECH` — Echange Standard: original part gets `Remplacé ES`, a new part is created.
    - `Rebut` — Part is scrapped.
- **Shipment Validation**:
    - **Valider**: Sets status to `Livraison en Cours`.
    - **Refuser**: Sets status to `Clôturer NOK`.
- **Repair Rules**:
    - All pieces in a "Repair" shipment must belong to the **same Reparateur**.
    - Origin is automatically set to the pieces' current location (`Stock__c`).
    - Destination is automatically set to the pieces' repairer (`Lieu_de_Destination__c`).
- **Read Only**: records are strictly read-only when status includes "Clôturer" (e.g. `Clôturer OK`, `Clôturer NOK`).
- **Job Task Gate**: `IL_MNT_Formulaire_Installation_Pièce` blocks if the current Job Task is already completed.
- **Mobile**:
    - Mobile detection uses `FORM_FACTOR === 'Large'` check in LWC.
    - Simplified views and "Card" layouts are preferred for mobile.
