public with sharing class OneClickPrintCtrl {

    public class PrintableFileInfo {
        @AuraEnabled public Id documentId;
        @AuraEnabled public String documentTitle;
    }

    @AuraEnabled(cacheable=false)
    public static List<PrintableFileInfo> preparePrintableFilesForListView(List<Id> recordIds) {
        // --- LOG 1: Vérifier les IDs reçus ---
        System.debug('--- OneClickPrint --- Début du traitement.');
        System.debug('IDs reçus : ' + recordIds);

        if (recordIds == null || recordIds.isEmpty()) {
            System.debug('La liste des IDs est vide. Arrêt.');
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

        // --- LOG 2: Vérifier si la requête a trouvé des fichiers ---
        System.debug('Nombre de fichiers liés trouvés : ' + links.size());
        
        if (links.isEmpty()) {
            System.debug('Aucun ContentDocumentLink trouvé pour ces IDs. Assurez-vous que les enregistrements ont bien des fichiers attachés.');
        }

        for (ContentDocumentLink cdl : links) {
            // --- LOG 3: Log pour chaque fichier trouvé ---
            System.debug('Traitement du fichier pour l\'enregistrement : ' + cdl.LinkedEntityId);

            if (processedEntityIds.contains(cdl.LinkedEntityId)) {
                System.debug('Cet enregistrement a déjà un fichier traité. On passe au suivant.');
                continue;
            }

            ContentVersion docVersion = cdl.ContentDocument.LatestPublishedVersion;
            if (docVersion == null) {
                System.debug('Le fichier n\'a pas de "LatestPublishedVersion". On l\'ignore.');
                continue;
            }

            String ext = docVersion.FileExtension != null ? docVersion.FileExtension.toLowerCase() : '';
            System.debug('Titre du fichier : ' + docVersion.Title + ', Extension: ' + ext);

            Id finalVersionId = null;

            // ... (le reste de la logique reste inchangé)
            // Note: N'oubliez pas que la conversion des fichiers Word/Excel
            // nécessite toujours une API externe comme discuté précédemment.
            if (ext == 'pdf') {
                finalVersionId = docVersion.Id;
                 System.debug('Fichier PDF trouvé. ID de version : ' + finalVersionId);
            } else if (ext == 'doc' || ext == 'docx' || ext == 'xls' || ext == 'xlsx' || ext == 'txt') {
                System.debug('Type de fichier nécessitant une conversion (' + ext + '). Logique de conversion non implémentée.');
                // Ici, vous auriez l'appel à l'API externe. Pour l'instant, on lance une erreur.
                throw new AuraHandledException('La conversion pour le format "' + ext + '" n\'est pas encore implémentée.');
            } else {
                System.debug('Extension non supportée (' + ext + '). Fichier ignoré.');
            }
            
            if (finalVersionId != null) {
                PrintableFileInfo info = new PrintableFileInfo();
                info.documentId = finalVersionId;
                info.documentTitle = docVersion.Title;
                results.add(info);
                processedEntityIds.add(cdl.LinkedEntityId);
            }
        }
        
        // --- LOG 4: Afficher le résultat final ---
        System.debug('Traitement terminé. Nombre de documents imprimables préparés : ' + results.size());
        System.debug('Résultats : ' + results);
        return results;
    }
}