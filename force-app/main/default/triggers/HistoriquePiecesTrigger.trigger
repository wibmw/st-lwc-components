trigger HistoriquePiecesTrigger on Historique_Pi_ces__c (before insert) {
    // Logique déplacée directement dans MntGestionEnvoiLogistiqueCtrl.cls (saveEnvoi)
    // Statut_Envoi__c = 'Envoyé' est désormais défini inline lors de la création des Historique_Pi_ces__c de type 'ENV'
}
