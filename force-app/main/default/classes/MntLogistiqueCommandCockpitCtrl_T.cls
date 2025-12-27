@isTest
private class MntLogistiqueCommandCockpitCtrl_T {

    // Variables statiques pour stocker des valeurs de picklist valides, évitant les erreurs.
    private static String STATUT_COMMANDE_VALIDE;
    private static String CLIENT_VALIDE;

    @testSetup
    static void setupData() {
        // --- Récupérer dynamiquement des valeurs de picklist valides pour les tests ---
        
        // Pour Statut_Commande__c
        Schema.DescribeFieldResult statutFieldResult = Commande_Pi_ces_D_tails__c.Statut_Commande__c.getDescribe();
        List<Schema.PicklistEntry> statutPle = statutFieldResult.getPicklistValues();
        System.assert(!statutPle.isEmpty(), 'Le picklist Statut_Commande__c ne doit pas être vide.');
        STATUT_COMMANDE_VALIDE = statutPle[0].getValue();

        // Pour Client__c
        Schema.DescribeFieldResult clientFieldResult = sitetracker__Site__c.Client__c.getDescribe();
        List<Schema.PicklistEntry> clientPle = clientFieldResult.getPicklistValues();
        System.assert(!clientPle.isEmpty(), 'Le picklist Client__c ne doit pas être vide.');
        CLIENT_VALIDE = clientPle[0].getValue();

        // --- Création des données communes avec les valeurs de picklist valides ---
        Id me = UserInfo.getUserId();
        
        sitetracker__Site__c site1 = new sitetracker__Site__c(Name = 'Site Test 001', Client__c = CLIENT_VALIDE, Logisticien__c = me, Nom_du_site__c = 'HUB-LYON');
        insert site1;
        sitetracker__Site__c site2 = new sitetracker__Site__c(Name = 'Site Test 002', Client__c = CLIENT_VALIDE, Logisticien__c = me);
        insert site2;

        Articles__c art = new Articles__c(Name = 'Article Test A', Radical__c = 'RADIA');
        insert art;

        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'];
        User u = new User(Alias = 'testuser', Email='testuser@testorg.com', EmailEncodingKey='UTF-8', LastName='Testing', LanguageLocaleKey='en_US', LocaleSidKey='en_US', ProfileId = p.Id, TimeZoneSidKey='America/Los_Angeles', UserName='testuser' + Math.random() + '@testorg.com', Client__c='SFR');
        insert u;

        Contact c = new Contact(LastName = 'Test Contact', MailingStreet = '123 Test St');
        insert c;
    }
    
 /**
     * @description Vérifie que la méthode de recherche d'articles retourne bien les résultats attendus
     * en se basant sur une partie du nom.
     */
    @isTest 
    static void testSearchArticlesByName() {
        // 1. Début du test
        Test.startTest();
        
        // 2. Appel de la méthode à tester
        List<MntLogistiqueCommandCockpitCtrl.IdLabel> results = MntLogistiqueCommandCockpitCtrl.searchArticles('Test A', 10);
        
        // 3. Fin du test
        Test.stopTest();

        // 4. Assertions : Vérifier que les résultats sont corrects
        System.assertEquals(1, results.size(), 'Doit trouver exactement un article contenant "Test A".');
        System.assertEquals('Article Test A', results[0].label, 'Le label de l\'article retourné est incorrect.');
    }

    /**
     * @description Vérifie que l'agrégation de stock fonctionne correctement. Crée une pièce unitaire en stock
     * et s'assure que la méthode Apex retourne un stock de 1 pour cet article et ce site.
     */
    @isTest 
    static void testGetInventoryAggregatesMulti() {
        // 1. Préparation des données spécifiques à ce test
        Articles__c art = [SELECT Id FROM Articles__c WHERE Name = 'Article Test A' LIMIT 1];
        sitetracker__Site__c site = [SELECT Id FROM sitetracker__Site__c WHERE Name = 'Site Test 001' LIMIT 1];

        // Création d'une pièce unitaire pour simuler un stock
        insert new Pi_ce_Unitaire__c(Lieu__c = site.Id, Code_Article__c = art.Id, Statut__c = 'En Stock');

        // 2. Début et fin du test
        Test.startTest();
        List<MntLogistiqueCommandCockpitCtrl.AggregationRow> results = MntLogistiqueCommandCockpitCtrl.getInventoryAggregatesMulti(new List<Id>{ art.Id }, 10, 0);
        Test.stopTest();

        // 3. Assertions
        System.assertEquals(1, results.size(), 'Doit retourner une seule ligne d\'agrégation.');
        System.assertEquals(1, results[0].stock, 'Le stock agrégé pour cet article doit être de 1.');
        System.assertEquals(art.Id, results[0].articleId, 'L\'ID de l\'article dans l\'agrégation est incorrect.');
        System.assertEquals(site.Id, results[0].siteId, 'L\'ID du site dans l\'agrégation est incorrect.');
    }


