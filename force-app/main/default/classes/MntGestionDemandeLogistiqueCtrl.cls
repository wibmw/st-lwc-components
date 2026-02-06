public without sharing class MntGestionDemandeLogistiqueCtrl {

    // --- CLASSES DE DONNÉES (WRAPPERS) ---

    public class IdLabel {
        @AuraEnabled public String value;
        @AuraEnabled public String label;
        @AuraEnabled public String sublabel;
        @AuraEnabled public String description;
        @AuraEnabled public String address;
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        @AuraEnabled public String compteProjet;
    }

    public class AggregationRow {
        @AuraEnabled public String siteId;
        @AuraEnabled public String siteName;
        @AuraEnabled public String siteNomDuSite;
        @AuraEnabled public String articleId;
        @AuraEnabled public String articleName;
        @AuraEnabled public Decimal stock;
        @AuraEnabled public String mnemonique;
        @AuraEnabled public String description;
    }

    public class OrderLineInput {
        @AuraEnabled public Id siteId;
        @AuraEnabled public Id articleId;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public String comment;
        @AuraEnabled public String statut;
        @AuraEnabled public String commentaireRefus;
        @AuraEnabled public Id detailId;
        @AuraEnabled public String typeLigne;
    }
    
    public class OrderLineOutput {
        @AuraEnabled public Id siteId;
        @AuraEnabled public String siteName;
        @AuraEnabled public String siteNomDuSite;
        @AuraEnabled public Id articleId;
        @AuraEnabled public String articleName;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public String comment;
        @AuraEnabled public String statut;
        @AuraEnabled public String commentaireRefus;
        @AuraEnabled public Id detailId;
        @AuraEnabled public String typeLigne;
        @AuraEnabled public String mnemonique;
        @AuraEnabled public String description;
    }

    public class OrderInput {
        @AuraEnabled public Id orderId;
        @AuraEnabled public Id nTicketCorrectifId;
        @AuraEnabled public String globalComment;
        @AuraEnabled public List<OrderLineInput> lines;
        @AuraEnabled public Id demandeurId;
        @AuraEnabled public Id lieuId;
        @AuraEnabled public String compteProjet;
        @AuraEnabled public Id adresseLivraisonId;
        @AuraEnabled public String typeLigneContext; // 'Cockpit' or 'Technicien'
    }

    public class InitialDataWrapper {
        @AuraEnabled public Id currentUserId;
        @AuraEnabled public String currentUserName;
        @AuraEnabled public Id nTicketCorrectifId;
        @AuraEnabled public String nTicketName;
        @AuraEnabled public String nTicketSubLabel;
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        @AuraEnabled public Id lieuId;
        @AuraEnabled public String lieuName;
        @AuraEnabled public String lieuNomDuSite;

        @AuraEnabled public String pillLabels;
        @AuraEnabled public String userCompteProjet;
    }

    public class OrderDetailsWrapper {
        @AuraEnabled public Id nTicketCorrectifId;
        @AuraEnabled public String nTicketName;
        @AuraEnabled public String nTicketSubLabel;
        @AuraEnabled public String globalComment;
        @AuraEnabled public List<OrderLineOutput> lines;
        @AuraEnabled public Id demandeurId;
        @AuraEnabled public String demandeurName;
        @AuraEnabled public String demandeurPhone;
        @AuraEnabled public Id lieuId;
        @AuraEnabled public String lieuName;
        @AuraEnabled public String lieuNomDuSite;
        @AuraEnabled public String pillLabels;
        @AuraEnabled public String compteProjet;
        @AuraEnabled public Id adresseLivraisonId;
        @AuraEnabled public String adresseLivraisonName;
        @AuraEnabled public String adresseLivraisonFull;
        @AuraEnabled public DateTime createdDate;
        @AuraEnabled public String createdByName;
        @AuraEnabled public String status;
        @AuraEnabled public DateTime pecCockpitDate;
        @AuraEnabled public String pecCockpitBy;
        @AuraEnabled public DateTime pecRetraitementDate;
        @AuraEnabled public String pecRetraitementBy;
        @AuraEnabled public String ticketPriority;
        @AuraEnabled public String ticketStatus;
        @AuraEnabled public String typeReception;
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        public OrderDetailsWrapper() { this.lines = new List<OrderLineOutput>(); }
    }

    // --- MÉTHODES APEX ---

    @AuraEnabled(cacheable=true)
    public static InitialDataWrapper getInitialData(Id nTicketId, Id recordId, String sObjectType, Boolean isMobile) {
        InitialDataWrapper data = new InitialDataWrapper();
        data.currentUserId = UserInfo.getUserId();
        String currentUserName = UserInfo.getName();
        data.currentUserName = currentUserName;

        // Récupérer le Compte Projet du User pour le mobile
        try {
            User u = [SELECT Compte_Projet_Logistique__c FROM User WHERE Id = :data.currentUserId LIMIT 1];
            data.userCompteProjet = u.Compte_Projet_Logistique__c;
        } catch (Exception e) {
            System.debug('Error querying User Compte Projet: ' + e.getMessage());
        }

        System.debug('Tech Name: ' + currentUserName);

        Id ticketIdToUse = nTicketId;

        if (isMobile == true) {
            // Handle Job context to resolve Ticket ID
            if (sObjectType == 'sitetracker__Job__c' && recordId != null) {
                List<sitetracker__Job__c> jobs = [SELECT Correctif__c FROM sitetracker__Job__c WHERE Id = :recordId LIMIT 1];
                if (!jobs.isEmpty()) {
                    ticketIdToUse = jobs[0].Correctif__c;
                }
            } else if (sObjectType == 'Correctif__c' && recordId != null) {
                 ticketIdToUse = recordId;
            }

            if (ticketIdToUse != null) {
                List<Correctif__c> tickets = [
                    SELECT ID_ticket_client__c, Code_site__c, Nom_du_site__c, Site__c, Site__r.Name, Site__r.Nom_du_site__c
                    FROM Correctif__c
                    WHERE Id = :ticketIdToUse
                    LIMIT 1
                ];
                if (!tickets.isEmpty()) {
                    Correctif__c t = tickets[0];
                    data.nTicketCorrectifId = t.Id;
                    data.nTicketName = t.ID_ticket_client__c;
                    data.g2r = t.Code_site__c;
                    data.siteName = t.Nom_du_site__c;
                    
                    data.nTicketSubLabel = formatTicketSublabel(t.Code_site__c, t.Nom_du_site__c);
                }
            }
        }

        // LOGIQUE MOBILE SPÉCIFIQUE
        System.debug('Mobile Context Check - isMobile: ' + isMobile);
        if (isMobile == true) {
            String searchName = 'STE-%';
            String searchLogist = '%' + currentUserName + '%';
            
            System.debug('Searching Site with Name LIKE: ' + searchName);
            System.debug('Searching Site with Logistician LIKE: ' + searchLogist);
            
            List<sitetracker__Site__c> mobileSites = [
                SELECT Id, Name, Nom_du_site__c 
                FROM sitetracker__Site__c 
                WHERE Name LIKE :searchName 
                AND RecordType.DeveloperName = 'CIRCET'
                AND Liste_Logisticiens__c LIKE :searchLogist
                LIMIT 1
            ];

            System.debug('Mobile Sites Found: ' + mobileSites.size());

            if (!mobileSites.isEmpty()) {
                sitetracker__Site__c site = mobileSites[0];
                System.debug('Site Found: ' + site.Name + ' (' + site.Id + ')');
                data.lieuId = site.Id;
                data.lieuName = site.Name;
                data.lieuNomDuSite = site.Nom_du_site__c;
                data.pillLabels = (site.Name != null ? site.Name : '') + (String.isNotBlank(site.Nom_du_site__c) ? ' - ' + site.Nom_du_site__c : '');
            }
        }

        return data;
    }

    @AuraEnabled(cacheable=true)
    public static List<IdLabel> searchRecords(String searchTerm, String sObjectType) {
        String queryTerm = '%' + searchTerm + '%';
        String sObjectName = String.escapeSingleQuotes(sObjectType);
        String query;

        if (sObjectType == 'User') {
            query = 'SELECT Id, Name, Phone FROM User WHERE Name LIKE :queryTerm AND IsActive = true ORDER BY Name LIMIT 10';
        } else if (sObjectType == 'Contact') {
            query = 'SELECT Id, Name, MailingStreet, MailingCity, MailingPostalCode, MailingState, MailingCountry FROM Contact WHERE Name LIKE :queryTerm ORDER BY Name LIMIT 10';
        } else if (sObjectType == 'sitetracker__Site__c') {
            query = 'SELECT Id, Name, Nom_du_site__c FROM sitetracker__Site__c WHERE (Name LIKE :queryTerm OR Nom_du_site__c LIKE :queryTerm) AND RecordType.DeveloperName = \'CIRCET\' AND Type_de_Stock__c = \'Stock\' ORDER BY Name LIMIT 10';
        } else if (sObjectType == 'Correctif__c') {
            query = 'SELECT Id, Name, ID_ticket_client__c, Code_site__c, Nom_du_site__c FROM Correctif__c WHERE ID_ticket_client__c LIKE :queryTerm OR Code_site__c LIKE :queryTerm ORDER BY ID_ticket_client__c, Code_site__c LIMIT 10';
        }

        List<IdLabel> results = new List<IdLabel>();
        for (SObject record : Database.query(query)) {
            IdLabel il = new IdLabel();
            il.value = (Id)record.get('Id');
            il.label = (String)record.get('Name');
            if (sObjectType == 'User') {
                il.sublabel = (String)record.get('Phone');
            } else if (sObjectType == 'Contact') {
                String street = (String)record.get('MailingStreet');
                String city = (String)record.get('MailingCity');
                String postalCode = (String)record.get('MailingPostalCode');
                List<String> addressParts = new List<String>();
                if (String.isNotBlank(street)) addressParts.add(street);
                if (String.isNotBlank(postalCode) || String.isNotBlank(city)) {
                    addressParts.add((postalCode != null ? postalCode : '') + ' ' + (city != null ? city : ''));
                }
                il.sublabel = String.join(addressParts, ', ');
                il.address = String.join(addressParts, '\n');
            } else if (sObjectType == 'sitetracker__Site__c') {
                il.label = (String)record.get('Name');
                il.sublabel = (String)record.get('Nom_du_site__c');
            } else if (sObjectType == 'Correctif__c') {
                il.label = (String)record.get('ID_ticket_client__c');
                String codeSite = (String)record.get('Code_site__c');
                String nomSite = (String)record.get('Nom_du_site__c');
                il.sublabel = formatTicketSublabel(codeSite, nomSite);
                il.g2r = codeSite;
                il.siteName = nomSite;
            }

            results.add(il);
        }
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<IdLabel> searchArticles(String term, Integer limitSize, Boolean includePieces) {
        List<IdLabel> results = new List<IdLabel>();
        if (String.isBlank(term) || term.length() < 2) { return results; }

        String soqlTerm = '%' + term + '%';
        String soslTerm = '*' + term + '*';
        Set<Id> articleIds = new Set<Id>();
        
        // Extended limit for internal queries
        Integer queryLimit = (limitSize != null && limitSize > 0) ? limitSize * 5 : 50;

        // 1. SOQL on Articles (Name, Mnemonique) - Description is excluded from SOQL due to Long Text Area validation
        for (Articles__c art : [
            SELECT Id 
            FROM Articles__c 
            WHERE Name LIKE :soqlTerm 
               OR Mnemonique__c LIKE :soqlTerm 
            LIMIT :limitSize
        ]) {
            articleIds.add(art.Id);
        }

        // 2. SOQL on Pieces (Name, Mnemonique)
        if (includePieces == true) {
            for (Pi_ce_Unitaire__c piece : [
                SELECT Code_Article__c 
                FROM Pi_ce_Unitaire__c 
                WHERE Code_Article__c != null 
                  AND (Name LIKE :soqlTerm OR Mn_monique__c LIKE :soqlTerm)
                LIMIT :limitSize
            ]) {
                articleIds.add(piece.Code_Article__c);
            }
        }
        
        // 3. SOSL for Description matches (and general catch-all)
        // This handles the Description field which cannot be filtered in SOQL
        List<List<SObject>> searchList;
        if (includePieces == true) {
            searchList = [FIND :soslTerm IN ALL FIELDS RETURNING Articles__c(Id), Pi_ce_Unitaire__c(Code_Article__c) LIMIT :queryLimit];
            if (!searchList.isEmpty()) {
                for (Articles__c art : (List<Articles__c>)searchList[0]) articleIds.add(art.Id);
                if (searchList.size() > 1) {
                    for (Pi_ce_Unitaire__c piece : (List<Pi_ce_Unitaire__c>)searchList[1]) {
                        if (piece.Code_Article__c != null) articleIds.add(piece.Code_Article__c);
                    }
                }
            }
        } else {
            searchList = [FIND :soslTerm IN ALL FIELDS RETURNING Articles__c(Id) LIMIT :queryLimit];
            if (!searchList.isEmpty()) {
                for (Articles__c art : (List<Articles__c>)searchList[0]) articleIds.add(art.Id);
            }
        }

        if (!articleIds.isEmpty()) {
            // Re-query full details for the unique set of Articles
            // We use the same LIMIT as a safeguard, but since we already limited SOSL using limitSize, 
            // the number of IDs should be reasonable. However, SOSL limit is per object type, so we might have more.
            // We'll re-apply limit.
             for (Articles__c art : [SELECT Id, Name, Mnemonique__c, Description__c FROM Articles__c WHERE Id IN :articleIds ORDER BY Name]) {
                IdLabel il = new IdLabel();
                il.value = art.Id;
                il.label = art.Name;
                il.sublabel = art.Mnemonique__c;
                il.description = art.Description__c;
                results.add(il);
            }
        }
        
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<AggregationRow> getInventoryAggregatesMulti(List<Id> articleIds, Integer limitSize, Integer offsetVal, Boolean groupBySite) {
        if (articleIds == null || articleIds.isEmpty()) { return new List<AggregationRow>(); }
        
        List<AggregationRow> results = new List<AggregationRow>();
        
        if (groupBySite == null || groupBySite == true) {
            // Desktop behavior: Group by Site + Article
            List<AggregateResult> aggResults = [
                SELECT Lieu__c siteId, Lieu__r.Name siteName, Lieu__r.Nom_du_site__c siteNom, Code_Article__c articleId, Code_Article__r.Name articleName, Code_Article__r.Mnemonique__c mnemonique, COUNT(Id) stock
                FROM Pi_ce_Unitaire__c WHERE Code_Article__c IN :articleIds AND Statut__c = 'En Stock'
                GROUP BY Lieu__c, Lieu__r.Name, Lieu__r.Nom_du_site__c, Code_Article__c, Code_Article__r.Name, Code_Article__r.Mnemonique__c
                ORDER BY Lieu__r.Name, Code_Article__r.Name LIMIT :limitSize OFFSET :offsetVal
            ];

            // Descriptions for desktop
            Map<Id, String> articleDescriptionMap = new Map<Id, String>();
            Set<Id> foundArticleIds = new Set<Id>();
            for (AggregateResult ar : aggResults) {
                foundArticleIds.add((Id)ar.get('articleId'));
            }
            if (!foundArticleIds.isEmpty()) {
                for (Articles__c art : [SELECT Id, Description__c FROM Articles__c WHERE Id IN :foundArticleIds]) {
                    articleDescriptionMap.put(art.Id, art.Description__c);
                }
            }

            for (AggregateResult ar : aggResults) {
                AggregationRow row = new AggregationRow();
                row.siteId = (Id)ar.get('siteId');
                row.siteName = (String)ar.get('siteName');
                row.siteNomDuSite = (String)ar.get('siteNom');
                row.articleId = (Id)ar.get('articleId');
                row.articleName = (String)ar.get('articleName');
                row.stock = (Decimal)ar.get('stock');
                row.mnemonique = (String)ar.get('mnemonique');
                row.description = articleDescriptionMap.get(row.articleId);
                results.add(row);
            }
        } else {
            // Mobile behavior: Query Articles directly (No aggregation needed)
            List<Articles__c> articles = [
                SELECT Id, Name, Mnemonique__c, Description__c
                FROM Articles__c WHERE Id IN :articleIds
                ORDER BY Name LIMIT :limitSize OFFSET :offsetVal
            ];

            for (Articles__c art : articles) {
                AggregationRow row = new AggregationRow();
                row.articleId = art.Id;
                row.articleName = art.Name;
                row.mnemonique = art.Mnemonique__c;
                row.description = art.Description__c;
                row.stock = 1; // Default or 0, stock concept is not same here
                results.add(row);
            }
        }
        
        return results;
    }

    @AuraEnabled
    public static OrderDetailsWrapper getOrderDetails(Id orderId) {
        OrderDetailsWrapper result = new OrderDetailsWrapper();
        Commande_Pi_ces__c order = [
            SELECT Id, N_Ticket_Correctif__c, N_Ticket_Correctif__r.ID_ticket_client__c, N_Ticket_Correctif__r.Code_site__c, N_Ticket_Correctif__r.Nom_du_site__c, N_Ticket_Correctif__r.Priorit__c, N_Ticket_Correctif__r.Statut_ticket__c, Commentaire__c, Demandeur__c, Demandeur__r.Name, 
                   Compte_Projet__c, Adresse_de_Livraison__c, Adresse_de_Livraison__r.Name, Demandeur__r.Phone, Lieu__c, Lieu__r.Name, Lieu__r.Nom_du_site__c,
                    Adresse_de_Livraison__r.MailingStreet, Adresse_de_Livraison__r.MailingCity, Adresse_de_Livraison__r.MailingPostalCode, CreatedDate, CreatedBy.Name,
                     Statut_Commande__c, PEC_Cockpit__c, Nom_PEC_Cockpit__r.Name, PEC_Retraitement__c, Nom_PEC_Retraitement__r.Name, Type_de_R_ception__c,
                     (SELECT Id, Lieu__c, Lieu__r.Name, Lieu__r.Nom_du_site__c, Code_Articles__c, Code_Articles__r.Name, Code_Articles__r.Mnemonique__c, Code_Articles__r.Description__c, Quantit__c, Commentaire__c, Statut_Commande__c, Commentaire_Refus__c, Type_Ligne__c FROM D_tails_Commandes_Pi_ces__r)
            FROM Commande_Pi_ces__c WHERE Id = :orderId LIMIT 1
        ];
        result.nTicketCorrectifId = order.N_Ticket_Correctif__c;
        if (order.N_Ticket_Correctif__c != null) {
            result.nTicketName = order.N_Ticket_Correctif__r.ID_ticket_client__c;
            result.nTicketSubLabel = order.N_Ticket_Correctif__r.Code_site__c;
            result.g2r = order.N_Ticket_Correctif__r.Code_site__c;
            result.siteName = order.N_Ticket_Correctif__r.Nom_du_site__c;
            result.ticketPriority = order.N_Ticket_Correctif__r.Priorit__c;
            result.ticketStatus = order.N_Ticket_Correctif__r.Statut_ticket__c;
        } 
        result.globalComment = order.Commentaire__c;
        result.demandeurId = order.Demandeur__c;
        result.demandeurName = order.Demandeur__r.Name;
        result.demandeurPhone = order.Demandeur__r.Phone;
        result.lieuId = order.Lieu__c;
        result.lieuName = order.Lieu__r.Name;
        result.lieuNomDuSite = order.Lieu__r.Nom_du_site__c;
        result.pillLabels = order.Lieu__r.Name + ' - ' + order.Lieu__r.Nom_du_site__c;
        result.compteProjet = order.Compte_Projet__c;
        result.adresseLivraisonId = order.Adresse_de_Livraison__c;
        result.adresseLivraisonName = order.Adresse_de_Livraison__r.Name;
        result.adresseLivraisonFull = formatAddress(order.Adresse_de_Livraison__r.MailingStreet, order.Adresse_de_Livraison__r.MailingPostalCode, order.Adresse_de_Livraison__r.MailingCity);
        result.createdDate = order.CreatedDate;
        result.createdByName = order.CreatedBy.Name;
        result.status = order.Statut_Commande__c;
        result.pecCockpitDate = order.PEC_Cockpit__c;
        result.pecCockpitBy = order.Nom_PEC_Cockpit__r.Name;
        result.pecRetraitementDate = order.PEC_Retraitement__c;
        result.pecRetraitementBy = order.Nom_PEC_Retraitement__r.Name;
        result.typeReception = order.Type_de_R_ception__c;
        for (Commande_Pi_ces_D_tails__c detail : order.D_tails_Commandes_Pi_ces__r) {
            OrderLineOutput line = new OrderLineOutput();
            line.siteId = detail.Lieu__c;
            line.siteName = detail.Lieu__r.Name;
            line.siteNomDuSite = detail.Lieu__r.Nom_du_site__c; 
            line.articleId = detail.Code_Articles__c;
            line.articleName = detail.Code_Articles__r.Name;
            line.quantity = detail.Quantit__c;
            line.comment = detail.Commentaire__c;
            line.statut = detail.Statut_Commande__c;
            line.commentaireRefus = detail.Commentaire_Refus__c;
            line.detailId = detail.Id;
            line.typeLigne = detail.Type_Ligne__c;
            line.mnemonique = detail.Code_Articles__r.Mnemonique__c;
            line.description = detail.Code_Articles__r.Description__c;
            result.lines.add(line);
        }
        return result;
    }

    @AuraEnabled
    public static Id createOrder(String inputJSON) {
        try {
            OrderInput input = (OrderInput) JSON.deserialize(inputJSON, OrderInput.class);
            if (input == null || input.lines == null || input.lines.isEmpty()) { throw new AuraHandledException('Aucune ligne de commande fournie.'); }
            
            Commande_Pi_ces__c newOrder = new Commande_Pi_ces__c(
                N_Ticket_Correctif__c = input.nTicketCorrectifId,
                Commentaire__c = input.globalComment,
                Demandeur__c = input.demandeurId,
                Lieu__c = input.lieuId,
                Compte_Projet__c = input.compteProjet,
                Adresse_de_Livraison__c = input.adresseLivraisonId
            );
            insert newOrder;

            // 1. Ensure Envois exist (and get map)
            Map<String, Id> siteToEnvoiIdMap = ensureEnvoisExist(newOrder.Id, input.lines, input.adresseLivraisonId, input.nTicketCorrectifId, input.demandeurId, input.lieuId);

            // 2. Create Lines
            List<Commande_Pi_ces_D_tails__c> orderDetails = new List<Commande_Pi_ces_D_tails__c>();
            for (OrderLineInput line : input.lines) {
                Id envoiId = (line.typeLigne == 'Cockpit' && line.siteId != null) ? siteToEnvoiIdMap.get(line.siteId) : null;
                orderDetails.add(new Commande_Pi_ces_D_tails__c(
                    Commande_Pi_ces__c = newOrder.Id, 
                    Lieu__c = line.siteId, 
                    Code_Articles__c = line.articleId,
                    Quantit__c = line.quantity, 
                    Commentaire__c = line.comment, 
                    Type_Ligne__c = line.typeLigne,
                    Envoi_Logistique__c = envoiId,
                    Statut_Commande__c = line.statut
                ));
            }
            insert orderDetails;

            // 3. Notifications
            try {
                sendNotificationsToLogisticians(newOrder.Id);
            } catch (Exception e) {
                System.debug('Error in sendNotificationsToLogisticians: ' + e.getMessage());
            }
            return newOrder.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Erreur lors de la création de la commande : ' + e.getMessage() + ' ' + e.getStackTraceString());
        }
    }

    @AuraEnabled
    public static void updatePec(Id orderId, String pecType) {
        Commande_Pi_ces__c orderToUpdate = new Commande_Pi_ces__c(Id = orderId);
        if (pecType == 'Cockpit') {
            orderToUpdate.PEC_Cockpit__c = DateTime.now();
            orderToUpdate.Nom_PEC_Cockpit__c = UserInfo.getUserId();
            orderToUpdate.Statut_Commande__c = 'PEC Cockpit'; 
        } else if (pecType == 'Retraitement') {
            orderToUpdate.PEC_Retraitement__c = DateTime.now();
            orderToUpdate.Nom_PEC_Retraitement__c = UserInfo.getUserId();
            orderToUpdate.Statut_Commande__c = 'PEC Retraitement'; 
        }
        // 1. Update with Bypass = true
        orderToUpdate.Bypass_ValidationRules__c = true;
        update orderToUpdate;

        // 2. Reset Bypass = false
        orderToUpdate.Bypass_ValidationRules__c = false;
        update orderToUpdate;
    }

    @AuraEnabled
    public static Map<String, Id> updateOrder(String inputJSON) {
        try {
            OrderInput input = (OrderInput) JSON.deserialize(inputJSON, OrderInput.class);
            Map<String, Id> clientKeyToNewIdMap = new Map<String, Id>();
            
            // 0. Récupérer le statut actuel de la commande pour la logique de transition
            Commande_Pi_ces__c currentOrder = [SELECT Id, Statut_Commande__c FROM Commande_Pi_ces__c WHERE Id = :input.orderId LIMIT 1];
            String currentStatus = currentOrder.Statut_Commande__c;
            
            // 1. Update Header with Bypass
            Commande_Pi_ces__c orderToUpdate = new Commande_Pi_ces__c(
                Id = input.orderId, 
                N_Ticket_Correctif__c = input.nTicketCorrectifId, 
                Commentaire__c = input.globalComment,
                Demandeur__c = input.demandeurId, 
                Lieu__c = input.lieuId,
                Compte_Projet__c = input.compteProjet, 
                Adresse_de_Livraison__c = input.adresseLivraisonId,
                Bypass_ValidationRules__c = true
            );
            
            // Logique de transition de statut : si le statut est 'PEC Cockpit' ou 'PEC Retraitement'
            // et qu'il y a des lignes dans le panier, on passe à 'Commande en Cours'
            if (input.lines != null && !input.lines.isEmpty()) {
                if (currentStatus == 'PEC Cockpit' || currentStatus == 'PEC Retraitement') {
                    orderToUpdate.Statut_Commande__c = 'Commande en Cours';
                }
            } else {
                // If cart is empty, set status to 'À Retraiter'
                // User requirement: "si on enregistre le panier sans ligne, on passe au statut 'À Retraiter'"
                if (currentStatus != 'Nouveau' && currentStatus != 'PEC Cockpit' && currentStatus != 'PEC Retraitement') {
                    orderToUpdate.Statut_Commande__c = 'À Retraiter';
                }
            }
            
            update orderToUpdate;

            // Reset Bypass
            orderToUpdate.Bypass_ValidationRules__c = false;
            update orderToUpdate;

            // 2. Ensure Envois exist
            Map<String, Id> siteToEnvoiIdMap = ensureEnvoisExist(input.orderId, input.lines, input.adresseLivraisonId, input.nTicketCorrectifId, input.demandeurId, input.lieuId);

            // 3. Sync Lines (Create/Update/Delete)
            clientKeyToNewIdMap = syncOrderLines(input.orderId, input.lines, siteToEnvoiIdMap, input.typeLigneContext);

            // 4. Notifications
            sendNotificationsToLogisticians(input.orderId);

            return clientKeyToNewIdMap;
        } catch (Exception e) {
            throw new AuraHandledException('Erreur lors de la mise à jour de la commande : ' + e.getMessage() + ' ' + e.getStackTraceString());
        }
    }

    // --- HELPER METHODS FOR FORMATTING ---

    private static String formatTicketSublabel(String codeSite, String nomSite) {
        List<String> parts = new List<String>();
        if (String.isNotBlank(codeSite)) parts.add(codeSite);
        if (String.isNotBlank(nomSite)) parts.add(nomSite);
        return String.join(parts, ' - ');
    }

    private static String formatAddress(String street, String postalCode, String city) {
        List<String> addressParts = new List<String>();
        if (String.isNotBlank(street)) addressParts.add(street);
        if (String.isNotBlank(postalCode) || String.isNotBlank(city)) {
            addressParts.add((postalCode != null ? postalCode : '') + ' ' + (city != null ? city : ''));
        }
        return String.join(addressParts, '\n');
    }

    // --- HELPER METHODS FOR LOGIC ---

    private static Map<String, Id> ensureEnvoisExist(Id orderId, List<OrderLineInput> lines, Id adresseLivraisonId, Id nTicketId, Id demandeurId, Id lieuDestinationId) {
        Map<String, Id> envoiMap = new Map<String, Id>(); // Key can be 'SITEID' or 'SITEID-ARTICLEID'
        
        // Fetch existing Envois
        Map<Id, Envoi_Logistique__c> existingEnvoisMap = new Map<Id, Envoi_Logistique__c>(
            [SELECT Id, Stock__c, Lieu_de_Destination__c FROM Envoi_Logistique__c WHERE Commande_Pi_ces__c = :orderId]
        );
        
        // Priority 1: Map by Stock (Default)
        for (Envoi_Logistique__c envoi : existingEnvoisMap.values()) {
            if (envoi.Stock__c != null) {
                envoiMap.put(String.valueOf(envoi.Stock__c), envoi.Id);
            } else if (envoi.Lieu_de_Destination__c != null) {
                 envoiMap.put(String.valueOf(envoi.Lieu_de_Destination__c), envoi.Id);
            }
        }
            
        // Priority 2: Map by Stock+Article for specific affinity
        if (!existingEnvoisMap.isEmpty()) {
            for (Commande_Pi_ces_D_tails__c detail : [
                SELECT Envoi_Logistique__c, Code_Articles__c 
                FROM Commande_Pi_ces_D_tails__c 
                WHERE Envoi_Logistique__c IN :existingEnvoisMap.keySet()
                  AND Code_Articles__c != null
            ]) {
                Envoi_Logistique__c envoi = existingEnvoisMap.get(detail.Envoi_Logistique__c);
                if (envoi != null) {
                    // Safety check if Stock/Destination is missing on Envoi (rare but possible)
                    String siteKey = (envoi.Stock__c != null ? String.valueOf(envoi.Stock__c) : String.valueOf(envoi.Lieu_de_Destination__c));
                    if (siteKey != null) {
                        String key = siteKey + '-' + detail.Code_Articles__c;
                        envoiMap.put(key, envoi.Id);
                    }
                }
            }
        }

        // Identify and Create missing
        Set<Id> sitesNeedingEnvoi = new Set<Id>();
        if (lines != null) {
            for (OrderLineInput line : lines) {
                if (line.typeLigne == 'Cockpit' && line.siteId != null) {
                     // Check specific then generic
                     String keySpecific = line.siteId + '-' + line.articleId;
                     String keyGeneric = String.valueOf(line.siteId);
                     
                     if (!envoiMap.containsKey(keySpecific) && !envoiMap.containsKey(keyGeneric)) {
                        sitesNeedingEnvoi.add(line.siteId);
                     }
                }
            }
        }

        if (!sitesNeedingEnvoi.isEmpty()) {
            List<Envoi_Logistique__c> newEnvois = new List<Envoi_Logistique__c>();
            for (Id siteId : sitesNeedingEnvoi) {
                newEnvois.add(new Envoi_Logistique__c(
                    Commande_Pi_ces__c = orderId,
                    Destinataire__c = adresseLivraisonId,
                    Stock__c = siteId, // Used as Key
                    N_Ticket_Correctif__c = nTicketId,
                    Statut__c = 'Commande à Traiter',
                    Type__c = 'Autre Stock',
                    Demandeur__c = demandeurId,
                    Lieu_de_Destination__c = lieuDestinationId
                ));
            }
            insert newEnvois;
            for (Envoi_Logistique__c envoi : newEnvois) {
                 envoiMap.put(String.valueOf(envoi.Stock__c), envoi.Id); // Add as generic Site handler
            }
        }
        return envoiMap;
    }

    private static Map<String, Id> syncOrderLines(Id orderId, List<OrderLineInput> inputLines, Map<String, Id> siteToEnvoiIdMap, String typeLigneContext) {
        Map<String, Id> clientKeyToNewIdMap = new Map<String, Id>();
        List<Commande_Pi_ces_D_tails__c> linesToCreate = new List<Commande_Pi_ces_D_tails__c>();
        List<Commande_Pi_ces_D_tails__c> linesToUpdate = new List<Commande_Pi_ces_D_tails__c>();
        
        Map<Id, Commande_Pi_ces_D_tails__c> existingLinesMap = new Map<Id, Commande_Pi_ces_D_tails__c>(
            [SELECT Id, Statut_Commande__c, Type_Ligne__c, Envoi_Logistique__c FROM Commande_Pi_ces_D_tails__c WHERE Commande_Pi_ces__c = :orderId]
        );

        Set<Id> processedDetailIds = new Set<Id>();

        if (inputLines != null) {
            for (OrderLineInput line : inputLines) {
                // Determine Envoi ID: Try Article-Specific match first, then Generic Site match
                Id envoiId = null;
                if (line.typeLigne == 'Cockpit' && line.siteId != null) {
                    String keySpecific = line.siteId + '-' + line.articleId;
                    String keyGeneric = String.valueOf(line.siteId);
                    
                    if (siteToEnvoiIdMap.containsKey(keySpecific)) {
                        envoiId = siteToEnvoiIdMap.get(keySpecific);
                    } else if (siteToEnvoiIdMap.containsKey(keyGeneric)) {
                        envoiId = siteToEnvoiIdMap.get(keyGeneric);
                    }
                }

                if (line.detailId != null && existingLinesMap.containsKey(line.detailId)) {
                    Commande_Pi_ces_D_tails__c existingLine = existingLinesMap.get(line.detailId);
                    existingLine.Quantit__c = line.quantity;
                    existingLine.Commentaire__c = line.comment;
                    existingLine.Statut_Commande__c = line.statut;
                    existingLine.Commentaire_Refus__c = line.commentaireRefus;
                    if (existingLine.Envoi_Logistique__c == null && envoiId != null) {
                        existingLine.Envoi_Logistique__c = envoiId;
                    }
                    linesToUpdate.add(existingLine);
                    processedDetailIds.add(line.detailId);
                } else {
                    linesToCreate.add(new Commande_Pi_ces_D_tails__c(
                        Commande_Pi_ces__c = orderId, 
                        Lieu__c = line.siteId, 
                        Code_Articles__c = line.articleId,
                        Quantit__c = line.quantity, 
                        Commentaire__c = line.comment,
                        Statut_Commande__c = line.statut,
                        Commentaire_Refus__c = line.commentaireRefus,
                        Type_Ligne__c = line.typeLigne,
                        Envoi_Logistique__c = envoiId
                    ));
                }
            }
        }

        // Identify deletions & Collect Envois to check
        List<Commande_Pi_ces_D_tails__c> linesToDelete = new List<Commande_Pi_ces_D_tails__c>();
        Set<Id> envoiIdsToCheck = new Set<Id>();
        
        for (Id id : existingLinesMap.keySet()) {
            if (!processedDetailIds.contains(id)) {
                Commande_Pi_ces_D_tails__c line = existingLinesMap.get(id);
                // Only delete if it matches the current context
                if (String.isBlank(typeLigneContext) || line.Type_Ligne__c == typeLigneContext) {
                    linesToDelete.add(line);
                    if (line.Envoi_Logistique__c != null) {
                        envoiIdsToCheck.add(line.Envoi_Logistique__c);
                    }
                }
            }
        }

        if (!linesToUpdate.isEmpty()) update linesToUpdate;
        if (!linesToDelete.isEmpty()) delete linesToDelete;

        // Clean up empty Envois
        if (!envoiIdsToCheck.isEmpty()) {
            // Find Envois that STILL have other lines attached
            Set<Id> envoisWithLines = new Set<Id>();
            for (AggregateResult ar : [SELECT Envoi_Logistique__c FROM Commande_Pi_ces_D_tails__c WHERE Envoi_Logistique__c IN :envoiIdsToCheck GROUP BY Envoi_Logistique__c]) {
                envoisWithLines.add((Id)ar.get('Envoi_Logistique__c'));
            }

            Set<Id> envoisToDeleteIds = new Set<Id>();
            for (Id envoiId : envoiIdsToCheck) {
                if (!envoisWithLines.contains(envoiId)) {
                    envoisToDeleteIds.add(envoiId);
                }
            }

            if (!envoisToDeleteIds.isEmpty()) {
                // Delete associated History lines (Type = 'ENV')
                List<Historique_Pi_ces__c> historyToDelete = [SELECT Id FROM Historique_Pi_ces__c WHERE Envoi_Logistique__c IN :envoisToDeleteIds AND Type__c = 'ENV'];
                if (!historyToDelete.isEmpty()) {
                    delete historyToDelete;
                }
                
                // Delete Envois
                List<Envoi_Logistique__c> envoisToDelete = new List<Envoi_Logistique__c>();
                for (Id eid : envoisToDeleteIds) {
                    envoisToDelete.add(new Envoi_Logistique__c(Id = eid));
                }
                delete envoisToDelete;
            }
        }
        if (!linesToCreate.isEmpty()) { 
            insert linesToCreate;
            for (Commande_Pi_ces_D_tails__c newLine : linesToCreate) {
                String clientKey = newLine.Lieu__c + '-' + newLine.Code_Articles__c;
                clientKeyToNewIdMap.put(clientKey, newLine.Id);
            }
        }
        
        return clientKeyToNewIdMap;
    }



    // --- NOTIFICATIONS ---
    private static void sendNotificationsToLogisticians(Id orderId) {
        
        // 1. Récupérer uniquement les lignes pour lesquelles une notif n'a pas encore été envoyée
        List<Commande_Pi_ces_D_tails__c> detailsToSendNotif = [
            SELECT Id, Lieu__c 
            FROM Commande_Pi_ces_D_tails__c 
            WHERE Commande_Pi_ces__c = :orderId AND Notification_Logisticien__c = false AND Type_Ligne__c != 'Technicien'
        ];
        
        if (detailsToSendNotif.isEmpty()) {
            return; // Aucune nouvelle ligne à notifier
        }

        // 2. Grouper les détails par Lieu (Site)
        Map<Id, List<Commande_Pi_ces_D_tails__c>> detailsByLieu = new Map<Id, List<Commande_Pi_ces_D_tails__c>>();
        for (Commande_Pi_ces_D_tails__c detail : detailsToSendNotif) {
            if (!detailsByLieu.containsKey(detail.Lieu__c)) {
                detailsByLieu.put(detail.Lieu__c, new List<Commande_Pi_ces_D_tails__c>());
            }
            detailsByLieu.get(detail.Lieu__c).add(detail);
        }

        // 3. Récupérer les informations nécessaires (logisticiens, etc.)
        Set<Id> lieuIds = detailsByLieu.keySet();
        
        // On récupère les listes de noms pour chaque site
        Map<Id, List<String>> siteToNamesMap = new Map<Id, List<String>>();
        Set<String> allNamesToQuery = new Set<String>();

        for (sitetracker__Site__c site : [SELECT Id, Liste_Logisticiens__c FROM sitetracker__Site__c WHERE Id IN :lieuIds]) {
            if (String.isNotBlank(site.Liste_Logisticiens__c)) {
                List<String> namesForSite = new List<String>();
                // On sépare la chaîne par les virgules et on nettoie chaque nom (enlève les espaces)
                for (String name : site.Liste_Logisticiens__c.split(',')) {
                    String trimmedName = name.trim();
                    if(String.isNotBlank(trimmedName)) {
                       namesForSite.add(trimmedName);
                       allNamesToQuery.add(trimmedName);
                    }
                }
                if(!namesForSite.isEmpty()){
                    siteToNamesMap.put(site.Id, namesForSite);
                }
            }
        }
        
        // Si aucune liste de logisticiens n'est renseignée, on sort après avoir mis à jour les flags
        if(allNamesToQuery.isEmpty()) {
            updateFlagAndExit(detailsToSendNotif);
            return;
        }

        // 4. NOUVEAU : Retrouver les IDs des utilisateurs à partir de leurs noms
        Map<String, Id> nameToUserIdMap = new Map<String, Id>();
        for (User u : [SELECT Id, Name FROM User WHERE Name IN :allNamesToQuery AND IsActive = true]) {
            nameToUserIdMap.put(u.Name, u.Id);
        }

        // 5. Préparer les éléments communs de la notification (inchangé)
        Commande_Pi_ces__c parentOrder = [SELECT Demandeur__r.Name FROM Commande_Pi_ces__c WHERE Id = :orderId];
        String demandeurName = (parentOrder.Demandeur__r != null) ? parentOrder.Demandeur__r.Name : 'un demandeur';
        CustomNotificationType notificationType = [SELECT Id FROM CustomNotificationType WHERE DeveloperName = 'Nouvelle_Commande_Article' LIMIT 1];

        // 6. MODIFIÉ : Boucler, construire la liste des destinataires et envoyer
        for (Id lieuId : detailsByLieu.keySet()) {
            
            // On vérifie si on a des logisticiens pour ce site
            if (siteToNamesMap.containsKey(lieuId)) {
                Set<String> recipientIds = new Set<String>();
                // On récupère les noms pour ce site et on trouve leurs IDs
                for(String name : siteToNamesMap.get(lieuId)){
                    if(nameToUserIdMap.containsKey(name)){
                        recipientIds.add(nameToUserIdMap.get(name));
                    }
                }

                // Si on a trouvé au moins un utilisateur valide, on envoie la notif
                if (!recipientIds.isEmpty()) {
                    Integer lineCount = detailsByLieu.get(lieuId).size();
                    String articleText = (lineCount > 1) ? 'articles' : 'article';
                    
                    Messaging.CustomNotification notification = new Messaging.CustomNotification();
                    notification.setTitle('Nouvelle commande pour votre site');
                    notification.setBody(demandeurName + ' a passé une commande de ' + lineCount + ' ' + articleText + '.');
                    notification.setNotificationTypeId(notificationType.Id);
                    notification.setTargetId(orderId);
                    notification.setSenderId(UserInfo.getUserId());
                    
                    try {
                        notification.send(recipientIds);
                    } catch (Exception e) {
                        System.debug('Erreur envoi notif pour lieu ' + lieuId + ': ' + e.getMessage());
                    }
                }
            }
        }
        
        // 7. Mettre à jour les lignes pour marquer la notification comme envoyée (inchangé)
        updateFlagAndExit(detailsToSendNotif);
    }

        // NOUVELLE méthode utilitaire pour éviter la duplication de code
    private static void updateFlagAndExit(List<Commande_Pi_ces_D_tails__c> linesToUpdate) {
        List<Commande_Pi_ces_D_tails__c> linesToUpdateFlag = new List<Commande_Pi_ces_D_tails__c>();
        for (Commande_Pi_ces_D_tails__c detail : linesToUpdate) {
            linesToUpdateFlag.add(new Commande_Pi_ces_D_tails__c(Id = detail.Id, Notification_Logisticien__c = true));
        }
        
        if (!linesToUpdateFlag.isEmpty()) {
            update linesToUpdateFlag;
        }
    }

    // --- GESTION DES FICHIERS ---
    
    public class FileInfo {
        @AuraEnabled public String title;
        @AuraEnabled public String base64Data;
    }

    public class AttachedFile {
        @AuraEnabled public Id id;
        @AuraEnabled public String title;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String contentVersionId;
    }

    @AuraEnabled
    public static void uploadFiles(Id recordId, List<FileInfo> files) {
        List<ContentVersion> cvList = new List<ContentVersion>();
        for (FileInfo file : files) {
            ContentVersion cv = new ContentVersion();
            cv.Title = file.title;
            cv.PathOnClient = file.title;
            cv.VersionData = EncodingUtil.base64Decode(file.base64Data);
            if (recordId != null) cv.FirstPublishLocationId = recordId;
            cvList.add(cv);
        }
        insert cvList;
        
        // Créer manuellement les ContentDocumentLink pour associer les fichiers à la commande
        List<ContentDocumentLink> cdlList = new List<ContentDocumentLink>();
        
        // Récupérer les ContentDocumentId des ContentVersion insérées
        Set<Id> cvIds = new Set<Id>();
        for (ContentVersion cv : cvList) {
            cvIds.add(cv.Id);
        }
        
        // Query pour obtenir les ContentDocumentId
        Map<Id, Id> cvIdToDocIdMap = new Map<Id, Id>();
        for (ContentVersion cv : [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id IN :cvIds]) {
            cvIdToDocIdMap.put(cv.Id, cv.ContentDocumentId);
        }
        
        // Créer les liens
        for (ContentVersion cv : cvList) {
            Id contentDocId = cvIdToDocIdMap.get(cv.Id);
            if (contentDocId != null) {
                ContentDocumentLink cdl = new ContentDocumentLink();
                cdl.ContentDocumentId = contentDocId;
                cdl.LinkedEntityId = recordId;  // Lien vers la commande
                cdl.ShareType = 'V';  // Viewer permission
                cdl.Visibility = 'AllUsers'; // S'assurer que visible
                cdlList.add(cdl);
            }
        }
        
        if (!cdlList.isEmpty()) {
            try {
                insert cdlList;
            } catch (Exception e) {
                System.debug('Error creating CDL: ' + e.getMessage());
                // Ignorer si doublon
            }
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<AttachedFile> getAttachedFiles(Id recordId) {
        List<AttachedFile> results = new List<AttachedFile>();
        for (ContentDocumentLink link : [SELECT ContentDocumentId, ContentDocument.LatestPublishedVersionId, ContentDocument.Title FROM ContentDocumentLink WHERE LinkedEntityId = :recordId]) {
            AttachedFile f = new AttachedFile();
            f.id = link.ContentDocumentId;
            f.contentDocumentId = link.ContentDocumentId;
            f.contentVersionId = link.ContentDocument.LatestPublishedVersionId;
            f.title = link.ContentDocument.Title;
            results.add(f);
        }
        return results;
    }
}
