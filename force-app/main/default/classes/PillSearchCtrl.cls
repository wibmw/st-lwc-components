/**
 * @description Generic Apex controller for PillSearch LWC component
 * Supports dynamic SOQL queries with relationship fields and custom filters
 * @author Antigravity AI
 * @date 2026-01-30
 */
public with sharing class PillSearchCtrl {
    
    /**
     * @description Search records based on dynamic criteria
     * @param searchTerm Search text entered by user
     * @param sObjectType Salesforce object API name
     * @param searchFields Comma-separated fields to search (supports relationships like 'Account.Name')
     * @param displayFields Comma-separated fields to display (supports relationships)
     * @param filterClause Optional WHERE clause filter (e.g., 'IsActive = true')
     * @return List of SearchResult wrapper objects
     */
    @AuraEnabled(cacheable=true)
    public static List<SearchResult> searchRecords(
        String searchTerm, 
        String sObjectType, 
        String searchFields, 
        String displayFields,
        String filterClause
    ) {
        try {
            // Validate inputs
            if (String.isBlank(searchTerm) || String.isBlank(sObjectType) || String.isBlank(searchFields)) {
                return new List<SearchResult>();
            }

            // Sanitize object name
            String sanitizedObjectType = String.escapeSingleQuotes(sObjectType);
            
            // Parse all fields to build SELECT clause
            Set<String> allFields = new Set<String>{'Id'}; // Always include Id
            allFields.addAll(parseFields(searchFields));
            allFields.addAll(parseFields(displayFields));
            
            // Build SELECT clause
            String selectClause = 'SELECT ' + String.join(new List<String>(allFields), ', ');
            
            // Build WHERE clause for search
            String searchPattern = '%' + String.escapeSingleQuotes(searchTerm) + '%';
            List<String> searchConditions = new List<String>();
            
            for (String field : parseFields(searchFields)) {
                // Only search on text-type fields (not relationships with Id)
                if (!field.endsWithIgnoreCase('Id') || field.contains('.')) {
                    searchConditions.add(field + ' LIKE :searchPattern');
                }
            }
            
            String whereClause = 'WHERE (' + String.join(searchConditions, ' OR ') + ')';
            
            // Add optional filter clause
            if (String.isNotBlank(filterClause)) {
                // Basic validation: ensure no dangerous keywords
                String lowerFilter = filterClause.toLowerCase();
                if (lowerFilter.contains('delete') || lowerFilter.contains('insert') || 
                    lowerFilter.contains('update') || lowerFilter.contains('merge')) {
                    throw new AuraHandledException('Invalid filter clause: DML keywords not allowed');
                }
                whereClause += ' AND (' + filterClause + ')';
            }
            
            // Build complete query
            String query = selectClause + ' FROM ' + sanitizedObjectType + ' ' + whereClause + ' ORDER BY Name LIMIT 10';
            
            System.debug('PillSearchCtrl query: ' + query);
            
            // Execute query
            List<SObject> records = Database.query(query);
            
            // Parse display fields
            List<String> displayFieldsList = parseFields(displayFields);
            String labelFieldName = displayFieldsList.size() > 0 ? displayFieldsList[0] : 'Name';
            String sublabelFieldName = displayFieldsList.size() > 1 ? displayFieldsList[1] : null;
            
            // Build results
            List<SearchResult> results = new List<SearchResult>();
            for (SObject record : records) {
                SearchResult result = new SearchResult();
                result.value = (String)record.get('Id');
                result.label = getFieldValue(record, labelFieldName);
                result.sublabel = sublabelFieldName != null ? getFieldValue(record, sublabelFieldName) : '';
                result.pillLabel = result.label;
                results.add(result);
            }
            
            return results;
            
        } catch (Exception e) {
            System.debug('PillSearchCtrl error: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Search error: ' + e.getMessage());
        }
    }
    
    /**
     * @description Parse comma-separated field list
     * @param fieldString Comma-separated field names
     * @return List of trimmed field names
     */
    private static List<String> parseFields(String fieldString) {
        List<String> fields = new List<String>();
        if (String.isBlank(fieldString)) {
            return fields;
        }
        
        for (String field : fieldString.split(',')) {
            String trimmedField = field.trim();
            if (String.isNotBlank(trimmedField)) {
                fields.add(trimmedField);
            }
        }
        return fields;
    }
    
    /**
     * @description Get field value from SObject, handling relationship traversal
     * @param record The SObject record
     * @param fieldPath Field path (e.g., 'Name' or 'Account.Name' or 'Owner.Profile.Name')
     * @return Field value as String, or empty string if null
     */
    private static String getFieldValue(SObject record, String fieldPath) {
        if (record == null || String.isBlank(fieldPath)) {
            return '';
        }
        
        try {
            // Split field path by dots for relationship traversal
            List<String> parts = fieldPath.split('\\.');
            
            if (parts.size() == 1) {
                // Simple field (no relationship)
                Object value = record.get(parts[0]);
                return value != null ? String.valueOf(value) : '';
            } else {
                // Relationship field - traverse the chain
                SObject currentObject = record;
                
                // Traverse all relationship parts except the last one
                for (Integer i = 0; i < parts.size() - 1; i++) {
                    currentObject = currentObject.getSObject(parts[i]);
                    if (currentObject == null) {
                        return ''; // Relationship is null
                    }
                }
                
                // Get the final field value
                Object value = currentObject.get(parts[parts.size() - 1]);
                return value != null ? String.valueOf(value) : '';
            }
        } catch (Exception e) {
            System.debug('Error getting field value for ' + fieldPath + ': ' + e.getMessage());
            return '';
        }
    }
    
    /**
     * @description Wrapper class for search results
     */
    public class SearchResult {
        @AuraEnabled public String value;
        @AuraEnabled public String label;
        @AuraEnabled public String sublabel;
        @AuraEnabled public String pillLabel;
    }
}
