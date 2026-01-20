---
description: Create New LWC Component
---

# Workflow: Create New LWC Component

## Interactive Component Creation Process

### Step 1: Gather Component Requirements

Ask the user for the following information:

1. **Component Name** (camelCase format)
   - Example: `accountCard`, `contactList`, `customDashboard`
   - Validate: Must start with lowercase, no spaces, no special chars

2. **Component Visibility**
   - Options:
     - `Exposed` - Available for use in Lightning App Builder, Experience Builder, etc.
     - `Internal` - Only usable by other LWC components (not in builders)
   
3. **Target Platforms** (check project.json for defaults, allow override)
   - Desktop only
   - Mobile only  
   - Both (responsive)

4. **Input Parameters** (@api properties)
   - Ask: "What data does this component need to receive from parent components?"
   - For each parameter, collect:
     - Name (camelCase)
     - Type (String, Boolean, Number, Object, Array)
     - Required or Optional
     - Default value (if optional)
     - Description
   - Example: `recordId (String, Required) - The Salesforce record ID to display`

5. **Output Events** (Custom Events)
   - Ask: "What events should this component fire to communicate with parent components?"
   - For each event, collect:
     - Event name (lowercase, hyphenated)
     - Payload structure
     - When it fires (trigger condition)
   - Example: `record-saved (Object: {recordId, success}) - Fires when save operation completes`

6. **Component Purpose**
   - Brief description for documentation
   - Primary use case

### Step 2: Generate Component Structure

Based on gathered information, create all 4 required files:

#### File 1: `componentName.js`

```javascript
import { LightningElement, api } from 'lwc';

/**
 * @description [Component Purpose from Step 1]
 * @author [Auto-generated or user name]
 * @date [Current Date]
 * 
 * INPUT PARAMETERS:
 * [List all @api properties with types and descriptions]
 * 
 * OUTPUT EVENTS:
 * [List all custom events with payload structures]
 */
export default class ComponentName extends LightningElement {
    // Input Parameters (from Step 1.4)
    // Generate @api property for each input parameter
    // Include JSDoc comment with type and description
    
    /**
     * @type {String}
     * @description [Description from requirements]
     * @required [true/false based on requirements]
     */
    @api recordId;
    
    // Private reactive properties
    
    // Lifecycle Hooks
    connectedCallback() {
        // Component initialization
        this.validateRequiredInputs();
    }
    
    // Validation for required @api properties
    validateRequiredInputs() {
        // Generate validation for each required input
        // Example: if (!this.recordId) { console.error('recordId is required'); }
    }
    
    // Event Handlers
    
    // Helper Methods
    
    /**
     * @description Fire custom event to parent component
     * @param {String} eventName - Name of the event
     * @param {Object} detail - Event payload
     */
    fireCustomEvent(eventName, detail) {
        const event = new CustomEvent(eventName, {
            detail: detail,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }
}
```

#### File 2: `componentName.html`

```html

    
    
        
        
        
        
            Component Title
        
        
        
        
    

```

#### File 3: `componentName.css`

```css
/* Component-specific styles */

/* Mobile-specific styles - ONLY if mobile is in targets */
/* @media (max-width: 768px) {
    .custom-class {
        // Mobile adjustments
    }
} */
```

#### File 4: `componentName.js-meta.xml`

```xml


    60.0
    [true if Exposed, false if Internal - from Step 1.2]
    
    
    
        
        
        
    
    
    
    
        
            
            
            -->
        
    

```

### Step 3: Generate Documentation

Create a README comment block at the top of the JS file:

```javascript
/**
 * COMPONENT DOCUMENTATION
 * =======================
 * 
 * Component Name: [componentName]
 * Purpose: [from Step 1.6]
 * Created: [date]
 * 
 * USAGE EXAMPLE:
 * 
 * 
 * 
 * INPUT PARAMETERS:
 * [Detailed list from Step 1.4]
 * 
 * OUTPUT EVENTS:
 * [Detailed list from Step 1.5]
 * 
 * DEPENDENCIES:
 * - [List any imported modules or Apex classes]
 * 
 * NOTES:
 * - [Any special considerations]
 * - [Mobile-specific behavior if applicable]
 */
```

### Step 4: Post-Creation Checklist

Present this checklist to the user:

- [ ] All 4 files created successfully
- [ ] Component name follows camelCase convention
- [ ] All required @api properties are declared
- [ ] All custom events are documented
- [ ] js-meta.xml has correct visibility setting
- [ ] js-meta.xml targets match requirements (desktop/mobile)
- [ ] Mobile styles included if mobile target specified
- [ ] JSDoc documentation is complete
- [ ] Component is ready for implementation

### Step 5: Next Steps Suggestions

After component creation, suggest:

1. "Would you like me to implement specific functionality now?"
2. "Should I create an Apex controller for data operations?"
3. "Do you need a test file (\_\_tests\_\_/componentName.test.js)?"
4. "Would you like to add this component to an existing page?"
