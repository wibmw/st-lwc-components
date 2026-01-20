---
trigger: always_on
---

# Salesforce LWC Development Rules

## Project Context
- Framework: Lightning Web Components (LWC) for Salesforce
- Architecture: Modular design with shared common modules
- Targets: Check project.json for desktop/mobile requirements

## Component Structure Rules

### Required Files
- Always create all 4 files: `.js`, `.html`, `.css`, `.js-meta.xml`
- Use camelCase naming convention for components
- Ensure file names match exactly (case-sensitive)

### Responsive Design (Mobile Target Only)
**Note: Apply these rules ONLY if project.json contains "mobile" in targets array**

- Use SLDS (Salesforce Lightning Design System) for styling
- Implement media queries for mobile breakpoints (<768px)
- Test layouts with slds-grid on both mobile and desktop
- Prefer SLDS responsive classes: `slds-col`, `slds-size_*-of-*`
- Ensure touch-friendly interactive elements (min 44x44px)
- Avoid hover-only interactions on mobile

### Shared Modules Management

#### CRITICAL: Before Modifying Any Shared Module
1. List ALL components that import this module
2. Analyze potential breaking changes impact
3. Verify backward compatibility
4. Document dependencies in code comments
5. Create or update tests for shared modules

#### Shared Module Locations
Check these directories for shared modules:
- `force-app/main/default/lwc/utils/`
- `force-app/main/default/lwc/services/`
- Any module imported by 2+ components

### Pre-Commit Validation Checklist

1. **LWC Syntax**: Verify no unsupported import/export patterns
2. **Responsive** (if mobile target): Test on mobile AND desktop viewports
3. **Decorators**: Validate proper use of `@api`, `@track`, `@wire`
4. **Apex Calls**: Ensure methods are optimized (use `cacheable=true` when possible)
5. **Meta Configuration**: Confirm js-meta.xml has correct targets and exposure settings

## Common Error Prevention

### ❌ Never Do This
- Modify a shared module without impact analysis
- Forget the `js-meta.xml` file (component won't be available)
- Use JavaScript features not supported by LWC (e.g., async constructors)
- Hardcode values that should be `@api` properties
- Mix Lightning and Aura component patterns
- Use `document.querySelector` (use template queries instead)

### ✅ Always Do This
- Declare `@api` properties explicitly for component reusability
- Use lifecycle hooks correctly (`connectedCallback`, `renderedCallback`, `disconnectedCallback`)
- Implement error handling with try-catch for Apex calls
- Document public properties and custom events
- Use `@wire` for reactive data binding
- Follow LWC naming conventions (hyphenated HTML tags, camelCase JS)
- Add JSDoc comments for `@api` methods and properties

## LWC Best Practices

### Property Decorators
```javascript
@api recordId;           // Public property (can be set by parent)
@track privateData = []; // Reactive private property (deprecated, use plain assignment)
@wire(getRecord, {...})  // Wire service for reactive data
```

### Lifecycle Hooks Order
1. `constructor()` - One-time initialization
2. `connectedCallback()` - Component inserted in DOM
3. `renderedCallback()` - After render (use sparingly, can cause infinite loops)
4. `disconnectedCallback()` - Cleanup when removed from DOM

### Apex Integration
```javascript
// Cacheable method for better performance
@wire(getAccountList, { accountId: '$recordId' })
wiredAccounts;

// Imperative call for DML operations
handleSave() {
    saveAccount({ account: this.accountData })
        .then(result => { /* success */ })
        .catch(error => { /* handle error */ });
}
```

## Code Quality Standards

### Performance
- Minimize DOM queries (cache template refs)
- Use event delegation when possible
- Avoid complex computations in getters
- Debounce user input handlers

### Accessibility
- Always include ARIA labels for screen readers
- Ensure keyboard navigation works properly
- Use semantic HTML elements
- Test with Salesforce accessibility scanner

### Security
- Never trust user input - sanitize before display
- Use Lightning Data Service when possible (built-in security)
- Follow CRUD/FLS permissions in Apex
- Avoid exposing sensitive data in console logs

## Testing Requirements

### Unit Tests (Jest)
- Test all public methods (`@api`)
- Mock wire adapters
- Test error scenarios
- Aim for 75%+ code coverage

### Integration Tests
- Test component interactions
- Verify data flow between parent/child
- Test with different user profiles/permissions

## Documentation Standards

### Component Header
```javascript
/**
 * @description Brief description of component purpose
 * @author Your Name
 * @date YYYY-MM-DD
 * 
 * @property {String} recordId - Salesforce record ID
 * @property {Boolean} isReadOnly - Determines if component is editable
 * 
 * @fires CustomEvent - componentloaded
 * @fires CustomEvent - datachanged
 */
```

### Method Documentation
```javascript
/**
 * @description Saves the current form data
 * @param {Object} formData - The form data to save
 * @returns {Promise<Object>} Saved record result
 * @throws {Error} When validation fails
 */
@api
async saveData(formData) { }
```