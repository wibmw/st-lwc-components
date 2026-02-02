/**
 * @description Test class for PillSearchCtrl
 * @author Antigravity AI
 * @date 2026-01-30
 */
@isTest
private class PillSearchCtrl_Test {
    
    /**
     * @description Test data setup
     */
    @TestSetup
    static void setupTestData() {
        // Create test Account
        Account testAccount = new Account(
            Name = 'Test Account',
            Industry = 'Technology'
        );
        insert testAccount;
        
        // Create test Contacts
        List<Contact> contacts = new List<Contact>();
        contacts.add(new Contact(
            FirstName = 'John',
            LastName = 'Doe',
            Email = 'john.doe@test.com',
            AccountId = testAccount.Id
        ));
        contacts.add(new Contact(
            FirstName = 'Jane',
            LastName = 'Smith',
            Email = 'jane.smith@test.com',
            AccountId = testAccount.Id
        ));
        contacts.add(new Contact(
            FirstName = 'Bob',
            LastName = 'Johnson',
            Email = 'bob.johnson@test.com'
        ));
        insert contacts;
    }
    
    /**
     * @description Test successful search with simple fields
     */
    @isTest
    static void testSearchRecords_SimpleFields() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            'Contact',
            'LastName,Email',
            'LastName,Email',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact with last name Doe');
        System.assertEquals('Doe', results[0].label, 'Label should be last name');
        System.assertEquals('john.doe@test.com', results[0].sublabel, 'Sublabel should be email');
    }
    
    /**
     * @description Test search with relationship fields
     */
    @isTest
    static void testSearchRecords_RelationshipFields() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            'Contact',
            'LastName,Account.Name',
            'LastName,Account.Industry',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('Doe', results[0].label, 'Label should be last name');
        System.assertEquals('Technology', results[0].sublabel, 'Sublabel should be account industry');
    }
    
    /**
     * @description Test search with filter clause
     */
    @isTest
    static void testSearchRecords_WithFilter() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'test.com',
            'Contact',
            'Email',
            'LastName,Email',
            'AccountId != null',
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(2, results.size(), 'Should find 2 contacts with accounts');
    }
    
    /**
     * @description Test search with no results
     */
    @isTest
    static void testSearchRecords_NoResults() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'NonExistent',
            'Contact',
            'LastName',
            'LastName',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(0, results.size(), 'Should find no results');
    }
    
    /**
     * @description Test search with null relationship
     */
    @isTest
    static void testSearchRecords_NullRelationship() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Johnson',
            'Contact',
            'LastName',
            'LastName,Account.Name',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('Johnson', results[0].label, 'Label should be last name');
        System.assertEquals('', results[0].sublabel, 'Sublabel should be empty for null relationship');
    }
    
    /**
     * @description Test with invalid filter clause (DML keywords)
     */
    @isTest
    static void testSearchRecords_InvalidFilter() {
        Test.startTest();
        
        Boolean exceptionThrown = false;
        try {
            PillSearchCtrl.searchRecords(
                'Doe',
                'Contact',
                'LastName',
                'LastName',
                'LastName = \'Doe\' DELETE FROM Contact',
                null,
                null
            );
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('DML keywords not allowed'), 'Should throw invalid filter error: ' + e.getMessage());
        } catch (Exception e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('DML keywords not allowed') || e.getMessage().contains('Invalid filter'), 
                'Should throw invalid filter error: ' + e.getMessage());
        }
        
        Test.stopTest();
        
        System.assert(exceptionThrown, 'Should have thrown exception for invalid filter');
    }
    
    /**
     * @description Test with blank search term
     */
    @isTest
    static void testSearchRecords_BlankSearchTerm() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            '',
            'Contact',
            'LastName',
            'LastName',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(0, results.size(), 'Should return empty list for blank search term');
    }
    
    /**
     * @description Test with blank object type
     */
    @isTest
    static void testSearchRecords_BlankObjectType() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            '',
            'LastName',
            'LastName',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(0, results.size(), 'Should return empty list for blank object type');
    }
    
    /**
     * @description Test search with label format template
     */
    @isTest
    static void testSearchRecords_WithLabelFormat() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            'Contact',
            'LastName,Email',
            'LastName,Email',
            null,
            '{LastName} - {Email}',
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('Doe - john.doe@test.com', results[0].label, 'Label should be formatted');
        System.assertEquals('Doe - john.doe@test.com', results[0].pillLabel, 'PillLabel should match label');
    }
    
    /**
     * @description Test search with sublabel format template
     */
    @isTest
    static void testSearchRecords_WithSublabelFormat() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            'Contact',
            'LastName,Email,FirstName',
            'LastName,Email,FirstName',
            null,
            null,
            'Email: {Email}'
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('Email: john.doe@test.com', results[0].sublabel, 'Sublabel should be formatted');
    }
    
    /**
     * @description Test search with both label and sublabel format templates
     */
    @isTest
    static void testSearchRecords_WithBothFormats() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            'Contact',
            'LastName,Email,FirstName',
            'LastName,Email,FirstName',
            null,
            '{FirstName} {LastName}',
            '{Email}'
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('John Doe', results[0].label, 'Label should be formatted');
        System.assertEquals('john.doe@test.com', results[0].sublabel, 'Sublabel should be formatted');
    }
    
    /**
     * @description Test format with relationship fields
     */
    @isTest
    static void testSearchRecords_FormatWithRelationships() {
        Test.startTest();
        
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Doe',
            'Contact',
            'LastName,Email',
            'LastName,Email,Account.Name',
            null,
            '{LastName} ({Account.Name})',
            '{Email}'
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('Doe (Test Account)', results[0].label, 'Label should include relationship field');
        System.assertEquals('john.doe@test.com', results[0].sublabel, 'Sublabel should be formatted');
    }
    
    /**
     * @description Test backward compatibility - using displayFields without format templates
     */
    @isTest
    static void testSearchRecords_BackwardCompatibility() {
        Test.startTest();
        
        // Call with null formats - should use displayFields behavior
        List<PillSearchCtrl.SearchResult> results = PillSearchCtrl.searchRecords(
            'Smith',
            'Contact',
            'LastName,Email',
            'FirstName,LastName',
            null,
            null,
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(1, results.size(), 'Should find 1 contact');
        System.assertEquals('Jane', results[0].label, 'Label should be first display field');
        System.assertEquals('Smith', results[0].sublabel, 'Sublabel should be second display field');
    }
}
