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
            'AccountId != null'
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
                'LastName = \'Doe\' DELETE FROM Contact'
            );
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('Invalid filter'), 'Should throw invalid filter error');
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
            null
        );
        
        Test.stopTest();
        
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assertEquals(0, results.size(), 'Should return empty list for blank object type');
    }
}
