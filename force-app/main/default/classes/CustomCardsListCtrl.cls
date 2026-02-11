/**
 * @description Apex controller for CustomCardsList LWC component
 * Supports dynamic SOQL queries with configurable fields and filters
 * @author Antigravity AI
 * @date 2026-02-11
 */
public with sharing class CustomCardsListCtrl {
    
    /**
     * @description Retrieve records based on dynamic criteria
     * @param sObjectType Salesforce object API name
     * @param fields Comma-separated fields to retrieve (supports relationships like 'Account.Name')
     * @param filterClause Optional WHERE clause filter (e.g., 'Type = \'Customer\'')
     * @param orderBy Optional field name to sort by (defaults to 'Name' if it exists)
     * @param limitRecords Optional result limit (defaults to 50, max 200)
     * @return List of RecordResult wrapper objects
     */
    @AuraEnabled
    public static List<RecordResult> getRecords(
        String sObjectType, 
        String fields, 
        String filterClause,
        String orderBy,
        Integer limitRecords
    ) {
        try {
            // Validate inputs
            if (String.isBlank(sObjectType) || String.isBlank(fields)) {
                throw new AuraHandledException('sObjectType and fields are required parameters');
            }

            // Sanitize object name
            String sanitizedObjectType = String.escapeSingleQuotes(sObjectType);
            
            // Parse fields and build SELECT clause
            Set<String> allFields = new Set<String>{'Id'}; // Always include Id
            allFields.addAll(parseFields(fields));
            
            String selectClause = 'SELECT ' + String.join(new List<String>(allFields), ', ');
            
            // Build WHERE clause if filter is provided
            String whereClause = '';
            if (String.isNotBlank(filterClause)) {
                // Basic validation: ensure no dangerous keywords
                String lowerFilter = filterClause.toLowerCase();
                if (lowerFilter.contains('delete') || lowerFilter.contains('insert') || 
                    lowerFilter.contains('update') || lowerFilter.contains('merge')) {
                    throw new AuraHandledException('Invalid filter clause: DML keywords not allowed');
                }
                whereClause = ' WHERE ' + filterClause;
            }
            
            // Build ORDER BY clause
            String orderByClause = '';
            if (String.isNotBlank(orderBy)) {
                orderByClause = ' ORDER BY ' + String.escapeSingleQuotes(orderBy);
            } else if (allFields.contains('Name')) {
                orderByClause = ' ORDER BY Name';
            }
            
            // Set limit (default 50, max 200)
            Integer recordLimit = (limitRecords != null && limitRecords > 0) ? Math.min(limitRecords, 200) : 50;
            String limitClause = ' LIMIT ' + recordLimit;
            
            // Build complete query
            String query = selectClause + ' FROM ' + sanitizedObjectType + whereClause + orderByClause + limitClause;
            
            // Execute query
            List<SObject> records = Database.query(query);
            
            // Build results
            List<RecordResult> results = new List<RecordResult>();
            for (SObject record : records) {
                RecordResult result = new RecordResult();
                result.recordId = (String)record.get('Id');
                result.fieldValues = new Map<String, String>();
                
                // Extract all field values
                for (String field : parseFields(fields)) {
                    String fieldValue = getFieldValue(record, field);
                    result.fieldValues.put(field, fieldValue);
                }
                
                results.add(result);
            }
            
            return results;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving records: ' + e.getMessage());
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
            return '';
        }
    }
    
    /**
     * @description Extract field names from a template string
     * @param template Template string with {FieldName} placeholders
     * @return List of field names found in template
     */
    public static List<String> extractFieldsFromTemplate(String template) {
        List<String> fields = new List<String>();
        if (String.isBlank(template)) {
            return fields;
        }
        
        // Match {FieldName} patterns using regex
        Pattern fieldPattern = Pattern.compile('\\{([^}]+)\\}');
        Matcher matcher = fieldPattern.matcher(template);
        
        while (matcher.find()) {
            String fieldName = matcher.group(1).trim();
            if (String.isNotBlank(fieldName)) {
                fields.add(fieldName);
            }
        }
        
        return fields;
    }
    
    /**
     * @description Format a template string by replacing {FieldName} with actual values
     * @param fieldValues Map of field names to field values
     * @param template Template string (e.g., '{Name} - {Type}')
     * @return Formatted string with field values
     */
    public static String formatWithTemplate(Map<String, String> fieldValues, String template) {
        if (fieldValues == null || String.isBlank(template)) {
            return '';
        }
        
        String result = template;
        
        // Extract all fields from template
        List<String> fields = extractFieldsFromTemplate(template);
        
        // Replace each {FieldName} with actual value
        for (String fieldName : fields) {
            String fieldValue = fieldValues.get(fieldName);
            // Replace placeholder with value (handle null as empty string)
            result = result.replace('{' + fieldName + '}', fieldValue != null ? fieldValue : '');
        }
        
        return result;
    }
    
    /**
     * @description Wrapper class for record results
     */
    public class RecordResult {
        @AuraEnabled public String recordId;
        @AuraEnabled public Map<String, String> fieldValues;
    }
}
