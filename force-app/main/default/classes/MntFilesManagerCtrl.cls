public with sharing class MntFilesManagerCtrl {

    public class FileInfo {
        @AuraEnabled public String title;
        @AuraEnabled public String base64Data;
    }

    public class AttachedFile {
        @AuraEnabled public Id id;
        @AuraEnabled public String title;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String contentVersionId;
    }

    @AuraEnabled
    public static void uploadFiles(Id recordId, List<FileInfo> files) {
        List<ContentVersion> cvList = new List<ContentVersion>();
        for (FileInfo file : files) {
            ContentVersion cv = new ContentVersion();
            cv.Title = file.title;
            cv.PathOnClient = file.title;
            cv.VersionData = EncodingUtil.base64Decode(file.base64Data);
            cv.FirstPublishLocationId = recordId; 
            cvList.add(cv);
        }
        insert cvList;
    }

    @AuraEnabled(cacheable=true)
    public static List<AttachedFile> getAttachedFiles(Id recordId) {
        List<AttachedFile> results = new List<AttachedFile>();
        for (ContentDocumentLink link : [SELECT ContentDocumentId, ContentDocument.LatestPublishedVersionId, ContentDocument.Title FROM ContentDocumentLink WHERE LinkedEntityId = :recordId]) {
            AttachedFile f = new AttachedFile();
            f.id = link.ContentDocumentId; 
            f.contentDocumentId = link.ContentDocumentId;
            f.contentVersionId = link.ContentDocument.LatestPublishedVersionId; 
            f.title = link.ContentDocument.Title;
            results.add(f);
        }
        return results;
    }
}
