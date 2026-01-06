public without sharing class OneClickPrintCtrl {

    public class PrintableFileInfo {
        @AuraEnabled public Id documentId;
        @AuraEnabled public String documentTitle;
        @AuraEnabled public String base64Content; // Contenu du fichier en base64 pour la fusion
    }

    @AuraEnabled(cacheable=false)
    public static List<PrintableFileInfo> preparePrintableFilesForListView(List<Id> recordIds) {
        if (recordIds == null || recordIds.isEmpty()) {
            return new List<PrintableFileInfo>();
        }

        List<PrintableFileInfo> results = new List<PrintableFileInfo>();
        Set<Id> processedEntityIds = new Set<Id>();

        List<ContentDocumentLink> links = [
            SELECT LinkedEntityId,
                   ContentDocument.LatestPublishedVersion.Id,
                   ContentDocument.LatestPublishedVersion.Title,
                   ContentDocument.LatestPublishedVersion.FileExtension
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :recordIds
            ORDER BY ContentDocument.CreatedDate DESC
        ];

        for (ContentDocumentLink cdl : links) {
            if (processedEntityIds.contains(cdl.LinkedEntityId)) {
                continue;
            }

            ContentVersion docVersion = cdl.ContentDocument.LatestPublishedVersion;
            if (docVersion == null) {
                continue;
            }

            String ext = docVersion.FileExtension != null ? docVersion.FileExtension.toLowerCase() : '';

            if (ext == 'pdf') {
                PrintableFileInfo info = new PrintableFileInfo();
                info.documentId = docVersion.Id;
                info.documentTitle = docVersion.Title;
                results.add(info);
                processedEntityIds.add(cdl.LinkedEntityId);
            }
        }
        
        return results;
    }

    /**
     * Récupère le contenu des fichiers PDF en base64 pour permettre la fusion côté client
     * Cette méthode est nécessaire car le fetch côté client échoue à cause des restrictions CORS
     */
    @AuraEnabled
    public static List<PrintableFileInfo> getPdfContentsForMerge(List<Id> contentVersionIds) {
        if (contentVersionIds == null || contentVersionIds.isEmpty()) {
            return new List<PrintableFileInfo>();
        }

        List<PrintableFileInfo> results = new List<PrintableFileInfo>();

        List<ContentVersion> versions = [
            SELECT Id, Title, VersionData
            FROM ContentVersion
            WHERE Id IN :contentVersionIds
        ];

        for (ContentVersion cv : versions) {
            PrintableFileInfo info = new PrintableFileInfo();
            info.documentId = cv.Id;
            info.documentTitle = cv.Title;
            info.base64Content = EncodingUtil.base64Encode(cv.VersionData);
            results.add(info);
        }
        
        return results;
    }

    /**
     * Récupère l'ID du Lieu (Site) depuis les enregistrements Pi_ce_Unitaire__c
     * Retourne l'ID du Lieu du dernier enregistrement qui a un Lieu renseigné
     */
    @AuraEnabled
    public static Id getSiteIdFromRecords(List<Id> recordIds) {
        if (recordIds == null || recordIds.isEmpty()) {
            return null;
        }

        // Récupérer le Lieu__c des enregistrements Pi_ce_Unitaire__c
        List<Pi_ce_Unitaire__c> pieces = [
            SELECT Id, Lieu__c 
            FROM Pi_ce_Unitaire__c 
            WHERE Id IN :recordIds 
            AND Lieu__c != null
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];

        if (!pieces.isEmpty()) {
            return pieces[0].Lieu__c;
        }
        
        return null;
    }
}