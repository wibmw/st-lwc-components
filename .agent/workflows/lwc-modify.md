---
description: Modify Shared Module
---

## Workflow: Modify Shared Module

### Safety Checklist - EXECUTE BEFORE ANY MODIFICATION

1. **Identify All Dependencies**
   ```
   Search entire codebase for:
   - import statements from this module
   - Dynamic imports
   - References in other shared modules
   ```

2. **Create Dependency Map**
   ```
   List all components using this module:
   - Component name
   - Which functions/exports they use
   - Critical or optional dependency?
   ```

3. **Impact Analysis**
   ```
   For each proposed change:
   - Is this a breaking change?
   - Which components will be affected?
   - Can we maintain backward compatibility?
   ```

4. **Create Safe Branch**
   - Branch name: `feature/update-[module-name]`
   - Document changes in commit message

5. **Implementation Strategy**
   - If breaking change: Consider creating new version of function
   - If adding functionality: Ensure no side effects on existing code
   - If refactoring: Maintain exact same public API

6. **Testing Plan**
   ```
   For EACH dependent component:
   1. Unit tests still pass
   2. Integration tests still pass
   3. Manual testing on desktop (if applicable)
   4. Manual testing on mobile (if mobile target)
   ```

7. **Documentation Update**
   - Update JSDoc comments
   - Update module README if exists
   - Add migration notes if breaking change

### Modification Prompt Template

When modifying a shared module, use this structured prompt:

```
I want to modify the shared module [MODULE_NAME].

BEFORE making any changes:
1. Search and list ALL files that import from this module
2. For each file, identify which exports/functions they use
3. Analyze the impact of modifying [SPECIFIC_FUNCTION/EXPORT]
4. Determine if this is a breaking change
5. Propose a migration strategy if breaking change detected

AFTER analysis:
6. Suggest the safest implementation approach
7. Identify which components need testing
8. Create a rollback plan in case of issues

Only proceed with implementation after reviewing this analysis.
```

### Post-Modification Validation

```
Validation checklist:
- [ ] All dependent components still compile
- [ ] No new console errors in any component
- [ ] Desktop functionality verified (if applicable)
- [ ] Mobile functionality verified (if mobile target)
- [ ] Tests updated and passing
- [ ] Documentation updated
- [ ] Migration guide created (if breaking change)
- [ ] Code reviewed
```