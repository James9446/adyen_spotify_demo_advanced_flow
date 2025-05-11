// --- Global Variables ---
let user;
let regionConfig;
let adyenCheckout; // Renamed to avoid conflict if 'checkout' is used elsewhere
let cardComponent;

// --- DOM Element References ---
// We get these references once the DOM is loaded or immediately if the script is deferred.
const checkoutTitle = document.getElementById('checkout-title');
const paymentFormWrapper = document.getElementById('payment-form-wrapper'); // Matches new HTML
const cardContainer = document.getElementById('card-container');
const savePaymentCheckbox = document.getElementById('save-payment');
const payButton = document.getElementById('pay-button'); // Initial attempt to get the button
const actionContainer = document.getElementById('action-container');
const messagesArea = document.getElementById('messages-area');

// --- Event Listeners & Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    // Initial setup 
    try {
        await setProfilePic();
        await initializeCheckout();
        payButton.addEventListener('click', handleSubmission);
    } catch(error) {
        colorLog("Error on page load: ", error, 'orange');
    }
});


// --- Adyen Integration Functions ---

// Initialize Adyen Checkout
async function initializeCheckout() {
    colorLog("Initializing API Only Checkout...", null, 'yellow');
    if (!cardContainer) {
        console.error("CRITICAL: cardContainer (id='card-container') not found. Cannot initialize Adyen Checkout.");
        showMessage("Error: Payment form could not be loaded. Card container missing.", "error");
        return;
    }

    try {
        user = await getFile('current-user.json');
        regionConfig = await getFile('region-config.json');
        colorLog("User: ", user.shopperName.firstName);
        colorLog("Region Config: ", regionConfig);

        const paymentDetailsPayload = {
            amount: { value: 10000, currency: regionConfig.currency },
            countryCode: regionConfig.country,
            shopperLocale: regionConfig.locale,
            channel: "Web",
            shopperReference: user.shopperReference,
            lineItems: [{
                "quantity": "1", "amountExcludingTax": "10000", "taxPercentage": "0",
                "description": "Premium Subscription", "id": "spotify_premium_monthly",
                "taxAmount": "0", "amountIncludingTax": "10000"
            }]
        };

        const paymentMethodsResponse = await callServer('/api/paymentMethods', paymentDetailsPayload);
        colorLog("API-Only /paymentMethods response: ", paymentMethodsResponse);

        if (!paymentMethodsResponse || paymentMethodsResponse.error || !paymentMethodsResponse.paymentMethods) {
            showMessage(`Error fetching payment methods: ${paymentMethodsResponse.error || 'Invalid response from server.'}`, 'error');
            return;
        }

        const clientKey = await getData('api/getClientKey');
        const configuration = {
            locale: regionConfig.locale,
            environment: "test",
            clientKey: clientKey,
            paymentMethodsResponse: paymentMethodsResponse,
            amount: paymentDetailsPayload.amount,
            onAdditionalDetails: async (state, component) => {
                colorLog("onAdditionalDetails triggered", null, 'yellow');
                colorLog("onAdditionalDetails state.data: ", state.data);
                if (actionContainer) {
                    // Clear previous action content immediately before new call
                    actionContainer.innerHTML = '';
                    // Keep it visible for now, new action might be mounted or it will be hidden by handlePaymentResult
                    actionContainer.style.display = 'block';
                }
                try {
                    const response = await callServer('/api/payments/details', state.data);
                    colorLog("/payments/details response: ", response);

                    if (response.action) {
                        // Action container should already be visible or made visible here
                        actionContainer ? actionContainer.style.display = 'block' : colorLog("actionContainer missing", null, 'orange');
                        // Handle mounting a new Action
                        component.handleAction(response.action); 
                    } else {
                        // No further action, payment is finalized. handlePaymentResult will hide actionContainer.
                        handlePaymentResult(response, component);
                    }
                } catch (error) {
                    colorLog("Error in onAdditionalDetails: ", error, 'orange');
                    showMessage(`Error processing payment details: ${error.message}`, 'error');
                    if (component) {
                        try { 
                            component.setStatus('error'); 
                        } catch(error) { 
                            colorLog("Error - it looks like the component was not found ", error, 'orange'); 
                        }
                    }
                    actionContainer ? actionContainer.style.display = 'none' : colorLog("actionContainer missing", null, 'orange'); // Hide on error too
                }
            },
            onError: (error, component) => {
                colorLog(`Adyen Checkout Error: ${error.name}`, error.message, 'orange');
                showMessage(`Adyen Error: ${error.message}`, 'error');
                if (component) try { component.setStatus('error'); } catch(error){ console.error(e); }
            }
        };

        adyenCheckout = await AdyenCheckout(configuration); // Uses global adyenCheckout

        cardComponent = adyenCheckout.create('card', { // Uses global cardComponent
            hasHolderName: false,
            holderNameRequired: false,
            enableStoreDetails: false, // Explicitly false for now, can be enabled with checkbox logic later
            styles: { 
                base: { color: '#d8d8d8', fontSize: '16px' },
                error: { color: 'orange'},
                validated: { color: '#1db954'}
            }
        }).mount('#card-container'); // Mounts to the global cardContainer reference

        colorLog("Card Component Mounted", null, 'yellow');

    } catch (error) {
        colorLog("Error initializing Adyen Checkout: ", error, 'orange');
        showMessage(`Initialization Error: ${error.message || 'Unknown initialization error.'}`, 'error');
    };
}


