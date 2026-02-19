public without sharing class MntMobilePieceReceptionCtrl {
    
    public class PieceUnitaireWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String title;
        @AuraEnabled public String subtitle;
        @AuraEnabled public String type;
        @AuraEnabled public Integer qty;
        @AuraEnabled public String serialNumber;
        @AuraEnabled public String status;
        
        public PieceUnitaireWrapper(Pi_ce_Unitaire__c p) {
            this.id = p.Id;
            this.title = String.isNotBlank(p.Article__c) ? p.Article__c : p.Name;
            this.subtitle = p.Name;
            this.type = 'Matériel';
            this.qty = 1;
            this.serialNumber = p.N_Serie__c;
            this.status = p.Statut__c;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<PieceUnitaireWrapper> getPiecesAReceptionner(Id siteId) {
        String userName = UserInfo.getName();
        // Note: Liste_Logisticiens__c is a Text Area, so we use LIKE. 
        // We assume the format is "Firstname Lastname" or similar.
        String searchName = '%' + userName + '%';
        
        List<PieceUnitaireWrapper> results = new List<PieceUnitaireWrapper>();
        
        try {
            Set<Id> siteIds = new Set<Id>();

            // If siteId is provided, check if user is logistician for THIS site
            if (siteId != null) {
                List<sitetracker__Site__c> currentSite = [
                    SELECT Id 
                    FROM sitetracker__Site__c 
                    WHERE Id = :siteId AND Liste_Logisticiens__c LIKE :searchName
                ];
                if (!currentSite.isEmpty()) {
                    siteIds.add(siteId);
                }
            } else {
                // Fallback: Find ALL Sites where the user is a logistician
                for(sitetracker__Site__c s : [SELECT Id FROM sitetracker__Site__c WHERE Liste_Logisticiens__c LIKE :searchName]) {
                    siteIds.add(s.Id);
                }
            }
            
            if (siteIds.isEmpty()) {
                return results;
            }
            
            // 2. Query Pi_ce_Unitaire__c records
            List<Pi_ce_Unitaire__c> pieces = [
                SELECT Id, Name, Article__c, N_Serie__c, Statut__c
                FROM Pi_ce_Unitaire__c
                WHERE Lieu__c IN :siteIds 
                AND Statut__c = 'A Réceptionner'
                ORDER BY CreatedDate DESC
                LIMIT 200
            ];
            
            for(Pi_ce_Unitaire__c p : pieces) {
                results.add(new PieceUnitaireWrapper(p));
            }
            
        } catch (Exception e) {
            throw new AuraHandledException('Erreur lors de la récupération des pièces : ' + e.getMessage());
        }
        
        return results;
    }
}
