({
    handleNavigationRequest : function(component, event, helper) {
        var params = null;
        var payloadStr = event.getParam('payloadString');
        
        console.log('Aura Event PayloadString:', payloadStr);

        try {
            if (payloadStr) {
                params = JSON.parse(payloadStr);
            } else {
                 // Debug: voir ce qu'on reçoit vraiment si ça échoue encore
                 var allParams = event.getParams();
                 console.log('Aura All Params Keys:', Object.keys(allParams));
                 alert('Aura Debug: Params received -> ' + JSON.stringify(allParams));
            }
        } catch (e) {
            alert('Aura JSON Parse Error: ' + e.message);
            console.error('JSON Parse Error', e);
        }

        if (!params) {
            // alert('Aura Error: Navigation parameters missing.'); // Déjà couvert par le debug ci-dessus
            return;
        }

        console.log('Aura Parsed Params:', JSON.stringify(params));

        // Navigation vers un Record (Standard Record Page)
        if (params.type === 'standard__recordPage' && params.attributes && params.attributes.recordId) {
            
            var formFactor = $A.get("$Browser.formFactor");
            console.log('Device Form Factor: ' + formFactor);

            // MOBILE : On force l'utilisation de l'événement Legacy
            if (formFactor !== 'DESKTOP') {
                console.log('Mobile/Tablet detected: Optimized Strategy');

                // 1. Preferred: sforce.one (Salesforce1 Native API)
                // C'est souvent l'API la plus fiable dans le conteneur mobile
                if (typeof sforce !== 'undefined' && sforce && sforce.one) {
                    console.log('Mobile: Using sforce.one.navigateToSObject');
                    sforce.one.navigateToSObject(params.attributes.recordId, "detail");
                    return;
                }

                // 2. Fallback: force:navigateToSObject (Standard Aura Event)
                console.log('Mobile: Using e.force:navigateToSObject');
                var navEvt = $A.get("e.force:navigateToSObject");
                if (navEvt) {
                    navEvt.setParams({
                        "recordId": params.attributes.recordId
                    });
                    navEvt.fire();
                    return;
                }
                
                alert('Error: Mobile Navigation failed. No compatible service found.');
            }
            
            // DESKTOP (ou Mobile Fallback) : Standard Navigation Service
            console.log('Desktop detected (or One.app missing): Using lightning:navigation');
            var navService = component.find("navService");
            var pageReference = {
                type: 'standard__recordPage',
                attributes: {
                    recordId: params.attributes.recordId,
                    actionName: params.attributes.actionName || 'view'
                }
            };
            
            // Reconstitution du PageReference propre
            if (params.attributes.objectApiName) {
                pageReference.attributes.objectApiName = params.attributes.objectApiName;
            }

            try {
                navService.navigate(pageReference);
                return;
            } catch(e) {
                alert('Nav Service Error: ' + e);
            }
        }  
        
        // Navigation vers un Onglet (Nav Item)
        if (params.type === 'standard__navItemPage' && params.attributes && params.attributes.apiName) {
             // alert('Debug: Attempting Nav Item to ' + params.attributes.apiName);
             var navEvtUrl = $A.get("e.force:navigateToURL");
             if (navEvtUrl) {
                 navEvtUrl.setParams({
                     "url": "/lightning/n/" + params.attributes.apiName
                 });
                 navEvtUrl.fire();
                 return;
             }
        }

        // Standard Web Page
        if (params.type === 'standard__webPage' && params.attributes && params.attributes.url) {
             // alert('Debug: Attempting Web Page to ' + params.attributes.url);
             var navEvtUrl = $A.get("e.force:navigateToURL");
             if (navEvtUrl) {
                 navEvtUrl.setParams({
                     "url": params.attributes.url
                 });
                 navEvtUrl.fire();
                 return;
             } else {
                  window.open(params.attributes.url, '_system');
                  return;
             }
        }

        // Tentative générique avec navService si le reste échoue
        var navService = component.find("navService");
        var pageReference = {
            type: params.type,
            attributes: params.attributes,
            state: params.state
        };
        
        try {
            navService.navigate(pageReference);
        } catch(e) {
            alert('Aura Nav Service Failed: ' + e);
            console.error('Aura Navigation Service failed:', e);
        }
    }
})