// Handle payment submission
async function handleSubmission() {
    if (!cardComponent || typeof cardComponent.data === 'undefined') {
        colorLog("Card component not initialized or invalid in handleSubmission. Aborting.", null, 'orange');
        showMessage("Error: Payment component not ready. Please try reloading.", "error");
        return;
    };

    colorLog("handleSubmission triggered", null, 'yellow');

    showMessage('Processing...', 'info');


    if (cardComponent.state && cardComponent.state.isValid) {
        const cardData = cardComponent.data;
        const shouldStorePaymentMethod = savePaymentCheckbox ? savePaymentCheckbox.checked : false;

        const paymentPayload = {
            ...cardData,
            shopperReference: user.shopperReference,
            shopperEmail: user.shopperEmail,
            shopperName: user.shopperName,
            countryCode: regionConfig.country,
            amount: { value: 10000, currency: regionConfig.currency },
            reference: `Spotify_Premium_API_${generateUUID()}`,
            returnUrl: window.location.href.split('?')[0],
            channel: "Web",
            lineItems: [{
                "quantity": "1", "amountExcludingTax": "10000", "taxPercentage": "0",
                "description": "Premium Subscription", "id": "spotify_premium_monthly",
                "taxAmount": "0", "amountIncludingTax": "10000"
            }],
            authenticationData: { threeDSRequestData: { nativeThreeDS: "preferred" }},
            storePaymentMethod: shouldStorePaymentMethod,
            shopperInteraction: "Ecommerce",
            ...(shouldStorePaymentMethod && { recurringProcessingModel: "CardOnFile" })
        };

        colorLog("/payments request: ", paymentPayload);

        try {
            const response = await callServer('/api/payments', paymentPayload);
            colorLog("/payments response: ", response);

            if (response.action) {
                colorLog("Action required: ", response.action.type, 'yellow');
                if (actionContainer) { 
                    actionContainer.innerHTML = ''; 
                    actionContainer.style.display = 'block';
                } else {
                    console.error("actionContainer not found");
                }
                adyenCheckout.createFromAction(response.action).mount(actionContainer); // Assumes adyenCheckout is initialized
            } else {
                // This is where your trace pointed (approx line 264)
                handlePaymentResult(response, cardComponent);
            };
        } catch (error) { // This catch is for errors from callServer or subsequent processing
            colorLog("Error during /payments call or response handling: ", error, 'orange');
            showMessage(`Payment Error: ${error.message || 'Unknown payment processing error.'}`, 'error');
        };
    } else {
        showMessage("Please check your card details.", 'error');
        if (cardComponent.showValidation) {
            cardComponent.showValidation(); 
        } else {
            console.warn("cardComponent.showValidation not available");
        };
    };
};


