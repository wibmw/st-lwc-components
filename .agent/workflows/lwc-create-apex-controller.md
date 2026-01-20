---
description: Create Apex Controller for LWC
---

# Workflow: Create Apex Controller for LWC

## Step 1: Gather Requirements

Ask user for:

1. **Controller Name** (PascalCase, ends with "Controller")
2. **Related LWC Component** name
3. **Operations needed**: Read, Create, Update, Delete, Search, Custom Logic
4. **sObject Information**: Object name, fields, relationships
5. **Method Details** for each operation:
   - Method name (camelCase)
   - Parameters (name, type, required/optional)
   - Return type
   - Cacheable? (Yes for read-only, No for DML)
6. **Security**: with/without/inherited sharing (default: with sharing)

## Step 2: Generate Controller

```apex
/**
 * @description Apex controller for [LWC Component Name]
 */
public with sharing class ComponentNameController {
    
    public class ControllerException extends Exception {}
    
    // READ OPERATIONS (cacheable=true)
    @AuraEnabled(cacheable=true)
    public static ObjectName getRecordById(Id recordId) {
        try {
            if (recordId == null) {
                throw new ControllerException('Record ID required');
            }
            
            if (!Schema.sObjectType.ObjectName.isAccessible()) {
                throw new AuraHandledException('No permission to access this object');
            }
            
            List<ObjectName> results = [
                SELECT Id, Name, Field1__c
                FROM ObjectName
                WHERE Id = :recordId
                WITH USER_MODE
                LIMIT 1
            ];
            
            return results.isEmpty() ? null : results[0];
            
        } catch (Exception e) {
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
    
    // CREATE OPERATIONS
    @AuraEnabled
    public static Id createRecord(ObjectName recordData) {
        try {
            if (!Schema.sObjectType.ObjectName.isCreateable()) {
                throw new AuraHandledException('No permission to create');
            }
            
            Database.SaveResult result = Database.insert(recordData, AccessLevel.USER_MODE);
            
            if (!result.isSuccess()) {
                throw new ControllerException(result.getErrors()[0].getMessage());
            }
            
            return result.getId();
            
        } catch (Exception e) {
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
    
    // UPDATE OPERATIONS
    @AuraEnabled
    public static Boolean updateRecord(ObjectName recordData) {
        try {
            if (!Schema.sObjectType.ObjectName.isUpdateable()) {
                throw new AuraHandledException('No permission to update');
            }
            
            Database.SaveResult result = Database.update(recordData, AccessLevel.USER_MODE);
            return result.isSuccess();
            
        } catch (Exception e) {
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
    
    // SEARCH OPERATIONS
    @AuraEnabled(cacheable=true)
    public static List<ObjectName> searchRecords(String searchTerm) {
        try {
            if (String.isBlank(searchTerm)) {
                return new List<ObjectName>();
            }
            
            String sanitized = String.escapeSingleQuotes(searchTerm);
            String pattern = '%' + sanitized + '%';
            
            return [
                SELECT Id, Name
                FROM ObjectName
                WHERE Name LIKE :pattern
                WITH USER_MODE
                LIMIT 50
            ];
            
        } catch (Exception e) {
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }
}
```

## Step 3: LWC Integration

```javascript
import getRecordById from '@salesforce/apex/ComponentNameController.getRecordById';
import createRecord from '@salesforce/apex/ComponentNameController.createRecord';

export default class MyComponent extends LightningElement {
    
    // Wire for cacheable methods
    @wire(getRecordById, { recordId: '$recordId' })
    wiredData({ error, data }) {
        if (data) {
            this.processData(data);
        } else if (error) {
            this.handleError(error);
        }
    }
    
    // Imperative for DML
    async handleSave() {
        try {
            await createRecord({ recordData: this.formData });
            this.showSuccess();
        } catch (error) {
            this.handleError(error);
        }
    }
    
    handleError(error) {
        const message = error.body?.message || error.message || 'Unknown error';
        // Show toast notification
    }
}
```

## Step 4: Security Checklist

- [ ] Use `with sharing` (default)
- [ ] All queries use `WITH USER_MODE`
- [ ] DML uses `AccessLevel.USER_MODE`
- [ ] CRUD checks with `isAccessible()`, `isCreateable()`, etc.
- [ ] Input validation (not null/blank)
- [ ] Sanitize strings with `String.escapeSingleQuotes()`
- [ ] Try-catch around all operations
- [ ] User-friendly error messages
- [ ] Test class with 75%+ coverage

## Best Practices

**Performance:**
- `cacheable=true` for read-only @wire
- Query only needed fields
- Queries outside loops

**Security:**
- Never use `without sharing` without justification
- Validate all inputs
- No sensitive data in errors

**Testing:**
- Test positive and negative cases
- Test bulk operations
- Verify error handling