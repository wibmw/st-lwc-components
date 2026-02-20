# Data Model — MNT Logistics

> Extracted from 24 IL_ Flow XML files. Relationships inferred from field references.

---

## Summary Diagram

```
sitetracker__Site__c (Lieu/Stock/Réparateur)
        │
        ├──(Lieu__c)──────────────────── Pi_ce_Unitaire__c ──(Correctif__c)──► Correctif__c
        │                                        │                                      │
        │                                (Pi_ce_Unitaire__c)                     (Site__r)
        │                                        ▼                                      │
        │                              Historique_Pi_ces__c ◄────────────────────────────┘
        │
        ├──(Stock__c / Lieu_de_Destination__c)── Envoi_Logistique__c ◄── Commande_Pi_ces__c
        │                                                                        │
        │                                                            (Commande__c)
        │                                                                        ▼
        │                                                      Commande_Pi_ces_D_tails__c
        │
        └──(user_site) ──► User ──► sitetracker__Job__c ──► sitetracker__Job_Task__c
```

---

## Custom Objects

### `Pi_ce_Unitaire__c` — Pièce Unitaire (Serialized Part)

Represents a single serialized physical part tracked throughout its lifecycle.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Name | `Name` | Text | Serial/label of the piece |
| Statut | `Statut__c` | Picklist | See statuses below |
| Lieu | `Lieu__c` | Lookup → `sitetracker__Site__c` | Current location (Stock) |
| Lieu Précédent | `Lieu_Pr_c_dent__c` | Lookup → `sitetracker__Site__c` | Previous location |
| Sous-Lieux | `Sous_Lieux__c` | Text | Sub-location within a site |
| Code Article | `Code_Article__c` | Lookup → `Articles__c` | Linked product definition |
| N° Série | `N_Serie__c` | Text | Serial number |
| Clé Équipement | `Cl_quipement__c` | Text | Equipment key identifier |
| RMA | `RMA__c` | Text | RMA number |
| Panne | `Panne__c` | Text | Fault description |
| Correctif | `Correctif__c` | Lookup → `Correctif__c` | Linked maintenance ticket |
| N° Bon Livraison | `N_Bon_Livraison__c` | Text | Delivery note number |
| Pièce HS | `Pi_ce_HS__c` | Boolean | Whether part is Out of Service |
| Date Retour Réparation | `Date_Retour_de_R_paration__c` | DateTime | Date returned from repair |
| INVENTAI | `INVENTAI__c` | Boolean | Inventory flag |

**Statut__c Picklist Values:**
- `En Stock` — Part is in stock, available
- `Installé` — Part has been installed at a site
- `A Retourner` — Part must be returned (e.g. HS part)
- `A Réceptionner` — Part expected to arrive
- `Remplacé ES` — Replaced by Exchange Standard
- `Rebut` — Discarded/scrapped

---

### `Historique_Pi_ces__c` — Historique Pièces (Part History Log)

Immutable log entry recording every state change of a part.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Pièce Unitaire | `Pi_ce_Unitaire__c` | Lookup → `Pi_ce_Unitaire__c` | The part logged |
| Type | `Type__c` | Picklist | `PU` (serialized) or `ENV` (shipment) |
| Statut | `Statut__c` | Text | Status at time of event |
| Lieu | `Lieu__c` | Lookup → `sitetracker__Site__c` | Location at time of event |
| Panne | `Panne__c` | Text | Fault at time of event |
| Correctif | `Correctif__c` | Lookup → `Correctif__c` | Ticket at time of event |
| Remarques | `Remarques__c` | Long Text | Free-text notes / intervention report |
| TRAME | `TRAME__c` | Text | Report template code (e.g. `ECH`, `NTF`) |
| INVENTAI | `INVENTAI__c` | Boolean | Flag set on inventory events |

---

### `Envoi_Logistique__c` — Envoi (Shipment)

A shipment record tracking parts from origin to destination.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Stock | `Stock__c` | Lookup → `sitetracker__Site__c` | **Origin** site |
| Lieu de Destination | `Lieu_de_Destination__c` | Lookup → `sitetracker__Site__c` | **Destination** site |
| Destinataire | `Destinataire__c` | Lookup → `Contact` | Shipping contact |
| Demandeur | `Demandeur__c` | Lookup → `User` | User who requested the shipment |
| Transporteur | `Transporteur__c` | Text/Picklist | Carrier (e.g. Chronopost) |
| N° Ticket Correctif | `N_Ticket_Correctif__c` | Text | Associated ticket number |
| Commande | `Commande__c` | Lookup → `Commande_Pi_ces__c` | Parent order |
| Statut Chronopost | `Statut_Chronopost__c` | Text | Chronopost tracking status |
| Statut Envoi | `Statut_Envoi__c` | Picklist | Shipment status |
| Commentaire Refus | `Commentaire_Refus__c` | Text | Refusal reason |
| Date de Traitement | `Date_de_Traitement__c` | DateTime | Processing date |
| Validated From Flow | `Validated_From_Flow__c` | Boolean | Set when validated via Flow |

**Statut_Envoi__c Picklist Values:**
- `En Préparation` — Being prepared
- `Livraison en Cours` — Shipping in progress (after validation)
- `A Réceptionner` — Awaiting reception by technician
- `Clôturé OK` — Closed successfully
- `Clôturé NOK` — Closed with refusal
- `À Retraiter` — Must be reprocessed

---

### `Commande_Pi_ces__c` — Commande (Order)

An order grouping one or more line items and linked to a shipment.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Statut Commande | `Statut_Commande__c` | Picklist | Order status |
| (others inferred from Envoi relationship) | — | — | — |