// Handle the payment result from Adyen
function handlePaymentResult(response, componentInstance) {
    colorLog("handlePaymentResult triggered", null, 'yellow');
    colorLog("handlePaymentResult response argument: ", response);

    if (actionContainer) {
        actionContainer.innerHTML = ''; // Clear any previous action
        actionContainer.style.display = 'none'; // Hide it
    };

    if (componentInstance) {
        try {
            componentInstance.unmount();
        } catch (error) {
            colorLog("Error unmounting component: ", null, 'orange');
        };
    };

    if (paymentFormWrapper) {
        paymentFormWrapper.style.display = 'none'; // Hide the payment form section
    } else {
        colorLog("paymentFormWrapper element not found in handlePaymentResult", null, 'orange');
    };

    
    // Default to error if checkoutTitle is not available
    if (!checkoutTitle) {
        colorLog("checkoutTitle element not found in handlePaymentResult", null, 'orange');
    };
    let messageTitle = "Error";
    let messageText = `An unexpected error occurred: ${response.resultCode || 'Unknown error'}. Please try again.`;
    let messageType = 'error';

    switch (response.resultCode) {
        case "Authorised":
            messageTitle = "Payment Completed";
            messageText = "Payment successful! Welcome to Spotify Premium!";
            messageType = 'success';
            setTimeout(addButton, 3000);
            colorLog("Final resultCode: ", response.resultCode);
            break;
        case "Refused":
            messageTitle = "Payment Refused";
            messageText = "Payment was refused. Please try another card or contact your bank.";
            messageType = 'refused';
            setTimeout(() => addButton("/api-only", "Continue"), 500);
            colorLog("Final resultCode: ", response.resultCode, 'orange');
            break;
        case "Pending":
        case "Received":
            messageTitle = "Payment Pending";
            messageText = "Your payment is pending. We'll update you soon.";
            messageType = 'info';
            colorLog("Final resultCode: ", response.resultCode, 'yellow');
            break;
        case "Error": // Explicit "Error" resultCode from Adyen
            messageTitle = "Payment Error";
            messageText = "An error occurred during payment. Please try again.";
            messageType = 'error';
            colorLog("Final resultCode: ", response.resultCode, 'orange');
            if (componentInstance) {
                try { 
                    componentInstance.setStatus('error'); 
                } catch(error) { 
                    colorLog("Error - it looks like the component was not found ", error, 'orange'); 
                }
            }
            break;
        default: // Handles unexpected or missing resultCode
            colorLog("Unexpected/Missing resultCode: ", response.resultCode, 'orange');
            if (componentInstance) {
                try { 
                    componentInstance.setStatus('error'); 
                } catch(error) { 
                    colorLog("Error - it looks like the component was not found ", error, 'orange'); 
                };
            };
            break;
    };

    if (checkoutTitle) {
        checkoutTitle.textContent = messageTitle;
    };
    showMessage(messageText, messageType);
    colorLog("pspReference: ", response.pspReference);
};


// --- Utility Functions ---
function showMessage(message, type = 'info') {
    if (messagesArea) {
        messagesArea.innerHTML = `<div class="message message-${type}">${message}</div>`;
        messagesArea.style.display = 'block'; // Make it visible
        
        // colorLog(`UI Message displayed (type: ${type}): `, message, '#E91E63');

        // Clear any existing timer to hide the message area if a new message comes in quickly
        if (messagesArea.displayTimer) {
            clearTimeout(messagesArea.displayTimer);
        };

        // Automatically hide general info/error messages after a delay
        if (type === 'info') { 
            messagesArea.displayTimer = setTimeout(() => {
                messagesArea.style.display = 'none';
                messagesArea.innerHTML = ''; // Clear content when hiding
            }, 5000); // Increased to 5 seconds, adjust as needed
        };
    } else {
        colorLog("messagesArea element not found. Cannot show message: ", message, 'orange');
    };
};