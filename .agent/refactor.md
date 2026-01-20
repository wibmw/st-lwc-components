# Workflow: Refactor Existing Component

## Step 1: Analysis
1. List all @api properties and their usage
2. Identify all event listeners
3. Map all Apex method calls
4. Check for shared module dependencies

## Step 2: Before Refactoring
- Create backup branch
- Run existing tests (if any)
- Document current behavior
- Check if component is used in production

## Step 3: Refactoring Rules
- Maintain same @api signature (backward compatibility)
- Keep same custom events
- Add tests before modifying logic
- Update documentation

## Step 4: Validation
- All existing tests pass
- No new console errors
- Check all pages using this component
- Test on mobile if applicable