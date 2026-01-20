# Prompt: Add Feature to Existing Component

When adding a feature to an existing LWC:

1. Analyze current component:
   - List all @api properties
   - List all methods
   - Check shared module dependencies
   - Identify potential conflicts

2. Design approach:
   - Will this break existing functionality?
   - Need new @api property or reuse existing?
   - Impact on mobile version?

3. Implementation plan:
   - What files need modification?
   - New methods needed?
   - CSS changes for mobile?

4. Testing strategy:
   - Test existing features still work
   - Test new feature on desktop
   - Test new feature on mobile

Only proceed after reviewing this analysis.