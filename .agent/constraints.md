# Technical Constraints

## Governor Limits
- Max SOQL queries per transaction: 100
- Max DML statements: 150
- Max records per DML: 10,000
- Max heap size: 6MB (sync), 12MB (async)

→ Always query outside loops
→ Bulkify all Apex methods
→ Use collections for DML
→ NEVER use SOQL in loops

## LWC Limitations
- @wire only for cacheable methods
- Max bundle size: Check best practices

## Browser Support
- Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile: iOS Safari, Android Chrome
- NO Internet Explorer support

## Performance Targets
- Initial load: < 2s
- Apex response: < 500ms
- LWC render: < 100ms