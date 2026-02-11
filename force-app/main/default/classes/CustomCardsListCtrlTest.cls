/**
 * @description Test class for CustomCardsListCtrl
 * @author Antigravity AI
 * @date 2026-02-11
 */
@isTest
private class CustomCardsListCtrlTest {
    
    @testSetup
    static void setupTestData() {
        // Create test accounts
        List<Account> accounts = new List<Account>();
        accounts.add(new Account(Name = 'Test Account 1', Type = 'Customer', Industry = 'Technology', Phone = '123-456-7890'));
        accounts.add(new Account(Name = 'Test Account 2', Type = 'Partner', Industry = 'Finance', Phone = '098-765-4321'));
        accounts.add(new Account(Name = 'Test Account 3', Type = 'Customer', Industry = 'Healthcare'));
        insert accounts;
    }
    
    @isTest
    static void testGetRecords_BasicQuery() {
        Test.startTest();
        List<CustomCardsListCtrl.RecordResult> results = CustomCardsListCtrl.getRecords(
            'Account',
            'Name,Type,Industry',
            null,
            null,
            null
        );
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(3, results.size(), 'Should return 3 accounts');
        System.assertNotEquals(null, results[0].recordId, 'Record ID should not be null');
        System.assertNotEquals(null, results[0].fieldValues, 'Field values should not be null');
        System.assert(results[0].fieldValues.containsKey('Name'), 'Should contain Name field');
        System.assert(results[0].fieldValues.containsKey('Type'), 'Should contain Type field');
    }
    
    @isTest
    static void testGetRecords_WithFilter() {
        Test.startTest();
        List<CustomCardsListCtrl.RecordResult> results = CustomCardsListCtrl.getRecords(
            'Account',
            'Name,Type',
            'Type = \'Customer\'',
            null,
            null
        );
        Test.stopTest();
        
        System.assertEquals(2, results.size(), 'Should return only Customer accounts');
        for (CustomCardsListCtrl.RecordResult result : results) {
            System.assertEquals('Customer', result.fieldValues.get('Type'), 'All results should be Customer type');
        }
    }
    
    @isTest
    static void testGetRecords_WithOrderBy() {
        Test.startTest();
        // Use CreatedDate instead of Name to ensure distinct ordering if names are similar, 
        // though names are distinct here. Just stick with Name but ensure data allows it.
        List<CustomCardsListCtrl.RecordResult> results = CustomCardsListCtrl.getRecords(
            'Account',
            'Name,Type',
            null,
            'Name DESC',
            null
        );
        Test.stopTest();
        
        System.assertEquals(3, results.size(), 'Should return 3 accounts');
        // Check if ordering worked. 
        // Test Account 3 > Test Account 2 > Test Account 1
        System.assertEquals('Test Account 3', results[0].fieldValues.get('Name'), 'First result should be Test Account 3');
    }
    
    @isTest
    static void testGetRecords_RelationshipFields() {
        Test.startTest();
        // Use CreatedBy.Name which is always available
        List<CustomCardsListCtrl.RecordResult> results = CustomCardsListCtrl.getRecords(
            'Account',
            'Name,CreatedBy.Name,CreatedBy.Email',
            null,
            null,
            null
        );
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assert(results.size() > 0, 'Should have results');
        System.assert(results[0].fieldValues.containsKey('CreatedBy.Name'), 'Should contain CreatedBy.Name field');
    }
    
    @isTest
    static void testGetRecords_EmptyParameters() {
        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            CustomCardsListCtrl.getRecords('', '', null, null, null);
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('required'), 'Error message should mention required parameters');
        }
        Test.stopTest();
        
        System.assert(exceptionThrown, 'Should throw exception for empty parameters');
    }
    
    @isTest
    static void testGetRecords_InvalidFilterClause() {
        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            CustomCardsListCtrl.getRecords(
                'Account',
                'Name',
                'DELETE FROM Account',
                null,
                null
            );
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('DML keywords'), 'Error message should mention DML keywords');
        }
        Test.stopTest();
        
        System.assert(exceptionThrown, 'Should throw exception for invalid filter clause');
    }
    
    @isTest
    static void testExtractFieldsFromTemplate() {
        Test.startTest();
        List<String> fields = CustomCardsListCtrl.extractFieldsFromTemplate('{Name} - {Type} ({Industry})');
        Test.stopTest();
        
        System.assertEquals(3, fields.size(), 'Should extract 3 fields');
        System.assert(fields.contains('Name'), 'Should contain Name');
        System.assert(fields.contains('Type'), 'Should contain Type');
        System.assert(fields.contains('Industry'), 'Should contain Industry');
    }
    
    @isTest
    static void testFormatWithTemplate() {
        Map<String, String> fieldValues = new Map<String, String>{
            'Name' => 'Acme Corp',
            'Type' => 'Customer',
            'Industry' => 'Technology'
        };
        
        Test.startTest();
        String result = CustomCardsListCtrl.formatWithTemplate(fieldValues, '{Name} - {Type} ({Industry})');
        Test.stopTest();
        
        System.assertEquals('Acme Corp - Customer (Technology)', result, 'Template should be formatted correctly');
    }
    
    @isTest
    static void testFormatWithTemplate_NullValues() {
        Map<String, String> fieldValues = new Map<String, String>{
            'Name' => 'Acme Corp',
            'Type' => null
        };
        
        Test.startTest();
        String result = CustomCardsListCtrl.formatWithTemplate(fieldValues, '{Name} - {Type}');
        Test.stopTest();
        
        System.assertEquals('Acme Corp - ', result, 'Null values should be replaced with empty string');
    }
}
