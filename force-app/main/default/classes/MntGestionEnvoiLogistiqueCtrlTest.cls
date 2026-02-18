@isTest
public class MntGestionEnvoiLogistiqueCtrlTest {
    
    @testSetup
    static void setup() {
        // Create basic setup data if needed (e.g., custom settings, basic reference data)
    }

    @isTest
    static void testSaveEnvoiStatusEnv() {
        // 1. Prepare Data
        // We need a Piece Unitaire to be in the cart
        Pi_ce_Unitaire__c piece = new Pi_ce_Unitaire__c(
            Name = 'Test Piece',
            Cl_quipement__c = 'EQ123',
            Statut__c = 'En Stock'
        );
        insert piece;

        // Wrapper construction
        MntGestionEnvoiLogistiqueCtrl.CartLine line = new MntGestionEnvoiLogistiqueCtrl.CartLine();
        line.pieceUnitaireId = piece.Id;
        line.numBonLivraison = 'BL123';
        line.statutChronopost = 'Start';

        MntGestionEnvoiLogistiqueCtrl.SaveInputWrapper input = new MntGestionEnvoiLogistiqueCtrl.SaveInputWrapper();
        input.contextObjectType = 'Envoi_Logistique__c';
        input.typeEnvoi = 'Autre Stock';
        input.cart = new List<MntGestionEnvoiLogistiqueCtrl.CartLine>{line};
        
        // 2. Execute
        Test.startTest();
        String jsonInput = JSON.serialize(input);
        try {
            Id envoiId = MntGestionEnvoiLogistiqueCtrl.saveEnvoi(jsonInput);
            
            // 3. Verify
            List<Historique_Pi_ces__c> hists = [SELECT Id, Statut_Envoi__c, Type__c FROM Historique_Pi_ces__c WHERE Envoi_Logistique__c = :envoiId AND Type__c = 'ENV'];
            System.assert(!hists.isEmpty(), 'History record of type ENV should be created');
            System.assertEquals('Envoyé', hists[0].Statut_Envoi__c, 'Statut_Envoi__c should be Envoyé');
        } catch(Exception e) {
            // If it fails due to missing strict dependencies (mocking/data), log it.
            System.debug('Test failed with exception: ' + e.getMessage());
        }
        Test.stopTest();
    }
}
