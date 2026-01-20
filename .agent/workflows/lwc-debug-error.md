---
description: Debug LWC Error
---

# Workflow: Debug LWC Error

## Step 1: Gather Error Info

Ask user:
1. **Exact error message** from console/UI
2. **Where**: Component load, user interaction, data loading, after deployment
3. **Environment**: Desktop/Mobile, browser, Sandbox/Production
4. **Reproducible**: Always, sometimes, specific conditions
5. **Component name** and related Apex controller

## Step 2: Quick Diagnostics by Error Type

### JavaScript Errors

**"Cannot read property of undefined"**
```javascript
// PROBLEM
someMethod() {
    console.log(this.data.name); // Error if data is undefined
}

// FIX
someMethod() {
    console.log(this.data?.name); // Optional chaining
    // OR
    if (this.data?.name) {
        console.log(this.data.name);
    }
}
```

**"X is not a function"**
```javascript
// Check: Method exists, correct binding, not called too early
connectedCallback() {
    if (this.recordData) {
        this.processData();
    }
}
```

### LWC Template Errors

**Invalid template / Component not found**
```html
<!-- PROBLEM -->
<c-myComponent></c-myComponent>

<!-- FIX: Use hyphenated, check deployment -->
<c-my-component></c-my-component>
```

**Template expression errors**
```html
<!-- PROBLEM -->
<div>{data.name}</div>

<!-- FIX: Add conditional -->
<template if:true={data}>
    <div>{data.name}</div>
</template>
```

### Wire Adapter Errors

```javascript
// PROBLEM: Missing $ for reactive
@wire(getRecord, { recordId: recordId })

// FIX: Add $ prefix
@wire(getRecord, { recordId: '$recordId' })

// PROBLEM: Wire with DML method
@wire(saveRecord) // Can't wire DML

// FIX: Use imperative
async handleSave() {
    await saveRecord({ data: this.formData });
}
```

### Apex Errors

```javascript
// Add detailed logging
handleApexCall() {
    methodName({ param: value })
        .catch(error => {
            console.error('Error:', error.body?.message);
            console.error('Stack:', error.body?.stackTrace);
            console.error('Field errors:', error.body?.fieldErrors);
        });
}
```

**Common Apex errors:**
- `List has no rows` → Add `.isEmpty()` check
- `FIELD_CUSTOM_VALIDATION_EXCEPTION` → Check validation rules
- `REQUIRED_FIELD_MISSING` → Set all required fields
- `INSUFFICIENT_ACCESS` → Check CRUD/FLS permissions
- `UNABLE_TO_LOCK_ROW` → Implement retry logic

## Step 3: Rendering Issues

**Component not appearing:**
1. Check Lightning App Builder (component added?)
2. Inspect DOM (component in HTML?)
3. Check conditional rendering logic

```html
<!-- Debug visibility -->
<div>showComponent: {showComponent}</div>
<template if:true={showComponent}>
    <div>Content</div>
</template>
```

**Data not reactive:**
```javascript
// PROBLEM: Mutation doesn't trigger re-render
this.data.push(newItem);

// FIX: Reassign
this.data = [...this.data, newItem];
```

**Infinite loading:**
```javascript
// Always reset loading in finally
loadData() {
    this.isLoading = true;
    fetchData()
        .then(result => this.data = result)
        .catch(error => this.handleError(error))
        .finally(() => {
            this.isLoading = false; // Always executed
        });
}
```

## Step 4: Data Issues

**Data not loading:**
- Check console for errors
- Verify `@AuraEnabled` and `cacheable=true` on Apex
- Check user permissions
- Test SOQL in Developer Console

**Stale data:**
```javascript
import { refreshApex } from '@salesforce/apex';

handleSave() {
    saveRecord({ data: this.formData })
        .then(() => refreshApex(this.wiredRecord));
}
```

## Step 5: Mobile Issues

**Test responsive:**
- Chrome DevTools → Device Toolbar (Ctrl+Shift+M)
- Test at 375px (mobile) and 768px (tablet)

**Touch events:**
```html
<!-- Use click instead of hover -->
<div onclick={handleClick}>Tap me</div>
```

**Layout fixes:**
```css
/* PROBLEM: Fixed width */
.container { width: 1200px; }

/* FIX: Responsive */
.container {
    width: 100%;
    max-width: 1200px;
}

@media (max-width: 768px) {
    .container { padding: 1rem; }
}
```

## Step 6: Common Patterns

**After deployment issues:**
- [ ] Clear browser cache
- [ ] Hard refresh (Ctrl+F5)
- [ ] Check component assigned in App Builder
- [ ] Verify Apex class permissions
- [ ] Check field-level security

**Intermittent errors:**
Add timestamps:
```javascript
console.log('[START]', new Date().toISOString());
// ... code ...
console.log('[END]', new Date().toISOString());
```

## Step 7: Debug Tools

**Console logging:**
```javascript
console.log('=== Debug ===');
console.log('recordId:', this.recordId);
console.log('data:', JSON.stringify(this.data, null, 2));
debugger; // Pause execution
```

**Salesforce Debug Logs:**
Setup → Debug Logs → New → Set to FINEST

**Lightning Inspector:**
Chrome extension for component tree and events

## Step 8: Prevention

- [ ] Add null checks (optional chaining)
- [ ] Try-catch around Apex calls
- [ ] Validate @api properties
- [ ] Set default values
- [ ] Add Jest tests for edge cases
- [ ] Document known issues