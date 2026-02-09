// force-app/main/default/classes/MntGestionEnvoiLogistiqueCtrl.cls

public without sharing class MntGestionEnvoiLogistiqueCtrl {

    // --- INNER CLASSES (DATA WRAPPERS) ---

    public class CommandeDetailLine {
        @AuraEnabled public Id id;
        @AuraEnabled public String articleName;
        @AuraEnabled public String siteName;
        @AuraEnabled public Decimal quantite;
        @AuraEnabled public String commentaire;
        @AuraEnabled public String typeLigne;
        @AuraEnabled public Id envoiLogistiqueId;
        @AuraEnabled public String statut;
    }

    public class InitialDataWrapper {
        @AuraEnabled public Id nTicketCorrectifId;
        @AuraEnabled public String nTicketName;
        @AuraEnabled public String nTicketSubLabel;
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        @AuraEnabled public Id stockId;
        @AuraEnabled public Id lieuId;
        @AuraEnabled public String lieuName;
        @AuraEnabled public String lieuSubLabel;
        @AuraEnabled public Id destinataireId;
        @AuraEnabled public String destinataireName;
        @AuraEnabled public String destinataireAddress;
        @AuraEnabled public String compteProjet;
        @AuraEnabled public String demandeurCommande;
        @AuraEnabled public Id demandeurId;
        @AuraEnabled public List<CartLine> lines;
        public InitialDataWrapper() { this.lines = new List<CartLine>(); }
    }

    public class EnvoiDetailsWrapper {
        @AuraEnabled public String envoiName;
        @AuraEnabled public Id nTicketCorrectifId;
        @AuraEnabled public String nTicketName;
        @AuraEnabled public String nTicketSubLabel; 
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        @AuraEnabled public String statutDeLEnvoi;
        @AuraEnabled public String transporteur;
        @AuraEnabled public DateTime dateCreation;
        @AuraEnabled public String createdByName;
        @AuraEnabled public String typeEnvoi;
        @AuraEnabled public String typeReception;
        @AuraEnabled public Datetime dateEnvoi;
        @AuraEnabled public Id destinataireId;
        @AuraEnabled public String destinataireName;
        @AuraEnabled public String destinataireAddress;
        @AuraEnabled public Id lieuId;
        @AuraEnabled public Id stockId;
        @AuraEnabled public String lieuName;
        @AuraEnabled public String lieuSubLabel;
        @AuraEnabled public String commentaire;
        @AuraEnabled public Boolean isLinkedToCommande;
        @AuraEnabled public Id commandeId;
        @AuraEnabled public String compteProjet;
        @AuraEnabled public String demandeurCommande;
        @AuraEnabled public Id demandeurId;
        @AuraEnabled public List<CartLine> lines;
        public EnvoiDetailsWrapper() { this.lines = new List<CartLine>(); }
    }

    public class PieceUnitaireResult {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String cleEquipement;
        @AuraEnabled public String sousLieu;
        @AuraEnabled public String rma; 
        @AuraEnabled public String mnemonique;
        @AuraEnabled public String description;
        @AuraEnabled public Id reparateurId; // Ajout
        @AuraEnabled public String reparateurName; // Ajout
        @AuraEnabled public String nSerie; // Ajout
        @AuraEnabled public Id lieuId; // Ajout
    }
    
    public class CartLine {
        @AuraEnabled public Id pieceUnitaireId;
        @AuraEnabled public String name;
        @AuraEnabled public String cleEquipement;
        @AuraEnabled public String sousLieu;
        @AuraEnabled public String numBonLivraison;
        @AuraEnabled public String statutChronopost; 
        @AuraEnabled public String mnemonique;
    }

    public class SaveInputWrapper {
        @AuraEnabled public Id recordId;
        @AuraEnabled public String contextObjectType;
        @AuraEnabled public Id nTicketCorrectifId; 
        @AuraEnabled public String statutDeLEnvoi; 
        @AuraEnabled public String transporteur; 
        @AuraEnabled public String typeEnvoi;
        @AuraEnabled public String typeReception;
        @AuraEnabled public Datetime dateEnvoi;
        @AuraEnabled public Id destinataireId;
        @AuraEnabled public Id demandeurId;
        @AuraEnabled public Id lieuId;
        @AuraEnabled public Id stockId;
        @AuraEnabled public String commentaire;
        @AuraEnabled public List<CartLine> cart;
        @AuraEnabled public String actionGlobale; 
        @AuraEnabled public Id commandeParenteId; 
        @AuraEnabled public List<CommandeDetailLine> orderLines;
        @AuraEnabled public Boolean isTechMode;
    }

    public class TechModeDataWrapper {
        @AuraEnabled public Id pieceId;
        @AuraEnabled public String pieceName;
        @AuraEnabled public Id correctifId;
        @AuraEnabled public String correctifName;
        @AuraEnabled public String correctifSubLabel;
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        @AuraEnabled public Id destinationSiteId;
        @AuraEnabled public String destinationSiteName;
        @AuraEnabled public String destinationSiteSubLabel;
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public String contactAddress;
        @AuraEnabled public List<PieceUnitaireResult> otherPieces;
        @AuraEnabled public String accountProject;
        public TechModeDataWrapper() { this.otherPieces = new List<PieceUnitaireResult>(); }
    }

    // --- AURA ENABLED METHODS ---

    // Pour trouver l'ID d'un envoi lié à une commande
    @AuraEnabled(cacheable=true)
    public static Id getEnvoiByCommandeId(Id commandeId) {
        if (commandeId == null) { return null; }
        
        // On suppose qu'une commande n'a qu'un seul envoi. On prend le plus récent.
        List<Envoi_Logistique__c> envois = [
            SELECT Id FROM Envoi_Logistique__c 
            WHERE Commande_Pi_ces__c = :commandeId 
            ORDER BY CreatedDate DESC 
            LIMIT 1
        ];

        return envois.isEmpty() ? null : envois[0].Id;
    }
    
    // Charge les lignes de la commande parente, filtré par envoi si fourni
    @AuraEnabled
    public static List<CommandeDetailLine> getCommandeDetails(Id commandeId, Id envoiId) {
        List<CommandeDetailLine> results = new List<CommandeDetailLine>();
        
        // Construction de la requête dynamique avec filtre optionnel sur l'envoi
        String query = 'SELECT Id, Code_Articles__r.Name, Lieu__r.Name, Lieu__r.Nom_du_site__c, Quantit__c, Commentaire__c, Type_Ligne__c, Envoi_Logistique__c, Statut_Commande__c ' +
                       'FROM Commande_Pi_ces_D_tails__c ' +
                       'WHERE Commande_Pi_ces__c = :commandeId';
        
        // Si un envoiId est fourni, on filtre sur cet envoi spécifique
        if (envoiId != null) {
            query += ' AND Envoi_Logistique__c = :envoiId';
        }
        
        for (Commande_Pi_ces_D_tails__c detail : Database.query(query)) {
            CommandeDetailLine line = new CommandeDetailLine();
            line.id = detail.Id;
            line.articleName = detail.Code_Articles__r.Name;
            line.siteName = detail.Lieu__r.Name + (String.isNotBlank(detail.Lieu__r.Nom_du_site__c) ? ' - ' + detail.Lieu__r.Nom_du_site__c : '');
            line.quantite = detail.Quantit__c;
            line.commentaire = detail.Commentaire__c;
            line.typeLigne = detail.Type_Ligne__c;
            line.envoiLogistiqueId = detail.Envoi_Logistique__c;
            line.statut = detail.Statut_Commande__c;
            results.add(line);
        }
        return results;
    }

    @AuraEnabled
    public static EnvoiDetailsWrapper getEnvoiDetails(Id envoiId) {
        if (envoiId == null) {
            throw new AuraHandledException('L\'ID de l\'envoi est manquant.');
        }

        EnvoiDetailsWrapper result = new EnvoiDetailsWrapper();

        // 1. Récupérer les données de l'en-tête de l'envoi
        Envoi_Logistique__c envoi = [
            SELECT 
                Name, N_Ticket_Correctif__c, N_Ticket_Correctif__r.ID_ticket_client__c, N_Ticket_Correctif__r.Code_site__c, N_Ticket_Correctif__r.Nom_du_site__c, Statut__c, CreatedDate, CreatedBy.Name, Transporteur__c, Lieu_de_Destination__c, Lieu_de_Destination__r.Name, Lieu_de_Destination__r.Nom_du_site__c,
                Type__c, Type_de_R_ception__c, Date_d_Envoi__c, Destinataire__c, Destinataire__r.Name, Destinataire__r.MailingStreet, Destinataire__r.MailingCity, Destinataire__r.MailingPostalCode, Destinataire__r.MailingCountry, Stock__c, Stock__r.Name, Stock__r.Nom_du_site__c, Commentaire__c, Commande_Pi_ces__c, Commande_Pi_ces__r.Compte_Projet__c, Commande_Pi_ces__r.Demandeur__c, Commande_Pi_ces__r.Demandeur__r.Name, Demandeur__c, Demandeur__r.Name
            FROM Envoi_Logistique__c 
            WHERE Id = :envoiId 
            LIMIT 1
        ];

        result.envoiName = envoi.Name;
        result.nTicketCorrectifId = envoi.N_Ticket_Correctif__c;
        if (envoi.N_Ticket_Correctif__c != null) {
            result.nTicketName = envoi.N_Ticket_Correctif__r.ID_ticket_client__c;
            result.g2r = envoi.N_Ticket_Correctif__r.Code_site__c;
            result.siteName = envoi.N_Ticket_Correctif__r.Nom_du_site__c;
            String g2r = envoi.N_Ticket_Correctif__r.Code_site__c != null ? envoi.N_Ticket_Correctif__r.Code_site__c : '';
            String siteName = (envoi.N_Ticket_Correctif__r.Nom_du_site__c != null && envoi.N_Ticket_Correctif__r.Nom_du_site__c != null) ? envoi.N_Ticket_Correctif__r.Nom_du_site__c : '';
            result.nTicketSubLabel = g2r + (String.isNotBlank(g2r) && String.isNotBlank(siteName) ? ' - ' : '') + siteName;
        }
        result.statutDeLEnvoi = envoi.Statut__c;
        result.transporteur = envoi.Transporteur__c;
        result.dateCreation = envoi.CreatedDate;
        result.createdByName = envoi.CreatedBy.Name;
        result.typeEnvoi = envoi.Type__c;
        result.typeReception = envoi.Type_de_R_ception__c;
        result.dateEnvoi = envoi.Date_d_Envoi__c;
        result.destinataireId = envoi.Destinataire__c;
        result.destinataireName = (envoi.Destinataire__r != null) ? envoi.Destinataire__r.Name : '';
        if (envoi.Destinataire__r != null) {
            List<String> addressParts = new List<String>();
            if (String.isNotBlank(envoi.Destinataire__r.MailingStreet)) addressParts.add(envoi.Destinataire__r.MailingStreet);
            if (String.isNotBlank(envoi.Destinataire__r.MailingPostalCode)) addressParts.add(envoi.Destinataire__r.MailingPostalCode + ' ' + envoi.Destinataire__r.MailingCity);
            result.destinataireAddress = String.join(addressParts, '\n');
        }
        result.stockId = envoi.Stock__c;
        /*if (envoi.Stock__c != null) {
            result.stockName = envoi.Stock__r.Name;
            result.stockSubLabel = envoi.Stock__r.Nom_du_site__c;
        }*/
        result.lieuId = envoi.Lieu_de_Destination__c;
        if(envoi.Lieu_de_Destination__c != null) {
            result.lieuName = envoi.Lieu_de_Destination__r.Name;
            result.lieuSubLabel = envoi.Lieu_de_Destination__r.Nom_du_site__c;
        }
        result.commentaire = envoi.Commentaire__c;

        // On renseigne la nouvelle propriété en fonction du champ de la commande
        result.isLinkedToCommande = (envoi.Commande_Pi_ces__c != null);
        result.commandeId = envoi.Commande_Pi_ces__c;
        if (envoi.Commande_Pi_ces__c != null) {
            result.compteProjet = envoi.Commande_Pi_ces__r.Compte_Projet__c;
        }
        // Priorité au demandeur de l'envoi, sinon celui de la commande
        if (envoi.Demandeur__c != null) {
            result.demandeurId = envoi.Demandeur__c;
            result.demandeurCommande = (envoi.Demandeur__r != null) ? envoi.Demandeur__r.Name : String.valueOf(envoi.Demandeur__c);
        } else if (envoi.Commande_Pi_ces__c != null && envoi.Commande_Pi_ces__r.Demandeur__c != null) {
             result.demandeurId = envoi.Commande_Pi_ces__r.Demandeur__c;
             result.demandeurCommande = (envoi.Commande_Pi_ces__r.Demandeur__r != null) ? envoi.Commande_Pi_ces__r.Demandeur__r.Name : String.valueOf(envoi.Commande_Pi_ces__r.Demandeur__c);
        }
        result.lines = new List<CartLine>();

        // 2. Récupérer les lignes (pièces) associées via l'historique
        for (Historique_Pi_ces__c hist : [
            SELECT 
                Pi_ce_Unitaire__c, Pi_ce_Unitaire__r.Name, Pi_ce_Unitaire__r.Cl_quipement__c, 
                Pi_ce_Unitaire__r.Sous_Lieux__c, N_Bon_Livraison__c, Statut_Chronopost__c,
                Pi_ce_Unitaire__r.Code_Article__r.Mnemonique__c
            FROM Historique_Pi_ces__c
            WHERE Envoi_Logistique__c = :envoiId AND Type__c = 'ENV'
        ]) {
            CartLine line = new CartLine();
            line.pieceUnitaireId = hist.Pi_ce_Unitaire__c;
            line.name = hist.Pi_ce_Unitaire__r.Name;
            line.cleEquipement = hist.Pi_ce_Unitaire__r.Cl_quipement__c;
            line.sousLieu = hist.Pi_ce_Unitaire__r.Sous_Lieux__c;
            line.numBonLivraison = hist.N_Bon_Livraison__c;
            line.statutChronopost = hist.Statut_Chronopost__c;
            line.mnemonique = hist.Pi_ce_Unitaire__r.Code_Article__r.Mnemonique__c;
            result.lines.add(line);
        }

        return result;
    }

    
    // Méthode de recherche générique, essentielle pour l'UI avec Pills
    @AuraEnabled(cacheable=true)
    public static List<IdLabel> searchRecords(String searchTerm, String sObjectType) {
        String queryTerm = '%' + searchTerm + '%';
        String sObjectName = String.escapeSingleQuotes(sObjectType);
        String query;
        
        // --- ÉTAPE 1 : Construction de la chaîne de requête (query) ---
        if (sObjectType == 'Contact') {
            query = 'SELECT Id, Name, MailingStreet, MailingCity, MailingPostalCode, MailingCountry FROM Contact WHERE Name LIKE :queryTerm ORDER BY Name LIMIT 10';
        } 
        else if (sObjectType == 'sitetracker__Site__c') {
            query = 'SELECT Id, Name, Nom_du_site__c FROM sitetracker__Site__c WHERE (Name LIKE :queryTerm OR Nom_du_site__c LIKE :queryTerm) ORDER BY Name LIMIT 10';
        } 
        else if (sObjectType == 'Correctif__c') {
            query = 'SELECT Id, Name, ID_ticket_client__c, Code_site__c, Nom_du_site__c FROM Correctif__c WHERE ID_ticket_client__c LIKE :queryTerm OR Code_site__c LIKE :queryTerm ORDER BY ID_ticket_client__c, Code_site__c LIMIT 10';
        }
        else if (sObjectType == 'User') {
            query = 'SELECT Id, Name FROM User WHERE Name LIKE :queryTerm ORDER BY Name LIMIT 10';
        }
        // Cas par défaut pour tout autre objet
        else {
            query = 'SELECT Id, Name FROM ' + sObjectName + ' WHERE Name LIKE :queryTerm ORDER BY Name LIMIT 10';
        }

        // --- ÉTAPE 2 : Exécution de la requête et traitement des résultats ---
        List<IdLabel> results = new List<IdLabel>();
        for (SObject record : Database.query(query)) {
            IdLabel il = new IdLabel();
            il.value = (Id)record.get('Id');
            
            // Logique de traitement spécifique à chaque type d'objet
            if (sObjectType == 'Contact') {
                il.label = (String)record.get('Name');
                List<String> addressParts = new List<String>();
                if (String.isNotBlank((String)record.get('MailingStreet'))) addressParts.add((String)record.get('MailingStreet'));
                if (String.isNotBlank((String)record.get('MailingPostalCode'))) addressParts.add((String)record.get('MailingPostalCode') + ' ' + (String)record.get('MailingCity'));
                // if (String.isNotBlank((String)record.get('MailingCity'))) addressParts.add();
                // if (String.isNotBlank((String)record.get('MailingCountry'))) addressParts.add((String)record.get('MailingCountry'));
                il.sublabel = String.join(addressParts, ', ');
                // On remplace les sauts de ligne par des virgules pour l'attribut data-address HTML, ou on gère côté JS
                il.address = String.join(addressParts, '\n');
            }
            else if (sObjectType == 'sitetracker__Site__c') {
                il.label = (String)record.get('Name');
                il.sublabel = (String)record.get('Nom_du_site__c');
            }
            else if (sObjectType == 'Correctif__c') {
                il.label = (String)record.get('ID_ticket_client__c');
                String g2r = (String)record.get('Code_site__c');
                String siteName = (String)record.get('Nom_du_site__c');
                il.sublabel = (g2r != null ? g2r : '') + (String.isNotBlank(g2r) && String.isNotBlank(siteName) ? ' - ' : '') + siteName;
                il.g2r = g2r;
                il.siteName = siteName;
                // il.compteProjet = (String)record.get('Compte_Projet__c');
            }
            else {
                il.label = (String)record.get('Name');
            }
            
            results.add(il);
        }
        
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static String getContactAddressBySiteName(String siteName) {
        Contact c = getContactBySiteName(siteName);
        if (c != null) {
            List<String> addressParts = new List<String>();
            if (String.isNotBlank(c.MailingStreet)) addressParts.add(c.MailingStreet);
            if (String.isNotBlank(c.MailingPostalCode)) addressParts.add(c.MailingPostalCode + ' ' + c.MailingCity);
            return String.join(addressParts, '\n');
        }
        return '';
    }

    @AuraEnabled(cacheable=true)
    public static Contact getContactBySiteName(String siteName) {
        if (String.isBlank(siteName)) return null;
        
        // Recherche d'un contact dont le nom de famille correspond exactement au Nom du site
        List<Contact> contacts = [
            SELECT Id, Name, MailingStreet, MailingCity, MailingPostalCode, MailingCountry 
            FROM Contact 
            WHERE LastName = :siteName 
            LIMIT 1
        ];

        if (!contacts.isEmpty()) {
            return contacts[0];
        }
        return null;
    }
    
    @AuraEnabled
    public static InitialDataWrapper getInitialData(Id recordId, String sObjectType) {
        InitialDataWrapper data = new InitialDataWrapper();
        if (sObjectType == 'Commande_Pi_ces__c' && recordId != null) {
            List<Commande_Pi_ces__c> commandes = [
                SELECT N_Ticket_Correctif__c, N_Ticket_Correctif__r.ID_ticket_client__c, N_Ticket_Correctif__r.Code_site__c, N_Ticket_Correctif__r.Nom_du_site__c, Lieu__c, Lieu__r.Name, Lieu__r.Nom_du_site__c, Adresse_de_Livraison__c, Adresse_de_Livraison__r.Name, Adresse_de_Livraison__r.MailingStreet, Adresse_de_Livraison__r.MailingCity, Adresse_de_Livraison__r.MailingPostalCode, Adresse_de_Livraison__r.MailingCountry, Compte_Projet__c, Demandeur__c, Demandeur__r.Name
                FROM Commande_Pi_ces__c
                WHERE Id = :recordId
                LIMIT 1
            ];
            if (!commandes.isEmpty()) {
                Commande_Pi_ces__c cmd = commandes[0];
                data.nTicketCorrectifId = cmd.N_Ticket_Correctif__c;
                data.nTicketName = (cmd.N_Ticket_Correctif__r != null) ? cmd.N_Ticket_Correctif__r.ID_ticket_client__c : '';
                data.compteProjet = cmd.Compte_Projet__c;
                data.demandeurId = cmd.Demandeur__c;
                data.demandeurCommande = (cmd.Demandeur__r != null) ? cmd.Demandeur__r.Name : String.valueOf(cmd.Demandeur__c);
                if (cmd.N_Ticket_Correctif__r != null) {
                    data.g2r = cmd.N_Ticket_Correctif__r.Code_site__c;
                    data.siteName = cmd.N_Ticket_Correctif__r.Nom_du_site__c;
                    String g2r = cmd.N_Ticket_Correctif__r.Code_site__c != null ? cmd.N_Ticket_Correctif__r.Code_site__c : '';
                    String siteName = (cmd.N_Ticket_Correctif__r.Nom_du_site__c != null) ? cmd.N_Ticket_Correctif__r.Nom_du_site__c : '';
                    data.nTicketSubLabel = g2r + (String.isNotBlank(g2r) && String.isNotBlank(siteName) ? ' - ' : '') + siteName;
                }
            
                if (cmd.Lieu__c != null) {
                    // CORRECTION : Lieu__c sur la commande correspond au site du ticket, donc à la DESTINATION de l'envoi
                    data.lieuId = cmd.Lieu__c;
                    data.lieuName = cmd.Lieu__r.Name;
                    data.lieuSubLabel = cmd.Lieu__r.Nom_du_site__c;
                }

                data.destinataireId = cmd.Adresse_de_Livraison__c;
                data.destinataireName = (cmd.Adresse_de_Livraison__r != null) ? cmd.Adresse_de_Livraison__r.Name : '';
                if (cmd.Adresse_de_Livraison__r != null) {
                    List<String> addressParts = new List<String>();
                    if (String.isNotBlank(cmd.Adresse_de_Livraison__r.MailingStreet)) addressParts.add(cmd.Adresse_de_Livraison__r.MailingStreet);
                    if (String.isNotBlank(cmd.Adresse_de_Livraison__r.MailingPostalCode)) addressParts.add(cmd.Adresse_de_Livraison__r.MailingPostalCode + ' ' + cmd.Adresse_de_Livraison__r.MailingCity);
                    data.destinataireAddress = String.join(addressParts, '\n');
                }
            }
        }
        else if (sObjectType == 'Correctif__c' && recordId != null) {
            List<Correctif__c> tickets = [
                SELECT Id, ID_ticket_client__c, Code_site__c, Nom_du_site__c
                FROM Correctif__c
                WHERE Id = :recordId
                LIMIT 1
            ];
            if (!tickets.isEmpty()) {
                Correctif__c t = tickets[0];
                data.nTicketCorrectifId = t.Id;
                data.nTicketName = t.ID_ticket_client__c;
                data.g2r = t.Code_site__c;
                data.siteName = t.Nom_du_site__c;
                String g2r = t.Code_site__c != null ? t.Code_site__c : '';
                String siteName = (t.Nom_du_site__c != null) ? t.Nom_du_site__c : '';
                data.nTicketSubLabel = g2r + (String.isNotBlank(g2r) && String.isNotBlank(siteName) ? ' - ' : '') + siteName;
            }
        }
        else if (sObjectType == 'sitetracker__Job__c' && recordId != null) {
            List<sitetracker__Job__c> jobs = [
                SELECT Correctif__c, Correctif__r.ID_ticket_client__c, Correctif__r.Code_site__c, Correctif__r.Nom_du_site__c
                FROM sitetracker__Job__c
                WHERE Id = :recordId
                LIMIT 1
            ];
            if (!jobs.isEmpty() && jobs[0].Correctif__c != null) {
                sitetracker__Job__c job = jobs[0];
                data.nTicketCorrectifId = job.Correctif__c;
                data.nTicketName = job.Correctif__r.ID_ticket_client__c;
                data.g2r = job.Correctif__r.Code_site__c;
                data.siteName = job.Correctif__r.Nom_du_site__c;
                String g2r = job.Correctif__r.Code_site__c != null ? job.Correctif__r.Code_site__c : '';
                String siteName = (job.Correctif__r.Nom_du_site__c != null) ? job.Correctif__r.Nom_du_site__c : '';
                data.nTicketSubLabel = g2r + (String.isNotBlank(g2r) && String.isNotBlank(siteName) ? ' - ' : '') + siteName;
            }
        }
        return data;
    }

    @AuraEnabled
    public static TechModeDataWrapper getTechModeData(Id pieceId) {
        TechModeDataWrapper result = new TechModeDataWrapper();
        
        if (pieceId == null) {
            throw new AuraHandledException('L\'ID de la pièce est manquant.');
        }

        // 0. Get Current User Info
        try {
            User u = [SELECT Compte_Projet_Logistique__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            result.accountProject = u.Compte_Projet_Logistique__c;
        } catch (Exception e) {
            System.debug('Error getting User Project Account: ' + e.getMessage());
        }

        // 1. Get piece data with ticket info
        List<Pi_ce_Unitaire__c> pieces = [
            SELECT Id, Name, Correctif__c, Correctif__r.ID_ticket_client__c, 
                   Correctif__r.Code_site__c, Correctif__r.Nom_du_site__c,
                   Cl_quipement__c, Sous_Lieux__c, Code_Article__r.Mnemonique__c,
                   Code_Article__r.Description__c
            FROM Pi_ce_Unitaire__c
            WHERE Id = :pieceId
            LIMIT 1
        ];

        if (pieces.isEmpty()) {
            throw new AuraHandledException('Pièce introuvable.');
        }

        Pi_ce_Unitaire__c piece = pieces[0];
        result.pieceId = piece.Id;
        result.pieceName = piece.Name;

        // 2. Get ticket info
        if (piece.Correctif__c != null) {
            result.correctifId = piece.Correctif__c;
            result.correctifName = piece.Correctif__r.ID_ticket_client__c;
            result.g2r = piece.Correctif__r.Code_site__c;
            result.siteName = piece.Correctif__r.Nom_du_site__c;
            String g2r = piece.Correctif__r.Code_site__c != null ? piece.Correctif__r.Code_site__c : '';
            String siteName = piece.Correctif__r.Nom_du_site__c != null ? piece.Correctif__r.Nom_du_site__c : '';
            result.correctifSubLabel = g2r + (String.isNotBlank(g2r) && String.isNotBlank(siteName) ? ' - ' : '') + siteName;
        }

        // 3. Get current user's STR__c field
        List<User> users = [
            SELECT STR__c 
            FROM User 
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        if (!users.isEmpty() && users[0].STR__c != null) {
            String strValue = users[0].STR__c;
            
            // STR__c value is the Site ID
            List<sitetracker__Site__c> sites = [
                SELECT Id, Name, Nom_du_site__c
                FROM sitetracker__Site__c
                WHERE Id = :strValue
                LIMIT 1
            ];

            if (!sites.isEmpty()) {
                sitetracker__Site__c site = sites[0];
                result.destinationSiteId = site.Id;
                result.destinationSiteName = site.Name;
                result.destinationSiteSubLabel = site.Nom_du_site__c;

                // 4. Find Contact with LastName matching Site Name
                List<Contact> contacts = [
                    SELECT Id, Name, MailingStreet, MailingCity, MailingPostalCode, MailingCountry
                    FROM Contact
                    WHERE LastName = :site.Name
                    LIMIT 1
                ];

                if (!contacts.isEmpty()) {
                    Contact contact = contacts[0];
                    result.contactId = contact.Id;
                    result.contactName = contact.Name;
                    
                    List<String> addressParts = new List<String>();
                    if (String.isNotBlank(contact.MailingStreet)) addressParts.add(contact.MailingStreet);
                    if (String.isNotBlank(contact.MailingPostalCode)) addressParts.add(contact.MailingPostalCode + ' ' + contact.MailingCity);
                    result.contactAddress = String.join(addressParts, '\n');
                }
            }
        }

        // 5. Get other pieces with status "A Retourner" and Mes_Pi_ces__c = true
        result.otherPieces = new List<PieceUnitaireResult>();
        for (Pi_ce_Unitaire__c p : [
            SELECT Id, Name, Cl_quipement__c, Sous_Lieux__c, RMA__c,
                   Code_Article__r.Mnemonique__c, Code_Article__r.Description__c
            FROM Pi_ce_Unitaire__c
            WHERE Statut__c = 'A Retourner' 
              AND Mes_Pi_ces__c = true
              AND Id != :pieceId
            LIMIT 50
        ]) {
            PieceUnitaireResult res = new PieceUnitaireResult();
            res.id = p.Id;
            res.name = p.Name;
            res.cleEquipement = p.Cl_quipement__c;
            res.sousLieu = p.Sous_Lieux__c;
            res.rma = p.RMA__c;
            res.mnemonique = p.Code_Article__r.Mnemonique__c;
            res.description = p.Code_Article__r.Description__c;
            result.otherPieces.add(res);
        }

        return result;
    }

    @AuraEnabled
    public static List<PieceUnitaireResult> getPiecesByIds(List<String> pieceIds) {
        List<PieceUnitaireResult> results = new List<PieceUnitaireResult>();
        if (pieceIds == null || pieceIds.isEmpty()) return results;
        
        // On récupère les pièces avec leur réparateur
        // ASSUMPTION: Reparateur__c exists on Pi_ce_Unitaire__c
        for(Pi_ce_Unitaire__c piece : [
            SELECT Id, Name, Cl_quipement__c, Sous_Lieux__c, RMA__c, Code_Article__r.Mnemonique__c, Code_Article__r.Description__c,
                   Reparateur__c, Reparateur__r.Name, Pi_ce_Install_e__r.N_Serie__c, Lieu__c
            FROM Pi_ce_Unitaire__c
            WHERE Id IN :pieceIds
        ]) {
            PieceUnitaireResult res = new PieceUnitaireResult();
            res.id = piece.Id;
            res.name = piece.Name;
            res.cleEquipement = piece.Cl_quipement__c;
            res.sousLieu = piece.Sous_Lieux__c;
            res.rma = piece.RMA__c; 
            res.mnemonique = piece.Code_Article__r != null ? piece.Code_Article__r.Mnemonique__c : '';
            res.description = piece.Code_Article__r != null ? piece.Code_Article__r.Description__c : '';
            res.reparateurId = piece.Reparateur__c;
            res.reparateurName = piece.Reparateur__r != null ? piece.Reparateur__r.Name : '';
            res.nSerie = piece.Pi_ce_Install_e__r != null ? piece.Pi_ce_Install_e__r.N_Serie__c : '';
            res.lieuId = piece.Lieu__c;
            results.add(res);
        }
        return results;
    }

    @AuraEnabled
    public static List<PieceUnitaireResult> getInitialRepairPieces() {
        Id currentUserId = UserInfo.getUserId();
        List<PieceUnitaireResult> results = new List<PieceUnitaireResult>();
        
        // On récupère les pièces "A Envoyer en REP" dans le stock du logisticien connecté
        for(Pi_ce_Unitaire__c piece : [
            SELECT Id, Name, Cl_quipement__c, Sous_Lieux__c, RMA__c, Code_Article__r.Mnemonique__c, Code_Article__r.Description__c,
                   Reparateur__c, Reparateur__r.Name, Pi_ce_Install_e__r.N_Serie__c
            FROM Pi_ce_Unitaire__c
            WHERE Statut__c = 'A Envoyer en REP'
              AND Lieu__r.Logisticien__c = :currentUserId
        ]) {
            PieceUnitaireResult res = new PieceUnitaireResult();
            res.id = piece.Id;
            res.name = piece.Name;
            res.cleEquipement = piece.Cl_quipement__c;
            res.sousLieu = piece.Sous_Lieux__c;
            res.rma = piece.RMA__c; 
            res.mnemonique = piece.Code_Article__r != null ? piece.Code_Article__r.Mnemonique__c : '';
            res.description = piece.Code_Article__r != null ? piece.Code_Article__r.Description__c : '';
            res.reparateurId = piece.Reparateur__c;
            res.reparateurName = piece.Reparateur__r != null ? piece.Reparateur__r.Name : '';
            res.nSerie = piece.Pi_ce_Install_e__r != null ? piece.Pi_ce_Install_e__r.N_Serie__c : '';
            results.add(res);
        }
        return results;
    }

    @AuraEnabled
    public static List<PieceUnitaireResult> getAvailableRepairPieces(String reparateurId, String lieuId) {
        List<PieceUnitaireResult> results = new List<PieceUnitaireResult>();
        if (String.isBlank(reparateurId)) return results;

        for(Pi_ce_Unitaire__c piece : [
            SELECT Id, Name, Cl_quipement__c, Sous_Lieux__c, RMA__c, Code_Article__r.Mnemonique__c, Code_Article__r.Description__c,
                   Reparateur__c, Reparateur__r.Name, Pi_ce_Install_e__r.N_Serie__c, Lieu__c
            FROM Pi_ce_Unitaire__c
            WHERE Statut__c = 'A Envoyer en REP'
              AND Reparateur__c = :reparateurId
              AND Lieu__c = :lieuId
        ]) {
            PieceUnitaireResult res = new PieceUnitaireResult();
            res.id = piece.Id;
            res.name = piece.Name;
            res.cleEquipement = piece.Cl_quipement__c;
            res.sousLieu = piece.Sous_Lieux__c;
            res.rma = piece.RMA__c; 
            res.mnemonique = piece.Code_Article__r != null ? piece.Code_Article__r.Mnemonique__c : '';
            res.description = piece.Code_Article__r != null ? piece.Code_Article__r.Description__c : '';
            res.reparateurId = piece.Reparateur__c;
            res.reparateurName = piece.Reparateur__r != null ? piece.Reparateur__r.Name : '';
            res.nSerie = piece.Pi_ce_Install_e__r != null ? piece.Pi_ce_Install_e__r.N_Serie__c : '';
            res.lieuId = piece.Lieu__c;
            results.add(res);
        }
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<PieceUnitaireResult> searchPiecesUnitaires(String searchTerm, String typeEnvoi) {
        String queryTerm = '%' + searchTerm + '%';
        Id currentUserId = UserInfo.getUserId();
        List<PieceUnitaireResult> results = new List<PieceUnitaireResult>();

        // Logique de filtrage dynamique sur le statut
        String statutAFiltrer = 'Réparateur'.equals(typeEnvoi) ? 'A Envoyer en REP' : 'En Stock';
        
        // La requête inclut maintenant RMA__c et filtre sur le statut dynamique
        for(Pi_ce_Unitaire__c piece : [
            SELECT Id, Name, Cl_quipement__c, Sous_Lieux__c, RMA__c, Code_Article__r.Mnemonique__c, Code_Article__r.Description__c,
                   Pi_ce_Install_e__r.N_Serie__c
            FROM Pi_ce_Unitaire__c
            WHERE (Name LIKE :queryTerm OR Cl_quipement__c LIKE :queryTerm OR Code_Article__r.Mnemonique__c LIKE :queryTerm)
              AND Statut__c = :statutAFiltrer
              AND Lieu__r.Logisticien__c = :currentUserId
            LIMIT 50
        ]) {
            PieceUnitaireResult res = new PieceUnitaireResult();
            res.id = piece.Id;
            res.name = piece.Name;
            res.cleEquipement = piece.Cl_quipement__c;
            res.sousLieu = piece.Sous_Lieux__c;
            res.rma = piece.RMA__c; 
            res.mnemonique = piece.Code_Article__r != null ? piece.Code_Article__r.Mnemonique__c : '';
            res.description = piece.Code_Article__r != null ? piece.Code_Article__r.Description__c : '';
            res.nSerie = piece.Pi_ce_Install_e__r != null ? piece.Pi_ce_Install_e__r.N_Serie__c : '';
            results.add(res);
        }
        return results;
    }

    @AuraEnabled
    public static Id saveEnvoi(String inputJSON) {
        System.debug('### START saveEnvoi');
        System.debug('### Input JSON: ' + inputJSON);
        try {
            SaveInputWrapper input = (SaveInputWrapper) JSON.deserialize(inputJSON, SaveInputWrapper.class);
            
            // --- 1. INITIALISATION DE L'ENVOI ---
            Envoi_Logistique__c envoi;
            Boolean isCreation = (input.recordId == null);
            System.debug('### isCreation: ' + isCreation);
            
            if (input.recordId != null && 'Envoi_Logistique__c'.equals(input.contextObjectType)) {
                envoi = new Envoi_Logistique__c(Id = input.recordId);
            } else {
                envoi = new Envoi_Logistique__c();
                if ('Commande_Pi_ces__c'.equals(input.contextObjectType)) {
                    envoi.Commande_Pi_ces__c = input.recordId;
                }
            }
            
            envoi.N_Ticket_Correctif__c = input.nTicketCorrectifId;
            
            if (isCreation) {
                envoi.Statut__c = ('Réparateur'.equals(input.typeEnvoi)) ? 'Clôturer OK' : 'Commande à Traiter';
            }
            
            envoi.Type__c = input.typeEnvoi; 
            envoi.Destinataire__c = input.destinataireId; 
            envoi.Stock__c = input.stockId; 
            envoi.Commentaire__c = input.commentaire;
            envoi.Demandeur__c = input.demandeurId;
            envoi.Type_de_R_ception__c = input.typeReception;
            envoi.Transporteur__c = input.transporteur;
            envoi.Date_d_Envoi__c = input.dateEnvoi;
            
            // Force Date Envoi if Repair Creation
            if (isCreation && 'Réparateur'.equals(input.typeEnvoi) && envoi.Date_d_Envoi__c == null) {
                envoi.Date_d_Envoi__c = System.now();
            }
    
            envoi.Lieu_de_Destination__c = input.lieuId;
            
            List<SObject> recordsToUpdate = new List<SObject>();
            
            // --- 2. LOGIQUE ACTION GLOBALE (VALIDER/REFUSER) ---
            Id commandeId = (envoi.Commande_Pi_ces__c != null) ? envoi.Commande_Pi_ces__c : input.commandeParenteId;
            
            if ('REFUSER'.equals(input.actionGlobale)) {
                envoi.Statut__c = 'Clôturer NOK';
                if (commandeId != null) {
                    recordsToUpdate.add(new Commande_Pi_ces__c(Id = commandeId, Statut_Commande__c = 'À Retraiter'));
                }
            } else if ('VALIDER'.equals(input.actionGlobale)) {
                envoi.Statut__c = 'À Réceptionner';
                envoi.Date_d_Envoi__c = System.now();
                
                if (commandeId != null) {
                    Boolean allOthersShipped = true;
                    Set<String> shippedStatuses = new Set<String>{'Commande à Traiter'};
                    for (Envoi_Logistique__c otherEnvoi : [SELECT Statut__c FROM Envoi_Logistique__c WHERE Commande_Pi_ces__c = :commandeId AND Id != :envoi.Id]) {
                        if (otherEnvoi.Statut__c == null || shippedStatuses.contains(otherEnvoi.Statut__c)) {
                            allOthersShipped = false;
                            break;
                        }
                    }
                    String newOrderStatus = allOthersShipped ? 'Livraison en Cours' : 'Livraison Partielle en Cours';
                    recordsToUpdate.add(new Commande_Pi_ces__c(Id = commandeId, Statut_Commande__c = newOrderStatus));
                }
            }
            
            // --- 3. UPSERT ENVOI (BYPASS) ---
            System.debug('### Upserting Envoi...');
            envoi.Bypass_ValidationRules__c = true;
            upsert envoi;
            System.debug('### Envoi Upserted. ID: ' + envoi.Id);

            //envoi.Bypass_ValidationRules__c = false;
            //update envoi;

            // --- 4. UPDATE RELATED RECORDS (COMMANDES) ---
            if (!recordsToUpdate.isEmpty()) {
                for (SObject sobj : recordsToUpdate) sobj.put('Bypass_ValidationRules__c', true);
                update recordsToUpdate;
                //for (SObject sobj : recordsToUpdate) sobj.put('Bypass_ValidationRules__c', false);
                //update recordsToUpdate;
            }
            
            // --- 5. NOTIFICATION REFUS ---
            Id cmdIdForNotify = (envoi.Commande_Pi_ces__c != null) ? envoi.Commande_Pi_ces__c : input.commandeParenteId;
            if ('REFUSER'.equals(input.actionGlobale) && cmdIdForNotify != null) {
                 Commande_Pi_ces__c cmdForNotify = [SELECT Nom_PEC_Cockpit__c FROM Commande_Pi_ces__c WHERE Id = :cmdIdForNotify LIMIT 1];
                 if (cmdForNotify.Nom_PEC_Cockpit__c != null) {
                    CustomNotificationType notificationType = [SELECT Id FROM CustomNotificationType WHERE DeveloperName = 'Logistique_Commande' LIMIT 1];
                    Messaging.CustomNotification notification = new Messaging.CustomNotification();
                    notification.setTitle('Commande Refusée');
                    notification.setBody('La commande a été refusée par le logisticien.');
                    notification.setNotificationTypeId(notificationType.Id);
                    notification.setTargetId(cmdIdForNotify);
                    try {
                        notification.send(new Set<String>{cmdForNotify.Nom_PEC_Cockpit__c});
                    } catch (Exception e) {
                        System.debug('Erreur envoi notification: ' + e.getMessage());
                    }
                 }
            }

            // --- 6. UPDATE ORDER LINES ---
            if (input.orderLines != null && !input.orderLines.isEmpty()) {
                List<Commande_Pi_ces_D_tails__c> detailsToUpdate = new List<Commande_Pi_ces_D_tails__c>();
                for (CommandeDetailLine lineWrapper : input.orderLines) {
                    if (lineWrapper.id != null) {
                        detailsToUpdate.add(new Commande_Pi_ces_D_tails__c(Id = lineWrapper.id, Statut_Commande__c = lineWrapper.statut));
                    }
                }
                if (!detailsToUpdate.isEmpty()) update detailsToUpdate;
            }
            
            // --- 7. GESTION DU PANIER (HISTORIQUES & PIECES) ---
            System.debug('### Manage Cart Items...');
            Envoi_Logistique__c fullEnvoi = [
                SELECT Id, Statut__c, Destinataire__r.Name, Stock__r.Name, 
                       N_Ticket_Correctif__c, N_Ticket_Correctif__r.ID_ticket_client__c, 
                       N_Ticket_Correctif__r.Code_site__c, N_Ticket_Correctif__r.Nom_du_site__c 
                FROM Envoi_Logistique__c 
                WHERE Id = :envoi.Id
            ];
            
            Set<Id> currentPieceIdsInCart = new Set<Id>();
            Map<Id, CartLine> cartLineMap = new Map<Id, CartLine>();
            if (input.cart != null) {
                for (CartLine line : input.cart) { 
                    currentPieceIdsInCart.add(line.pieceUnitaireId); 
                    cartLineMap.put(line.pieceUnitaireId, line); 
                }
            }
            System.debug('### Cart Size: ' + currentPieceIdsInCart.size());
            
            Map<Id, Historique_Pi_ces__c> previousHistoriesMap = new Map<Id, Historique_Pi_ces__c>();
            // FILTRE AJOUTÉ : Type__c = 'ENV' pour ne récupérer que les lignes d'envoi
            for (Historique_Pi_ces__c hist : [SELECT Id, Pi_ce_Unitaire__c, N_Bon_Livraison__c, Statut_Chronopost__c, Statut__c FROM Historique_Pi_ces__c WHERE Envoi_Logistique__c = :envoi.Id AND Type__c = 'ENV']) {
                previousHistoriesMap.put(hist.Pi_ce_Unitaire__c, hist);
            }

            List<Historique_Pi_ces__c> historiesToDelete = new List<Historique_Pi_ces__c>();
            List<Historique_Pi_ces__c> historiesToCreate = new List<Historique_Pi_ces__c>();
            List<Historique_Pi_ces__c> historiesToUpdate = new List<Historique_Pi_ces__c>();
            List<Pi_ce_Unitaire__c> piecesToUpdate = new List<Pi_ce_Unitaire__c>();

            // Removals
            Set<Id> removedPieceIds = new Set<Id>(previousHistoriesMap.keySet());
            removedPieceIds.removeAll(currentPieceIdsInCart);
            if (!removedPieceIds.isEmpty()) {
                Map<Id, Pi_ce_Unitaire__c> removedPiecesData = new Map<Id, Pi_ce_Unitaire__c>([SELECT Id, Lieu_Pr_c_dent__c FROM Pi_ce_Unitaire__c WHERE Id IN :removedPieceIds]);
                for (Id pieceId : removedPieceIds) {
                    historiesToDelete.add(previousHistoriesMap.get(pieceId));
                    Pi_ce_Unitaire__c pieceToRestore = removedPiecesData.get(pieceId);
                    if (pieceToRestore != null) {
                        piecesToUpdate.add(new Pi_ce_Unitaire__c(Id = pieceId, Statut__c = 'En Stock', Lieu__c = pieceToRestore.Lieu_Pr_c_dent__c, Lieu_Pr_c_dent__c = null));
                    }
                }
            }
            
            // Upserts / Create
            String newStatusForSentPieces;
            if (input.isTechMode != null && input.isTechMode) {
                newStatusForSentPieces = 'A contrôler';
            } else {
                newStatusForSentPieces = 'Réparateur'.equals(input.typeEnvoi) ? 'En Réparation' : 'A Réceptionner';
            }
            
            if (!currentPieceIdsInCart.isEmpty()) {
                Map<Id, Pi_ce_Unitaire__c> piecesDataMap = new Map<Id, Pi_ce_Unitaire__c>([SELECT Id, Name, Lieu__c, Lieu__r.Name, RMA__c, Panne__c, Pi_ce_Install_e__r.N_Serie__c FROM Pi_ce_Unitaire__c WHERE Id IN :currentPieceIdsInCart]); 
                String today = Date.today().format();
                String toLocation = (fullEnvoi.Stock__r != null ? fullEnvoi.Stock__r.Name : '');
                
                // Trigramme Mapping
                Map<String, String> trigrammeMap = new Map<String, String>{
                    'STR01' => 'CIR01AGJ', 'STR13' => 'CIR01AGL', 'STR14' => 'CIR01AGQ',
                    'STR31' => 'CIR01AGN', 'STR33' => 'CIR01AGO', 'STR34' => 'CIR01AGM',
                    'STR42' => 'CIR01AGK', 'STR44' => 'CIR01AGP', 'STR54' => 'CIR01AGS',
                    'STR59' => 'CIR01AGR', 'STR93' => 'CIR01AGH', 'STR20' => 'CIR01AGD'
                };

                for (Id currentPieceId : currentPieceIdsInCart) {
                    CartLine line = cartLineMap.get(currentPieceId);
                    Pi_ce_Unitaire__c pieceActuelle = piecesDataMap.get(currentPieceId);
                    if (pieceActuelle == null) continue;
    
                    if (!previousHistoriesMap.containsKey(currentPieceId)) {
                        // CREATE
                        Historique_Pi_ces__c hist = new Historique_Pi_ces__c();
                        hist.Envoi_Logistique__c = envoi.Id;
                        hist.Pi_ce_Unitaire__c = pieceActuelle.Id;
                        hist.N_Bon_Livraison__c = line.numBonLivraison;
                        hist.Statut__c = newStatusForSentPieces;
                        hist.Type__c = 'ENV';
                        hist.Lieu__c = input.lieuId;
                        hist.Statut_Chronopost__c = line.statutChronopost;
                        
                        historiesToCreate.add(hist);
                        hist.Envoi_Logistique__c = '';
    
                        Historique_Pi_ces__c histPU = hist.clone(false, true, false, false);
                        histPU.Type__c = 'PU';
                        Pi_ce_Unitaire__c pieceToUpdate;
                        
                        if ('Réparateur'.equals(input.typeEnvoi)) {
                            String trigramme = '';
                            if (pieceActuelle.Lieu__r != null && trigrammeMap.containsKey(pieceActuelle.Lieu__r.Name)) {
                                trigramme = trigrammeMap.get(pieceActuelle.Lieu__r.Name);
                            }
                            String panne = (pieceActuelle.Panne__c != null ? pieceActuelle.Panne__c : '');
                            String nSerieInstalle = (pieceActuelle.Pi_ce_Install_e__r != null && pieceActuelle.Pi_ce_Install_e__r.N_Serie__c != null ? pieceActuelle.Pi_ce_Install_e__r.N_Serie__c : '');
                            String rma = (pieceActuelle.RMA__c != null ? pieceActuelle.RMA__c : '');
                            
                            histPU.TRAME__c = '[' + trigramme + '][' + panne + '][EQT_MIS_SUR_SITE_(SN) =' + nSerieInstalle + '][RMA=' + rma + '][CONTRAT PROMA FIXE/MOBILE]';
                            histPU.Remarques__c = 'Envoi vers Réparateur le [' + today + '] RMA N° [' + rma + '] N° de BL [' + (line.numBonLivraison != null ? line.numBonLivraison : '') + ']';
                            histPU.BT_RPMAT__c = true;
                            historiesToCreate.add(histPU);

                            if(pieceActuelle.Lieu__r.Name == 'REBUT'){
                                Historique_Pi_ces__c histPURebut = histPU.clone(false, true, false, false);
                                histPURebut.Statut__c = 'Rebut';
                                histPURebut.Remarques__c = 'Mis au REBUT';
                                histPURebut.TRAME__c = '[' + trigramme + '][PIECE_IRREPARABLE-MISE_AU_REBUT][RMA=' + rma + '][CONTRAT PROMA FIXE/MOBILE]';
                                histPURebut.BT_RETREP__c = true;
                                historiesToCreate.add(histPURebut);
                            }
                            
                        } else {
                            histPU.INVENTAI__c = true;
                            String fromLocation = (pieceActuelle.Lieu__r != null ? pieceActuelle.Lieu__r.Name : '');
                            
                            // TechMode custom remarks
                            if (input.isTechMode != null && input.isTechMode) {
                                if ('Livraison'.equalsIgnoreCase(input.typeReception)) {
                                    histPU.Remarques__c = 'Pièce envoyée avec Chronopost N° [' + (line.numBonLivraison != null ? line.numBonLivraison : '') + '] par [' + UserInfo.getName() + '] pour réparation vers [' + toLocation + ']';
                                } else if ('Remise en main propre'.equalsIgnoreCase(input.typeReception)) {
                                    histPU.Remarques__c = 'Pièce déposée en main propre par [' + UserInfo.getName() + '] pour réparation vers [' + toLocation + ']';
                                }
                            } else if ('Remise en main propre'.equalsIgnoreCase(input.typeEnvoi)) {
                                histPU.Remarques__c = 'Pièce déplacée par [' + UserInfo.getName() + '] du [' + fromLocation + ']  vers [' + toLocation + ']';
                            } else {
                                if (fullEnvoi.N_Ticket_Correctif__c == null) {
                                    histPU.Remarques__c = 'Envois depuis [' + fromLocation + '] vers [' + toLocation + '] N° de BL [' + line.numBonLivraison + '] le [' + today + ']';
                                } else {
                                    String ticketNum = (fullEnvoi.N_Ticket_Correctif__r != null ? fullEnvoi.N_Ticket_Correctif__r.ID_ticket_client__c : '');
                                    String siteCode = (fullEnvoi.N_Ticket_Correctif__r != null ? fullEnvoi.N_Ticket_Correctif__r.Code_site__c : '');
                                    histPU.Remarques__c = 'Envois depuis [' + fromLocation + '] vers [' + toLocation + '] N° de BL [' + line.numBonLivraison + '] N° Ticket [' + ticketNum + '] Site Code [' + siteCode + '] le [' + today + ']';
                                }
                            }
                            historiesToCreate.add(histPU);
                        }
                        if(pieceActuelle.Lieu__r.Name != 'REBUT'){
                            pieceToUpdate = new Pi_ce_Unitaire__c(Id = pieceActuelle.Id, Statut__c = newStatusForSentPieces, Lieu_Pr_c_dent__c = pieceActuelle.Lieu__c, Lieu__c = input.lieuId); }
                        else {
                            pieceToUpdate = new Pi_ce_Unitaire__c(Id = pieceActuelle.Id, Statut__c = 'Rebut', Lieu__c = input.lieuId); 
                        }
                        piecesToUpdate.add(pieceToUpdate);

                    } else {
                        // UPDATE
                        Historique_Pi_ces__c existingHist = previousHistoriesMap.get(currentPieceId);
                        Boolean needsUpdate = false;
                        
                        if (existingHist.N_Bon_Livraison__c != line.numBonLivraison) { existingHist.N_Bon_Livraison__c = line.numBonLivraison; needsUpdate = true; }
                        if (existingHist.Statut_Chronopost__c != line.statutChronopost) { existingHist.Statut_Chronopost__c = line.statutChronopost; needsUpdate = true; }
                        
                        if(needsUpdate) {
                            historiesToUpdate.add(existingHist);
                        }
                        
                        // NEW: Update Piece Status/Location on Validation for existing items
                        if ('VALIDER'.equals(input.actionGlobale)) {
                             Pi_ce_Unitaire__c pieceToUpdate = new Pi_ce_Unitaire__c(
                                 Id = pieceActuelle.Id, 
                                 Statut__c = newStatusForSentPieces, 
                                 Lieu_Pr_c_dent__c = pieceActuelle.Lieu__c, 
                                 Lieu__c = input.lieuId
                             );
                             piecesToUpdate.add(pieceToUpdate);
                        }
                    }
                }
            }

            if (!historiesToDelete.isEmpty()) delete historiesToDelete;
            if (!historiesToCreate.isEmpty()) insert historiesToCreate;
            if (!historiesToUpdate.isEmpty()) update historiesToUpdate;
            if (!piecesToUpdate.isEmpty()) update piecesToUpdate;
            
            System.debug('### END saveEnvoi. Returning ID: ' + envoi.Id);
            return envoi.Id;
    
        } catch (Exception e) {
            System.debug('### EXCEPTION in saveEnvoi: ' + e.getMessage() + ' - Stack: ' + e.getStackTraceString());
            throw new AuraHandledException(e.getMessage() + ' at line ' + e.getLineNumber());
        }
    }

    @AuraEnabled
    public static void updateLineStatus(Id envoiId, Id pieceId, String newStatus) {
        try {
            // On récupère la ligne d'historique correspondante (Type = 'ENV')
            Historique_Pi_ces__c hist = [
                SELECT Id, Statut_Chronopost__c 
                FROM Historique_Pi_ces__c 
                WHERE Envoi_Logistique__c = :envoiId 
                  AND Pi_ce_Unitaire__c = :pieceId 
                  AND Type__c = 'ENV'
                LIMIT 1
            ];
            
            hist.Statut_Chronopost__c = newStatus;
            update hist;
            
        } catch (Exception e) {
            throw new AuraHandledException('Erreur lors de la mise à jour du statut : ' + e.getMessage());
        }
    }

    // Classe wrapper utilitaire pour la méthode searchRecords
    public class IdLabel {

        @AuraEnabled public String value;
        @AuraEnabled public String label;
        @AuraEnabled public String sublabel;
        @AuraEnabled public String address;
        @AuraEnabled public String g2r;
        @AuraEnabled public String siteName;
        @AuraEnabled public String compteProjet;
    }
}