import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import ZXING_JS from '@salesforce/resourceUrl/ZxingJS';
import { loadScript } from 'lightning/platformResourceLoader';

/**
 * @description Composant simple de scanner QR Code pour Screen Flows
 */
export default class BarcodeScannerButton extends LightningElement {
    @api scannedValue = '';
    @api buttonLabel = 'Scanner le\nN° Série';
    @api buttonVariant = 'brand';
    @api buttonIconName = 'utility:scan';
    @api instructionText = 'Positionnez le N° Série dans le cadre';
    @api successText = 'N° Série scanné avec succès!';
    
    isScanning = false;
    showScanner = false;
    isLibraryLoaded = false;
    codeReader = null;
    
    connectedCallback() {
        this.loadZXingLibrary();
    }
    
    disconnectedCallback() {
        this.stopScanning();
    }
    
    loadZXingLibrary() {
        loadScript(this, ZXING_JS)
            .then(() => {
                this.isLibraryLoaded = true;
            })
            .catch(() => {
                this.showToast('Erreur', 'Impossible de charger la bibliothèque de scan', 'error');
            });
    }
    
    handleScanClick() {
        if (!this.isLibraryLoaded) {
            this.showToast('Erreur', 'La bibliothèque n\'est pas encore chargée', 'warning');
            return;
        }
        this.showScanner = true;
        this.isScanning = true;
        setTimeout(() => {
            this.startScanning();
        }, 100);
    }
    
    async startScanning() {
        try {
            const videoElement = this.template.querySelector('video');
            if (!videoElement) {
                throw new Error('Élément vidéo non trouvé');
            }
            
            // Configuration simple pour QR codes
            const hints = new Map();
            hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
                window.ZXing.BarcodeFormat.QR_CODE,
                window.ZXing.BarcodeFormat.CODE_39,  
                window.ZXing.BarcodeFormat.CODE_128,
                window.ZXing.BarcodeFormat.EAN_13
            ]);
            
            this.codeReader = new window.ZXing.BrowserMultiFormatReader(hints);
            this.codeReader.timeBetweenScansMillis = 500;
            
            const devices = await this.codeReader.listVideoInputDevices();
            if (devices.length === 0) {
                throw new Error('Aucune caméra détectée');
            }
            
            const backCamera = devices.find(device => 
                device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('rear')
            );
            const selectedDeviceId = backCamera ? backCamera.deviceId : devices[0].deviceId;
            
            await this.codeReader.decodeFromVideoDevice(
                selectedDeviceId,
                videoElement,
                (result, error) => {
                    if (result) {
                        this.handleScanSuccess(result.getText());
                    }
                }
            );
        } catch (error) {
            this.showToast('Erreur', error.message, 'error');
            this.stopScanning();
        }
    }
    
    handleScanSuccess(code) {
        this.scannedValue = code;
        
        // Notifier le Flow que la valeur a changé
        const attributeChangeEvent = new FlowAttributeChangeEvent('scannedValue', code);
        this.dispatchEvent(attributeChangeEvent);
        
        this.copyToClipboard(code);
        this.showToast('Succès', `N° Série: ${code}`, 'success');
        this.stopScanning();
    }
    
    stopScanning() {
        if (this.codeReader) {
            this.codeReader.reset();
            this.codeReader = null;
        }
        this.showScanner = false;
        this.isScanning = false;
    }
    
    handleCancelClick() {
        this.stopScanning();
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        }
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}
