# Changelog

## 2026-01-19
### Added
- c-invoice-generator component (mobile + desktop)
- InvoiceController.generatePDF method

### Changed
- utils/dateFormatter: Added timezone support
  ⚠️ Breaking change: Method signature changed
  Impact: 3 components (updated)

### Deprecated
- accountService.getLegacyData (use getAccountData instead)

### Fixed
- c-contact-list: Mobile layout fixed for tablets