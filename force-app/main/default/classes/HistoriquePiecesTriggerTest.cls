@isTest
public class HistoriquePiecesTriggerTest {
    
    @isTest
    static void testHistoriquePiecesTrigger() {
        // Create necessary related records if any (assuming simplest case for now, modify if validation rules fail)
        // Since we don't know mandatory fields, we'll try minimal creation first.
        
        // Test Case 1: Type = 'ENV'
        Historique_Pi_ces__c histEnv = new Historique_Pi_ces__c(
            Type__c = 'ENV'
        );
        
        // Test Case 2: Type != 'ENV'
        Historique_Pi_ces__c histOther = new Historique_Pi_ces__c(
            Type__c = 'OTHER'
        );
        
        Test.startTest();
        insert new List<Historique_Pi_ces__c>{histEnv, histOther};
        Test.stopTest();
        
        // Reload records to check field updates
        Historique_Pi_ces__c loadedEnv = [SELECT Id, Statut_Envoi__c FROM Historique_Pi_ces__c WHERE Id = :histEnv.Id];
        Historique_Pi_ces__c loadedOther = [SELECT Id, Statut_Envoi__c FROM Historique_Pi_ces__c WHERE Id = :histOther.Id];
        
        System.assertEquals('Envoyé', loadedEnv.Statut_Envoi__c, 'Statut_Envoi__c should be Envoyé for ENV type');
        System.assertNotEquals('Envoyé', loadedOther.Statut_Envoi__c, 'Statut_Envoi__c should not be automatically set for non-ENV type');
    }
}
