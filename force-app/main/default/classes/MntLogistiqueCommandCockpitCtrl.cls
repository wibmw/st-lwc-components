public with sharing class MntLogistiqueCommandCockpitCtrl {

    // ===================== CONFIG (adapte si besoin) =========================
    private static final String OBJ_SITE        = 'sitetracker__Site__c';
    private static final String FIELD_SITE_NAME = 'Name';
    private static final String FIELD_SITE_OWNER= 'Logisticien__c';

    private static final String OBJ_ARTICLE     = 'Articles__c';
    private static final String FIELD_ART_NAME  = 'Name';
    private static final String FIELD_ART_RADICAL = 'Radical__c';

    private static final String OBJ_PU          = 'Pi_ces_Unitaires__c';
    private static final String FIELD_PU_SITE   = 'Lieu__c';
    private static final String FIELD_PU_ART    = 'Code_Article__';

    private static final String OBJ_CMD         = 'Commande_Pi_ces__c';
    private static final String FIELD_CMD_COMMENT = 'Commentaire__c';
    private static final String FIELD_CMD_DATE    = 'Date_Commande__c';
    private static final String FIELD_CMD_DEMANDEUR = 'Demandeur__c';

    private static final String OBJ_DET         = 'Commande_Pi_ces_D_tails__c';
    private static final String FIELD_DET_HDR   = 'Commande_Pi_ces__c';
    private static final String FIELD_DET_ART   = 'Code_Articles__c';
    private static final String FIELD_DET_QTY   = 'Quantit__c';
    private static final String FIELD_DET_COMMENT = 'Commentaire__c';

    private static final String CNT_DEV_NAME    = 'Logistique_Commande';
    // ========================================================================

    // ---------------------- DTOs exposés au LWC ------------------------------
    public class IdLabel {
        @AuraEnabled public Id value;
        @AuraEnabled public String label;
        public IdLabel() {}
        public IdLabel(Id v, String l){ value=v; label=l; }
    }
    public class AggregationRow {
        @AuraEnabled public Id siteId;
        @AuraEnabled public String siteName;
        @AuraEnabled public Id articleId;
        @AuraEnabled public String articleName;
        @AuraEnabled public String radical;
        @AuraEnabled public Integer stock;
    }
    public class OrderLineInput {
        @AuraEnabled public Id siteId;
        @AuraEnabled public Id articleId;
        @AuraEnabled public Integer quantity;
        @AuraEnabled public String comment;
    }
    public class CreateOrderInput {
        @AuraEnabled public String globalComment;
        @AuraEnabled public List<OrderLineInput> lines;
    }
    // ------------------------------------------------------------------------

    // --------- Utils sécurité -----------------------------------------------
    private static void checkCreateAccess(String objApi){
        if(!Schema.getGlobalDescribe().get(objApi).getDescribe().isCreateable()){
            throw new AuraHandledException('Droits insuffisants pour créer : ' + objApi);
        }
    }
    // ------------------------------------------------------------------------

    /**
     * Recherche autocomplete Sites (≥ 3 caractères)
     */
    @AuraEnabled(cacheable=true)
    public static List<IdLabel> searchSites(String term, List<Id> excludeIds, Integer limitSize) {
        List<IdLabel> outp = new List<IdLabel>();
        if (String.isBlank(term) || term.trim().length() < 3) return outp;
    
        limitSize = (limitSize == null || limitSize <= 0) ? 50 : Math.min(limitSize, 50);
    
        String t = term.trim().replace('%','\\%').replace('_','\\_');
        String termLike = '%' + t + '%';
    
        String query = 'SELECT Id, ' + FIELD_SITE_NAME +
                       ' FROM ' + OBJ_SITE +
                       ' WHERE ' + FIELD_SITE_NAME + ' LIKE :termLike ' +
                       (excludeIds != null && !excludeIds.isEmpty() ? ' AND Id NOT IN :excludeIds ' : '') +
                       ' ORDER BY ' + FIELD_SITE_NAME +
                       ' LIMIT :limitSize';
    
        List<SObject> res = Database.query(query);
    
        for (SObject s : res) {
            outp.add(new IdLabel((Id)s.get('Id'), (String)s.get(FIELD_SITE_NAME)));
        }
        return outp;
    }


    /**
     * Recherche autocomplete Articles ou Radicaux (≥ 3 caractères)
     */
    @AuraEnabled(cacheable=true)
    public static List<IdLabel> searchArticles(String term, Integer limitSize) {
        // 1. Validation des entrées
        if (String.isBlank(term) || term.trim().length() < 3) {
            return new List<IdLabel>();
        }

        // 2. Préparation des variables
        limitSize = (limitSize == null || limitSize <= 0) ? 50 : Math.min(limitSize, 50);
        String likeTerm = '%' + term.trim() + '%';
        
        // 3. Exécution d'une seule requête SOQL unifiée
        // La clause WHERE recherche le terme dans le nom OU dans le radical.
        List<Articles__c> results = [
            SELECT Id, Name, Radical__c 
            FROM Articles__c 
            WHERE Name LIKE :likeTerm OR Radical__c LIKE :likeTerm
            ORDER BY Name, Radical__c // Trie les résultats de manière cohérente
            LIMIT :limitSize
        ];

        // 4. Traitement des résultats de manière unifiée
        List<IdLabel> output = new List<IdLabel>();
        for (Articles__c article : results) {
            // Création d'un libellé informatif pour l'utilisateur
            String label = String.isBlank(article.Radical__c) 
                ? article.Name 
                : article.Name + ' — ' + article.Radical__c;
            output.add(new IdLabel(article.Id, label));
        }
        
        return output;
    }
    
    /**
     * Agrégats d’inventaire par Site + Article
     * Multi sélection obligatoire : values = liste d’Articles (Name) ou Radicaux
     */
    @AuraEnabled(cacheable=true)
    public static List<AggregationRow> getInventoryAggregatesMulti(
        List<Id> values,
        List<Id> siteIds,
        Integer limitSize,
        Integer offsetVal
    ){
        if (values == null || values.isEmpty()) return new List<AggregationRow>();
        limitSize = (limitSize == null || limitSize <= 0) ? 200 : Math.min(limitSize, 2000);
        offsetVal = (offsetVal == null || offsetVal < 0) ? 0 : offsetVal;

        String soql =
            'SELECT ' + FIELD_PU_SITE + ' siteId, ' +
            '           Lieu__r.Name siteName, ' +
            '       ' + FIELD_PU_ART  + 'c articleId, ' +
            '       ' + FIELD_PU_ART  + 'r.Name articleName, ' +
            '       ' + FIELD_PU_ART  + 'r.' + FIELD_ART_RADICAL + ' rad, ' +
            '       COUNT(Id) qty ' +
            'FROM ' + OBJ_PU + ' WHERE Id != null ';

        if (siteIds != null && !siteIds.isEmpty()) {
            soql += ' AND ' + FIELD_PU_SITE + ' IN :siteIds ';
        }
        if (values != null && !values.isEmpty()) {
            soql += ' AND ' + FIELD_PU_ART + 'c IN :values';
        }

        soql += ' GROUP BY ' + FIELD_PU_SITE + ', Lieu__r.Name, ' + FIELD_PU_ART + 'c , ' + FIELD_PU_ART  + 'r.Name, ' + FIELD_PU_ART + 'r.' + FIELD_ART_RADICAL;
        soql += ' ORDER BY Lieu__r.Name, ' + FIELD_PU_ART + 'r.Name';
        soql += ' LIMIT :limitSize OFFSET :offsetVal';

        List<AggregationRow> out = new List<AggregationRow>();
        List<Id> siteIdsFound = new List<Id>();
        List<Id> artIdsFound  = new List<Id>();

        for (AggregateResult ar : Database.query(soql)) {
            AggregationRow r = new AggregationRow();
            r.siteId    = (Id) ar.get('siteId');
            r.siteName    = (String) ar.get('siteName');
            r.articleId = (Id) ar.get('articleId');
            r.articleName = (String) ar.get('articleName');
            r.radical   = (String) ar.get('rad');
            r.stock     = (Integer) ar.get('qty');
            siteIdsFound.add(r.siteId);
            artIdsFound.add(r.articleId);
            out.add(r);
        }

        if (!out.isEmpty()) {
            if (!siteIdsFound.isEmpty()) {
                Map<Id, SObject> siteMap = new Map<Id, SObject>(
                    Database.query('SELECT Id, ' + FIELD_SITE_NAME + ' FROM ' + OBJ_SITE + ' WHERE Id IN :siteIdsFound')
                );
                for (AggregationRow r : out) {
                    if (siteMap.containsKey(r.siteId)) {
                        r.siteName = (String) siteMap.get(r.siteId).get(FIELD_SITE_NAME);
                    }
                }
            }
            if (!artIdsFound.isEmpty()) {
                Map<Id, SObject> artMap = new Map<Id, SObject>(
                    Database.query('SELECT Id, ' + FIELD_ART_NAME + ' FROM ' + OBJ_ARTICLE + ' WHERE Id IN :artIdsFound')
                );
                for (AggregationRow r : out) {
                    if (artMap.containsKey(r.articleId)) {
                        r.articleName = (String) artMap.get(r.articleId).get(FIELD_ART_NAME);
                    }
                }
            }
        }
        return out;
    }

    /**
     * Création commande + lignes
     */
    @AuraEnabled
    public static Id createOrder(CreateOrderInput input){
        if(input == null || input.lines == null || input.lines.isEmpty()){
            throw new AuraHandledException('Aucune ligne à commander.');
        }

        checkCreateAccess(OBJ_CMD);
        checkCreateAccess(OBJ_DET);

        SObject cmd = Schema.getGlobalDescribe().get(OBJ_CMD).newSObject();
        if(!String.isBlank(input.globalComment)) cmd.put(FIELD_CMD_COMMENT, input.globalComment);
        if(cmd.getSObjectType().getDescribe().fields.getMap().containsKey(FIELD_CMD_DATE)){
            cmd.put(FIELD_CMD_DATE, System.today());
        }
        if(cmd.getSObjectType().getDescribe().fields.getMap().containsKey(FIELD_CMD_DEMANDEUR)){
            cmd.put(FIELD_CMD_DEMANDEUR, UserInfo.getUserId());
        }
        insert cmd;

        List<SObject> details = new List<SObject>();
        for(OrderLineInput l : input.lines){
            SObject d = Schema.getGlobalDescribe().get(OBJ_DET).newSObject();
            d.put(FIELD_DET_HDR, cmd.Id);
            d.put(FIELD_DET_ART, l.articleId);
            d.put(FIELD_DET_QTY, l.quantity);
            if(!String.isBlank(l.comment)) d.put(FIELD_DET_COMMENT, l.comment);
            details.add(d);
        }
        if(!details.isEmpty()) insert details;

        return (Id) cmd.get('Id');
    }
}