---

### `Commande_Pi_ces_D_tails__c` — Détails Commande (Order Line Items)

Line items linked to a `Commande_Pi_ces__c`.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Commande | `Commande__c` | Lookup → `Commande_Pi_ces__c` | Parent order |
| (other fields visible in Notification flow) | — | — | — |

---

### `Articles__c` — Articles (Product Definition)

Non-serialized product catalog. Referenced by `Pi_ce_Unitaire__c`.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Name | `Name` | Text | Article name |
| Mnemonique | `Mnemonique__c` | Text | Article code / short ID used in search |

---

### `Correctif__c` — Correctif (Maintenance Ticket)

The maintenance ticket that initiates most logistics flows.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| ID Ticket Client | `ID_ticket_client__c` | Text | External ticket reference number |
| Site | `Site__r` | Lookup → `sitetracker__Site__c` | Site where work is performed |

---

### `sitetracker__Site__c` — Site (Location)

Used to represent any physical location: technician stock, STR warehouse, customer site, or repairer workshop.

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Name | `Name` | Text | Site label (e.g. `STR01`, `STR13`) |
| Adresse de Livraison Préférée | `Adresse_de_Livraison_Pr_f_r_e__c` | Text | Default delivery address |
| Liste Logisticiens | `Liste_Logisticiens__c` | Text | List of logistics managers |

---

### `sitetracker__Job__c` — Job (Work Order)

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Correctif | `Correctif__r` | Lookup → `Correctif__c` | (traversal via Job Task) |

---

### `sitetracker__Job_Task__c` — Job Task

Individual task within a Job. Used to gate the "Installation Pièce" flow (must be the current active task).

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Job | `sitetracker__Job__c` | Lookup → `sitetracker__Job__c` | Parent job |
| Status | `sitetracker__Status__c` | Text | Task status |

---

### `Contact` — Contact (Standard)

Used as `Destinataire` on `Envoi_Logistique__c` to hold the delivery address.

---

### `User` — User (Standard)

Used as `Demandeur` on `Envoi_Logistique__c`. Also linked to Site in `IL_MNT_MAJ_Infos_Techniciens`.

---

### `Gamme_OP__c` — Gamme OP (SFR module)

Used in `IL_SFR_Envoi_CR_Gamme_OP`. Separate from MNT logistics.

---

### `RAN__c` — RAN (SFR module)

Used in `IL_RAN_PROMA_Cr_ation_Projet_SFR`. Network-related object.

---

## Key Relationship Summary

| Parent | Child | Field |
|--------|-------|-------|
| `Commande_Pi_ces__c` | `Envoi_Logistique__c` | `Commande__c` |
| `Commande_Pi_ces__c` | `Commande_Pi_ces_D_tails__c` | `Commande__c` |
| `sitetracker__Site__c` | `Pi_ce_Unitaire__c` | `Lieu__c`, `Lieu_Pr_c_dent__c` |
| `sitetracker__Site__c` | `Envoi_Logistique__c` | `Stock__c`, `Lieu_de_Destination__c` |
| `Pi_ce_Unitaire__c` | `Historique_Pi_ces__c` | `Pi_ce_Unitaire__c` |
| `Correctif__c` | `Pi_ce_Unitaire__c` | `Correctif__c` |
| `Correctif__c` | `Historique_Pi_ces__c` | `Correctif__c` |
| `Correctif__c` | `sitetracker__Site__c` | `Site__r` |
| `Articles__c` | `Pi_ce_Unitaire__c` | `Code_Article__c` |
| `Contact` | `Envoi_Logistique__c` | `Destinataire__c` |
| `sitetracker__Job__c` | `sitetracker__Job_Task__c` | `sitetracker__Job__c` |

---

## Object Usage by Flow

| Flow | Objects Used |
|------|-------------|
| `IL_MNT_Formulaire_Installation_Pi_ce` | `Pi_ce_Unitaire__c`, `Historique_Pi_ces__c`, `sitetracker__Job_Task__c`, `sitetracker__Job__c`, `ContentDocumentLink` |
| `IL_MNT_Retour_de_R_paration_de_Pi_ce` | `Pi_ce_Unitaire__c`, `Historique_Pi_ces__c` |
| `IL_MNT_Ajout_RMA` | `Pi_ce_Unitaire__c`, `Historique_Pi_ces__c` |
| `IL_MNT_Confirmation_de_R_ception_d_une_Pi_ce_par_un_Tech` | `Commande_Pi_ces__c`, `Envoi_Logistique__c`, `Historique_Pi_ces__c` |
| `IL_MNT_MAJ_Statut_Chronopost` | `Commande_Pi_ces__c`, `Envoi_Logistique__c`, `Historique_Pi_ces__c` |
| `IL_MNT_Pi_ces_contr_ler` | `Pi_ce_Unitaire__c`, `Historique_Pi_ces__c`, `ContentDocumentLink` |
| `IL_MNT_MAJ_Infos_Techniciens` | `sitetracker__Site__c`, `User` |
| `IL_MNT_Cr_ation_d_une_adresse_de_livraison` | `Contact` |
| `IL_MNT_Cr_ation_d_un_Stock` | `sitetracker__Site__c` |
| `IL_MNT_Notification_pour_une_Commande_Refus_e` | `Commande_Pi_ces_D_tails__c`, `CustomNotificationType` |
| `IL_SFR_Envoi_CR_Gamme_OP` | `Gamme_OP__c`, `ContentVersion`, `Contact` |
| `IL_RAN_PROMA_Cr_ation_Projet_SFR` | `RAN__c` |
