trigger HistoriquePiecesTrigger on Historique_Pi_ces__c (before insert) {
    for (Historique_Pi_ces__c hist : Trigger.new) {
        if (hist.Type__c == 'ENV') {
            hist.Statut_Envoi__c = 'Envoyé';
        }
    }
}
