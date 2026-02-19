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
     * @param labelFormat Optional template for label (e.g., '{Name} - {Email}')
     * @param sublabelFormat Optional template for sublabel
     * @return List of SearchResult wrapper objects
     */
    @AuraEnabled(cacheable=true)
    public static List<SearchResult> searchRecords(
        String searchTerm, 
        String sObjectType, 
        String searchFields, 
        String displayFields,
        String filterClause,
        String labelFormat,
        String sublabelFormat
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
            
            // Extract fields from format templates if provided
            if (String.isNotBlank(labelFormat)) {
                allFields.addAll(extractFieldsFromTemplate(labelFormat));
            }
            if (String.isNotBlank(sublabelFormat)) {
                allFields.addAll(extractFieldsFromTemplate(sublabelFormat));
            }
            
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
                
                // Add the filter clause as-is (it should already contain proper quoting)
                // We don't escape it because it needs to preserve SOQL syntax like 'Customer'
                whereClause += ' AND (' + filterClause + ')';
            }
            
            // Build complete query with error handling for ORDER BY
            String orderByClause = '';
            try {
                // Try to order by Name if it exists in the field list
                if (allFields.contains('Name')) {
                    orderByClause = ' ORDER BY Name';
                }
            } catch (Exception e) {
                // If Name doesn't exist, order by Id
                orderByClause = ' ORDER BY Id';
            }
            
            String query = selectClause + ' FROM ' + sanitizedObjectType + ' ' + whereClause + orderByClause + ' LIMIT 10';
            
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
                
                // Use format templates if provided, otherwise use simple field values
                if (String.isNotBlank(labelFormat)) {
                    result.label = formatWithTemplate(record, labelFormat);
                    result.pillLabel = result.label;
                } else {
                    result.label = getFieldValue(record, labelFieldName);
                    result.pillLabel = result.label;
                }
                
                if (String.isNotBlank(sublabelFormat)) {
                    result.sublabel = formatWithTemplate(record, sublabelFormat);
                } else {
                    result.sublabel = sublabelFieldName != null ? getFieldValue(record, sublabelFieldName) : '';
                }
                
                results.add(result);
            }
            
            return results;
            
        } catch (Exception e) {
            throw new AuraHandledException('Search error: ' + e.getMessage());
        }
    }

    /**
     * @description Fetch details for a specific record by ID
     * @param recordId ID of the record to fetch
     * @param sObjectType Salesforce object API name
     * @param displayFields Comma-separated fields to display (supports relationships)
     * @param labelFormat Optional template for label (e.g., '{Name} - {Email}')
     * @param sublabelFormat Optional template for sublabel
     * @return SearchResult object with label and sublabel
     */
    @AuraEnabled(cacheable=true)
    public static SearchResult getRecordDetails(
        String recordId,
        String sObjectType,
        String displayFields,
        String labelFormat,
        String sublabelFormat
    ) {
        try {
            if (String.isBlank(recordId) || String.isBlank(sObjectType)) {
                return null;
            }

            // Sanitize object name
            String sanitizedObjectType = String.escapeSingleQuotes(sObjectType);
            
            // Build field list
            Set<String> allFields = new Set<String>{'Id', 'Name'}; // Always include Id and Name (fallback)
            allFields.addAll(parseFields(displayFields));
            
            if (String.isNotBlank(labelFormat)) {
                allFields.addAll(extractFieldsFromTemplate(labelFormat));
            }
            if (String.isNotBlank(sublabelFormat)) {
                allFields.addAll(extractFieldsFromTemplate(sublabelFormat));
            }
            
            // Build Query
            String selectClause = 'SELECT ' + String.join(new List<String>(allFields), ', ');
            String query = selectClause + ' FROM ' + sanitizedObjectType + ' WHERE Id = :recordId LIMIT 1';
            
            // Execute Query
            List<SObject> records = Database.query(query);
            if (records.isEmpty()) {
                return null;
            }
            
            SObject record = records[0];
            
            // Format Result
            SearchResult result = new SearchResult();
            result.value = (String)record.get('Id');
            
            // Parse display fields to determine label/sublabel fields if not using format
            List<String> displayFieldsList = parseFields(displayFields);
            String labelFieldName = displayFieldsList.size() > 0 ? displayFieldsList[0] : 'Name';
            String sublabelFieldName = displayFieldsList.size() > 1 ? displayFieldsList[1] : null;

            if (String.isNotBlank(labelFormat)) {
                result.label = formatWithTemplate(record, labelFormat);
                result.pillLabel = result.label;
            } else {
                result.label = getFieldValue(record, labelFieldName);
                result.pillLabel = result.label;
            }
            
            if (String.isNotBlank(sublabelFormat)) {
                result.sublabel = formatWithTemplate(record, sublabelFormat);
            } else {
                result.sublabel = sublabelFieldName != null ? getFieldValue(record, sublabelFieldName) : '';
            }
            
            return result;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching record details: ' + e.getMessage());
        }
    }
    
    /**
     * @description Fetch details for multiple records by IDs
     * @param recordIds List of IDs to fetch
     * @param sObjectType Salesforce object API name
     * @param displayFields Comma-separated fields to display
     * @param labelFormat Optional template for label
     * @param sublabelFormat Optional template for sublabel
     * @return List of SearchResult objects
     */
    @AuraEnabled(cacheable=true)
    public static List<SearchResult> getRecordsDetails(
        List<String> recordIds,
        String sObjectType,
        String displayFields,
        String labelFormat,
        String sublabelFormat
    ) {
        try {
            if (recordIds == null || recordIds.isEmpty() || String.isBlank(sObjectType)) {
                return new List<SearchResult>();
            }

            String sanitizedObjectType = String.escapeSingleQuotes(sObjectType);
            
            Set<String> allFields = new Set<String>{'Id', 'Name'};
            allFields.addAll(parseFields(displayFields));
            
            if (String.isNotBlank(labelFormat)) {
                allFields.addAll(extractFieldsFromTemplate(labelFormat));
            }
            if (String.isNotBlank(sublabelFormat)) {
                allFields.addAll(extractFieldsFromTemplate(sublabelFormat));
            }
            
            String selectClause = 'SELECT ' + String.join(new List<String>(allFields), ', ');
            String query = selectClause + ' FROM ' + sanitizedObjectType + ' WHERE Id IN :recordIds';
            
            List<SObject> records = Database.query(query);
            List<SearchResult> results = new List<SearchResult>();
            
            List<String> displayFieldsList = parseFields(displayFields);
            String labelFieldName = displayFieldsList.size() > 0 ? displayFieldsList[0] : 'Name';
            String sublabelFieldName = displayFieldsList.size() > 1 ? displayFieldsList[1] : null;

            for (SObject record : records) {
                SearchResult result = new SearchResult();
                result.value = (String)record.get('Id');
                
                if (String.isNotBlank(labelFormat)) {
                    result.label = formatWithTemplate(record, labelFormat);
                    result.pillLabel = result.label;
                } else {
                    result.label = getFieldValue(record, labelFieldName);
                    result.pillLabel = result.label;
                }
                
                if (String.isNotBlank(sublabelFormat)) {
                    result.sublabel = formatWithTemplate(record, sublabelFormat);
                } else {
                    result.sublabel = sublabelFieldName != null ? getFieldValue(record, sublabelFieldName) : '';
                }
                
                results.add(result);
            }
            
            return results;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching records details: ' + e.getMessage());
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
     * @description Extract field names from a template string
     * @param template Template string with {FieldName} placeholders
     * @return List of field names found in template
     */
    private static List<String> extractFieldsFromTemplate(String template) {
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
     * @param record The SObject record
     * @param template Template string (e.g., '{Name} - {Email}')
     * @return Formatted string with field values
     */
    private static String formatWithTemplate(SObject record, String template) {
        if (record == null || String.isBlank(template)) {
            return '';
        }
        
        String result = template;
        
        // Extract all fields from template
        List<String> fields = extractFieldsFromTemplate(template);
        
        // Replace each {FieldName} with actual value
        for (String fieldName : fields) {
            String fieldValue = getFieldValue(record, fieldName);
            // Replace placeholder with value (handle null as empty string)
            result = result.replace('{' + fieldName + '}', fieldValue != null ? fieldValue : '');
        }
        
        return result;
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
     * @description Wrapper class for search results
     */
    public class SearchResult {
        @AuraEnabled public String value;
        @AuraEnabled public String label;
        @AuraEnabled public String sublabel;
        @AuraEnabled public String pillLabel;
    }
}
