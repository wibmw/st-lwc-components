/**
 * @description Unit tests for LogisticsUtils
 */
import { 
    STATUS_DEFINITIONS_BY_KEY,
    STATUS_DEFINITIONS_BY_APIVALUE,
    isDesktopDevice,
    reduceErrors,
    debounce,
    isValidSalesforceId,
    normalizeStatus,
    formatDateFr
} from 'c/LogisticsUtils';

describe('Status Definitions', () => {
    it('should have Disponible status definition', () => {
        expect(STATUS_DEFINITIONS_BY_KEY['Disponible']).toBeDefined();
        expect(STATUS_DEFINITIONS_BY_KEY['Disponible'].apiValue).toBe('Disponible');
    });

    it('should have Non Disponible status definition', () => {
        expect(STATUS_DEFINITIONS_BY_KEY['Non Disponible']).toBeDefined();
        expect(STATUS_DEFINITIONS_BY_KEY['Non Disponible'].displayValue).toBe('🔴 Non Disponible');
    });

    it('should have reverse lookup by API value', () => {
        expect(STATUS_DEFINITIONS_BY_APIVALUE['Disponible']).toBe(STATUS_DEFINITIONS_BY_KEY['Disponible']);
    });
});

describe('isDesktopDevice', () => {
    it('should return boolean', () => {
        const result = isDesktopDevice();
        expect(typeof result).toBe('boolean');
    });
});

describe('reduceErrors', () => {
    it('should return empty array for null', () => {
        expect(reduceErrors(null)).toEqual([]);
    });

    it('should handle simple string error', () => {
        const error = { message: 'Test error' };
        expect(reduceErrors(error)).toContain('Test error');
    });

    it('should handle Apex error format', () => {
        const error = { body: { message: 'Apex error' } };
        expect(reduceErrors(error)).toContain('Apex error');
    });

    it('should handle array of errors', () => {
        const errors = [
            { message: 'Error 1' },
            { message: 'Error 2' }
        ];
        const result = reduceErrors(errors);
        expect(result).toContain('Error 1');
        expect(result).toContain('Error 2');
    });

    it('should remove duplicate errors', () => {
        const errors = [
            { message: 'Duplicate' },
            { message: 'Duplicate' }
        ];
        const result = reduceErrors(errors);
        expect(result.length).toBe(1);
    });
});

describe('debounce', () => {
    jest.useFakeTimers();

    it('should delay function execution', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn();
        expect(mockFn).not.toBeCalled();

        jest.advanceTimersByTime(300);
        expect(mockFn).toBeCalled();
    });

    it('should only execute once for multiple rapid calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        jest.advanceTimersByTime(300);
        expect(mockFn).toBeCalledTimes(1);
    });
});

describe('isValidSalesforceId', () => {
    it('should return true for 15 char ID', () => {
        expect(isValidSalesforceId('001000000000001')).toBe(true);
    });

    it('should return true for 18 char ID', () => {
        expect(isValidSalesforceId('001000000000001AAA')).toBe(true);
    });

    it('should return false for invalid ID', () => {
        expect(isValidSalesforceId('invalid')).toBe(false);
        expect(isValidSalesforceId('')).toBe(false);
        expect(isValidSalesforceId(null)).toBe(false);
    });
});

describe('normalizeStatus', () => {
    it('should remove accents and lowercase', () => {
        expect(normalizeStatus('Clôturer OK')).toBe('cloturer ok');
    });

    it('should handle null', () => {
        expect(normalizeStatus(null)).toBe('');
    });
});

describe('formatDateFr', () => {
    it('should format date in French locale', () => {
        const date = new Date('2026-01-20T10:00:00');
        const result = formatDateFr(date);
        expect(result).toContain('20/01');
        expect(result).toContain('10:00');
    });

    it('should return empty string for null', () => {
        expect(formatDateFr(null)).toBe('');
    });
});