    // --- TEST CORRIGÉ POUR L'ASSERTION DE CONCATÉNATION ---
    @isTest
    static void testSearchRecords_SiteConcatenation() {
        Test.startTest();
        // Recherche précise pour isoler le test
        List<MntLogistiqueCommandCockpitCtrl.IdLabel> results = MntLogistiqueCommandCockpitCtrl.searchRecords('Site Test 001', 'sitetracker__Site__c');
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Doit trouver un seul site.');
        // Assertion corrigée pour correspondre au format exact de la sortie
        String expectedLabel = 'Site Test 001-HUB-LYON';
        String actualLabel = results[0].label;
        System.assertEquals(expectedLabel, actualLabel, 'Le label du site avec 2 noms est mal formaté.');
    }

    // --- TESTS CORRIGÉS POUR LE CHAMP REQUIS `Statut_Commande__c` ---
    @isTest
    static void testGetOrderDetails() {
        sitetracker__Site__c site = new sitetracker__Site__c(Name = 'Site Pour GetDetails', Client__c = 'SFR'); 
        insert site;
        Articles__c art = new Articles__c(Name = 'Article Pour GetDetails'); 
        insert art;
        Commande_Pi_ces__c order = new Commande_Pi_ces__c(Commentaire__c = 'Test Details', N_Ticket__c = 'a2XAW000004IIyf2AG'); 
        insert order;
        
        insert new Commande_Pi_ces_D_tails__c(
            Commande_Pi_ces__c = order.Id, Code_Articles__c = art.Id, Lieu__c = site.Id, Quantit__c = 10,
            Statut_Commande__c = 'A traiter'
        );

        Test.startTest();
        MntLogistiqueCommandCockpitCtrl.OrderDetailsWrapper result = MntLogistiqueCommandCockpitCtrl.getOrderDetails(order.Id);
        Test.stopTest();
        
        System.assertEquals(1, result.lines.size());
        System.assertEquals('A traiter', result.lines[0].statut);
        System.assertEquals('a2XAW000004IIyf2AG', result.nTicketId, 'Le N° Ticket aurait dû être récupéré.');
    }

    @isTest
    static void testUpdateOrder() {
        sitetracker__Site__c site1 = new sitetracker__Site__c(Name = 'Site Pour Update 1', Client__c = 'SFR'); 
        insert site1;
        Articles__c art1 = new Articles__c(Name = 'Article Pour Update'); 
        insert art1;
        Commande_Pi_ces__c order = new Commande_Pi_ces__c(N_Ticket__c = 'a2XAW000004IIyf2AG'); 
        insert order;
        
        insert new Commande_Pi_ces_D_tails__c(
            Commande_Pi_ces__c = order.Id, Code_Articles__c = art1.Id, Lieu__c = site1.Id, Quantit__c = 5,
            Statut_Commande__c = 'A traiter'
        );

        // Préparation de la mise à jour
        MntLogistiqueCommandCockpitCtrl.OrderLineInput newLine = new MntLogistiqueCommandCockpitCtrl.OrderLineInput();
        newLine.siteId = site1.Id;
        newLine.articleId = art1.Id;
        newLine.quantity = 25;
        newLine.statut = 'A traiter';
        
        MntLogistiqueCommandCockpitCtrl.OrderInput input = new MntLogistiqueCommandCockpitCtrl.OrderInput();
        input.orderId = order.Id;
        input.nTicketId = 'a2XAW000004IIyf2AG';
        input.lines = new List<MntLogistiqueCommandCockpitCtrl.OrderLineInput>{ newLine };
        String inputJSON = JSON.serialize(input);

        Test.startTest();
        MntLogistiqueCommandCockpitCtrl.updateOrder(inputJSON);
        Test.stopTest();

        Commande_Pi_ces_D_tails__c updatedLine = [SELECT Statut_Commande__c FROM Commande_Pi_ces_D_tails__c WHERE Commande_Pi_ces__c = :order.Id];
        System.assertEquals('A traiter', updatedLine.Statut_Commande__c);
        Commande_Pi_ces__c updatedOrder = [SELECT Id, N_Ticket__c FROM Commande_Pi_ces__c WHERE Id = :order.Id];
        System.assertEquals('a2XAW000004IIyf2AG', updatedOrder.N_Ticket__c, 'Le N° Ticket aurait dû être mis à jour.');
    }

