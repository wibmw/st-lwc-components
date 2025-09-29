@isTest
private class MntLogistiqueCommandCockpitCtrl_T {

    @testSetup
    static void setupData() {

        Id me = UserInfo.getUserId();

        // --- Création Site ---
        sitetracker__Site__c site = new sitetracker__Site__c(
            Name = 'Site Test 001',
            Client__c = 'CIRCET',
            RecordTypeId = '012AW000007SnPHYA0',
            Logisticien__c = me
        );
        insert site;

        // --- Création Article ---
        Articles__c art = new Articles__c(
            Name = 'Article Test A',
            Radical__c = 'RADIA'
        );
        insert art;

        // --- Pièce Unitaire liée au Site + Article ---
        Pi_ces_Unitaires__c pu = new Pi_ces_Unitaires__c(
            Lieu__c = site.Id,
            Code_Article__c = art.Id
        );
        insert pu;
    }

    @isTest
    static void testSearchSites() {
        List<MntLogistiqueCommandCockpitCtrl.IdLabel> res =
            MntLogistiqueCommandCockpitCtrl.searchSites('Site Test', null, 10);
        System.assert(!res.isEmpty(), 'Résultats attendus pour searchSites');
        System.assertEquals('Site Test 001', res[0].label);
    }

    @isTest
    static void testSearchArticlesByName() {
        List<MntLogistiqueCommandCockpitCtrl.IdLabel> res =
            MntLogistiqueCommandCockpitCtrl.searchArticles('Article Test', 10);
        System.assert(!res.isEmpty(), 'Résultats attendus pour searchArticles (article)');
    }

    @isTest
    static void testSearchArticlesByRadical() {
        List<MntLogistiqueCommandCockpitCtrl.IdLabel> res =
            MntLogistiqueCommandCockpitCtrl.searchArticles('RADIA', 10);
        System.assert(!res.isEmpty(), 'Résultats attendus pour searchArticles (radical)');
    }

    @isTest
    static void testGetInventoryAggregatesMulti() {
        // 1. Récupération des données de test créées dans la méthode @testSetup
        sitetracker__Site__c s = [SELECT Id FROM sitetracker__Site__c LIMIT 1];
        
        // FIX 1: Récupérer l'ID de l'article, et non son nom.
        Articles__c a = [SELECT Id FROM Articles__c LIMIT 1];
    
        // FIX 2: Créer une liste d'IDs (List<Id>) au lieu d'une liste de chaînes (List<String>).
        List<Id> articleIds = new List<Id>{ a.Id };
    
        Test.startTest();
    
        // FIX 3: Passer la liste d'IDs à la méthode.
        List<MntLogistiqueCommandCockpitCtrl.AggregationRow> res =
            MntLogistiqueCommandCockpitCtrl.getInventoryAggregatesMulti(
                articleIds,
                new List<Id>{ s.Id },
                50,
                0
            );
    
        Test.stopTest();
    
        // 3. Vérifications (Assertions)
        System.assert(!res.isEmpty(), 'Des résultats étaient attendus pour getInventoryAggregatesMulti');
        System.assertEquals(1, res.size(), 'Un seul groupe de résultats aurait dû être retourné.');
        System.assertEquals(s.Id, res[0].siteId, 'L\'ID du site dans le résultat est incorrect.');
        System.assertEquals(a.Id, res[0].articleId, 'L\'ID de l\'article dans le résultat est incorrect.');
    }

    @isTest
    static void testCreateOrder() {
        sitetracker__Site__c s = [SELECT Id FROM sitetracker__Site__c LIMIT 1];
        Articles__c a = [SELECT Id FROM Articles__c LIMIT 1];

        MntLogistiqueCommandCockpitCtrl.OrderLineInput line =
            new MntLogistiqueCommandCockpitCtrl.OrderLineInput();
        line.siteId = s.Id;
        line.articleId = a.Id;
        line.quantity = 5;
        line.comment = 'Test commande';

        MntLogistiqueCommandCockpitCtrl.CreateOrderInput input =
            new MntLogistiqueCommandCockpitCtrl.CreateOrderInput();
        input.globalComment = 'Test global';
        input.lines = new List<MntLogistiqueCommandCockpitCtrl.OrderLineInput>{ line };

        Test.startTest();
        Id cmdId = MntLogistiqueCommandCockpitCtrl.createOrder(input);
        Test.stopTest();

        System.assertNotEquals(null, cmdId, 'Une commande doit être créée');
        System.assertEquals(1,
            [SELECT COUNT() FROM Commande_Pi_ces_D_tails__c WHERE Commande_Pi_ces__c = :cmdId],
            'Une ligne doit être créée');
    }
}
