/**
 * @description Unit tests for LookupPill component
 */
import { createElement } from 'lwc';
import LookupPill from 'c/LookupPill';
import searchRecords from '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchRecords';

// Mock Apex
jest.mock(
    '@salesforce/apex/MntGestionEnvoiLogistiqueCtrl.searchRecords',
    () => ({
        default: jest.fn()
    }),
    { virtual: true }
);

describe('c-lookup-pill', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('should display search input when no value selected', () => {
        const element = createElement('c-lookup-pill', {
            is: LookupPill
        });
        element.label = 'Test Lookup';
        element.placeholder = 'Search...';
        document.body.appendChild(element);

        const input = element.shadowRoot.querySelector('lightning-input');
        expect(input).not.toBeNull();
        expect(input.placeholder).toBe('Search...');
    });

    it('should display pill when value is selected', () => {
        const element = createElement('c-lookup-pill', {
            is: LookupPill
        });
        element.selectedValue = {
            value: '001xxx',
            label: 'Test Record',
            pillLabel: 'Test Record'
        };
        document.body.appendChild(element);

        return Promise.resolve().then(() => {
            const pill = element.shadowRoot.querySelector('lightning-pill');
            expect(pill).not.toBeNull();
            expect(pill.label).toBe('Test Record');
        });
    });

    it('should emit select event when option clicked', () => {
        const element = createElement('c-lookup-pill', {
            is: LookupPill
        });
        document.body.appendChild(element);

        const selectHandler = jest.fn();
        element.addEventListener('select', selectHandler);

        // Simulate suggestion data
        element.suggestions = [{
            value: '001xxx',
            label: 'Test',
            sublabel: 'Subtitle'
        }];

        return Promise.resolve().then(() => {
            // TODO: Simulate click on suggestion
            // This would require opening dropdown and clicking
        });
    });

    it('should emit remove event when pill removed', () => {
        const element = createElement('c-lookup-pill', {
            is: LookupPill
        });
        element.selectedValue = {
            value: '001xxx',
            label: 'Test',
            pillLabel: 'Test'
        };
        document.body.appendChild(element);

        const removeHandler = jest.fn();
        element.addEventListener('remove', removeHandler);

        return Promise.resolve().then(() => {
            const pill = element.shadowRoot.querySelector('lightning-pill');
            pill.dispatchEvent(new CustomEvent('remove'));
            
            return Promise.resolve().then(() => {
                expect(removeHandler).toHaveBeenCalled();
                expect(element.selectedValue).toBeNull();
            });
        });
    });

    it('should call Apex with correct sObjectType', async () => {
        searchRecords.mockResolvedValue([
            { value: '001xxx', label: 'Result 1' }
        ]);

        const element = createElement('c-lookup-pill', {
            is: LookupPill
        });
        element.sObjectType = 'Contact';
        document.body.appendChild(element);

        const input = element.shadowRoot.querySelector('lightning-input');
        input.value = 'Test';
        input.dispatchEvent(new CustomEvent('change'));

        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 350));

        expect(searchRecords).toHaveBeenCalledWith({
            searchTerm: 'Test',
            sObjectType: 'Contact'
        });
    });

    it('should be disabled when disabled prop is true', () => {
        const element = createElement('c-lookup-pill', {
            is: LookupPill
        });
        element.disabled = true;
        document.body.appendChild(element);

        const input = element.shadowRoot.querySelector('lightning-input');
        expect(input.disabled).toBe(true);
    });
});