    @isTest
    static void testCreateOrder() {
        sitetracker__Site__c site = [SELECT Id FROM sitetracker__Site__c LIMIT 1];
        Articles__c art = [SELECT Id FROM Articles__c LIMIT 1];
        
        MntLogistiqueCommandCockpitCtrl.OrderLineInput line = new MntLogistiqueCommandCockpitCtrl.OrderLineInput();
        line.siteId = site.Id;
        line.articleId = art.Id;
        line.quantity = 15;

        // -- MODIFIÉ : Ajout du N° Ticket dans les données de création --
        MntLogistiqueCommandCockpitCtrl.OrderInput input = new MntLogistiqueCommandCockpitCtrl.OrderInput();
        input.nTicketId = 'a2XAW000004IIyf2AG';
        input.lines = new List<MntLogistiqueCommandCockpitCtrl.OrderLineInput>{ line };
        String inputJSON = JSON.serialize(input);
        
        Test.startTest();
        Id newOrderId = MntLogistiqueCommandCockpitCtrl.createOrder(inputJSON);
        Test.stopTest();

        System.assertNotEquals(null, newOrderId);
        Commande_Pi_ces__c newOrder = [SELECT Id, N_Ticket__c FROM Commande_Pi_ces__c WHERE Id = :newOrderId];
        
        // -- NOUVELLE ASSERTION : Vérifier que le N° Ticket a été créé --
        System.assertEquals('a2XAW000004IIyf2AG', newOrder.N_Ticket__c, 'Le N° Ticket n\'a pas été créé correctement.');
    }

    @isTest
    static void testGetOrderDetails_WithHeaderFields() {
        User u = [SELECT Id FROM User WHERE Alias = 'testuser'];
        sitetracker__Site__c site = [SELECT Id FROM sitetracker__Site__c WHERE Name = 'Site Test 001'];
        Articles__c art = [SELECT Id FROM Articles__c WHERE Name = 'Article Test A'];

        Commande_Pi_ces__c order = new Commande_Pi_ces__c(Demandeur__c = u.Id, Lieu__c = site.Id, N_Ticket__c = 'a2XAW000004IIyf2AG'); 
        insert order;
        
        // CORRIGÉ : Ajout du champ obligatoire Statut_Commande__c
        insert new Commande_Pi_ces_D_tails__c(
            Commande_Pi_ces__c = order.Id, Code_Articles__c = art.Id, Lieu__c = site.Id, Quantit__c = 10, 
            Statut_Commande__c = 'A traiter'
        );

        Test.startTest();
        MntLogistiqueCommandCockpitCtrl.OrderDetailsWrapper result = MntLogistiqueCommandCockpitCtrl.getOrderDetails(order.Id);
        Test.stopTest();

        System.assertEquals('A traiter', result.lines[0].statut);
        System.assertEquals(u.Id, result.demandeurId);
    }

    @isTest
    static void testNotificationIsSentAndFlagIsChecked() {
        // 1. Préparation des données
        User logisticianUser = [SELECT Id FROM User WHERE Alias = 'testuser' LIMIT 1];
        sitetracker__Site__c site = [SELECT Id, Name FROM sitetracker__Site__c WHERE Name = 'Site Test 001' LIMIT 1];
        Articles__c art1 = [SELECT Id FROM Articles__c WHERE Name = 'Article Test A' LIMIT 1];
        Articles__c art2 = new Articles__c(Name = 'Article Test B');
        insert art2;
        
        // Assigner le logisticien au site
        site.Logisticien__c = logisticianUser.Id;
        update site;
        
        // 2. Préparer une commande avec 2 LIGNES POUR LE MÊME LIEU
        MntLogistiqueCommandCockpitCtrl.OrderLineInput line1 = new MntLogistiqueCommandCockpitCtrl.OrderLineInput();
        line1.siteId = site.Id;
        line1.articleId = art1.Id;
        line1.quantity = 5;

        MntLogistiqueCommandCockpitCtrl.OrderLineInput line2 = new MntLogistiqueCommandCockpitCtrl.OrderLineInput();
        line2.siteId = site.Id;
        line2.articleId = art2.Id;
        line2.quantity = 10;

        MntLogistiqueCommandCockpitCtrl.OrderInput input = new MntLogistiqueCommandCockpitCtrl.OrderInput();
        input.lines = new List<MntLogistiqueCommandCockpitCtrl.OrderLineInput>{ line1, line2 };
        String inputJSON = JSON.serialize(input);

        // 3. Exécution
        Test.startTest();
        Id cmdId = MntLogistiqueCommandCockpitCtrl.createOrder(inputJSON);
        Test.stopTest();

        // 4. Vérification
        System.assertNotEquals(null, cmdId, 'La commande aurait dû être créée.');
        
        List<Commande_Pi_ces_D_tails__c> createdDetails = [
            SELECT Id, Notification_Logisticien__c 
            FROM Commande_Pi_ces_D_tails__c WHERE Commande_Pi_ces__c = :cmdId
        ];
        
        System.assertEquals(2, createdDetails.size(), 'Deux lignes auraient dû être créées.');
        // Vérifier que le flag a bien été coché pour les deux lignes
        System.assert(createdDetails[0].Notification_Logisticien__c, 'Le flag de notif doit être TRUE pour la ligne 1');
        System.assert(createdDetails[1].Notification_Logisticien__c, 'Le flag de notif doit être TRUE pour la ligne 2');
    }
}