// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const redirectResult = urlParams.get("redirectResult");

// gitpod url needs to be grabbed because the value may be different 
const returnUrl = window.location.href;
// console.log('%c' + "returnUrl: ", 'color: #90EE90', returnUrl);

let user;
let regionConfig;

// On page load get data from the server; trigger the checkout process
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // set the profile pic
        setProfilePic();

        // get user data from server
        user = await getFile('current-user.json');
        
        // get region data from server
        regionConfig = await getFile('region-config.json');
        
        // check if there is a redirect parameter in the URL 
        if (!redirectResult) {
            // only log user details if page load is not after a redirect
            console.log('%c' + "user: ", 'color: #90EE90', user.shopperName.firstName);
            console.log('%c' + "regionConfig: ", 'color: #90EE90', regionConfig);
            // new session: start checkout
            startCheckout();
        } else {
            // complete Checkout
            handleRedirect(redirectResult);
        }
    } catch (error) {
        console.error('%c' + "Failed to initialize checkout - Error:", 'color: orange', error);
    };
});


// Start the checkout process
async function startCheckout() {
    try {
        const checkoutDetails = {
            amount: {
                value: 10000,
                currency: regionConfig.currency,
            },
            countryCode: regionConfig.country,
            locale: regionConfig.locale,
            channel: "web",
            lineItems:[
                {
                    "quantity": "1",
                    "amountExcludingTax": "331",
                    "taxPercentage": "2100",
                    "description": "Shoes",
                    "id": "Item #1",
                    "taxAmount": "0",
                    "amountIncludingTax": "10001",
                    "productUrl": "URL_TO_PURCHASED_ITEM",
                    "imageUrl": "URL_TO_PICTURE_OF_PURCHASED_ITEM"
                }
            ],
            shopperReference: user.shopperReference
        };

        // -------- Call server to create get the paymentMethods -----------
        const paymentMethods = await callServer('/api/paymentMethods', checkoutDetails);
        console.log('%c' + "paymentMehods: ", 'color: #90EE90', paymentMethods);

        // Create checkout instance using the paymentMethods returned by the server
        const checkout = await createCheckoutInstance({ paymentMethods, checkoutDetails });

        // Create Drop-in component and mount it
        checkout
            .create("dropin", { 
                instantPaymentTypes: ["googlepay"],
                paymentMethodsConfiguration: {
                    card: {
                        hasHolderName: true,
                        holderNameRequired: true,
                        enableStoreDetails: true,
                        name: 'Credit or debit card',
                        billingAddressRequired: true
                    },
                    threeDS2: {
                        challengeWindowSize: '05'
                    }
                }
            })
            .mount(document.getElementById("dropin-container"));
    } catch (error) {
        console.error('%c' + "Error in paymentMethods:", 'color: orange', error);
    }
};

// Create and configure checkout instance
async function createCheckoutInstance({ paymentMethods, checkoutDetails }) {
    const clientKey = await getData('api/getClientKey');
    const { countryCode, locale, amount, channel, lineItems } = checkoutDetails;

    const configuration = {
        clientKey,
        environment: "test",
        amount,
        locale,
        countryCode,
        paymentMethodsResponse: paymentMethods,

        onSubmit: async (state, component) => {
            try {
                console.log('%c' + "onSubmit triggered", 'color: yellow');
                // console.log('%c' + "onSubmit state: ", 'color: #90EE90', state);
                // console.log('%c' + "onSubmit component: ", 'color: #90EE90', component);
                // console.log('%c' + "onSubmit paymentMethods: ", 'color: #90EE90', paymentMethods);

                const reference = crypto.randomUUID();
                
                let paymentsBody = {};
                const paymentsProps = {
                    countryCode,
                    locale,
                    amount,
                    channel,
                    reference,
                    lineItems,
                    returnUrl,
                    authenticationData: {
                        threeDSRequestData: {
                            nativeThreeDS: "preferred"
                        }
                    },
                };
                const additionalTokenizationProps = {
                    shopperInteraction: state.data.paymentMethod.storedPaymentMethodId ? "ContAuth" : "Ecommerce",
                    recurringProcessingModel: "CardOnFile", 
                    storePaymentMethod: state.data.paymentMethod.storedPaymentMethodId ? false : true,
                }

                const shouldTokenize = shouldSavePayment();
                // console.log('%c' + "shouldTokenize: ", 'color: #90EE90', shouldTokenize);

                if (shouldTokenize || state.data.paymentMethod.storedPaymentMethodId) {
                    paymentsBody = Object.assign(state.data, user, paymentsProps, additionalTokenizationProps);
                } else {
                    paymentsBody = Object.assign(state.data, user, paymentsProps);
                }

                console.log('%c' + "/payments request: ", 'color: #90EE90', paymentsBody);


                // ------------ Make a POST /payments request from the server.---------------
                const result = await callServer('/api/payments', paymentsBody);

                // console.log('%c' + "/payments response - full result: ", 'color: #90EE90', result);
                console.log('%c' + "/payments response - resultCode: ", 'color: #90EE90', result.resultCode);
                
                // If the /payments request from the server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }
                
                // handle action 
                if (result.action) {
                    // console.log('%c' + "/payments response - action: ", 'color: #90EE90', result.action);
                    console.log('%c' + "/payments response - action.type: ", 'color: #90EE90', result.action.type);
                    // console.log('%c' + "/payments response - action.subtype: ", 'color: #90EE90', result.action.subtype);
                    component.handleAction(result.action);
                } else {
                    handlePaymentResult(result, component);
                }
                console.log('%c' + "pspReference: ", 'color: #90EE90', result.pspReference)
            } catch (error) {
                console.error("Error in onSubmit", error);
                component.setStatus('error');
            }
        },

        onAdditionalDetails: async (state, component) => {
            try {
                console.log('%c' + "onAdditionalDetails triggered", 'color: yellow');
                // console.log('%c' + "onAdditionalDetails state: ", 'color: #90EE90', state);
                // console.log('%c' + "onAdditionalDetails component: ", 'color: #90EE90', component);

                const paymentData = state.data;
                const reference = crypto.randomUUID();

                const paymentDetailsBody = {
                    paymentData,
                    reference,
                };


                console.log('%c' + "/paymentsDetails request: ", 'color: #90EE90', paymentDetailsBody);

                // ------------- Make a POST /payments request from your server.--------------
                const result = await callServer('/api/payments/details', paymentDetailsBody);

                // console.log('%c' + "/paymentsDetails response - full result: ", 'color: #90EE90', result); 
                console.log('%c' + "/paymentsDetails response - resultCode: ", 'color: #90EE90', result.resultCode);
   
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }

                if (result.action) {
                    // console.log('%c' + "/paymentsDetails response - action: ", 'color: #90EE90', result.action);
                    console.log('%c' + "/paymentsDetails response - action.type: ", 'color: #90EE90', result.action.type);
                    // console.log('%c' + "/paymentsDetails response - action.subtype: ", 'color: #90EE90', result.action.subtype);
                    component.handleAction(result.action);
                } else {
                    handlePaymentResult(result, component);
                }
            } catch (error) {
                console.error('%c' + "Error in onAdditionalDetails", 'color: orange', error);
                component.setStatus('error');
            }
        },
        onPaymentCompleted: (result, component) => {
            console.log('%c' + "Payment completed:", 'color: yellow',);
            console.info(result, component);
            handlePaymentResult(result, component);
        },
        onPaymentFailed: (result, component) => {
            console.log('%c' + "Payment failed:", 'color: orange',);
            console.info(result, component);
        },
        onError: (error, component) => {
            console.error(error.name, error.message, error.stack, component);
        },
    };

    return new AdyenCheckout(configuration);
};



// Handle redirects after card challenges
async function handleRedirect(redirectResult) {
    try {
        const result = await callServer('api/payments/details', {
            paymentData: {
                details: {
                    redirectResult
                }
            }
        });
        console.log('%c' + "redirect /paymentDetails response: ", 'color: #90EE90', result);
        handlePaymentResult(result);

    } catch (error) {
        console.error('%c' + "Error in handleRedirect", 'color: #90EE90', error);
    }
};



// Handle the payment result
function handlePaymentResult(response, component) {
    switch (response.resultCode) {
        case "Authorised":
            if (component) {
                component.unmount();
            };
            changeCheckoutTitle("Payment Completed");
            setTimeout(addPaymentCompleteMessage, 2000);
            setTimeout(addButton, 3000);
            console.log('%c' + "final resultCode: ", 'color: #90EE90', response.resultCode);
            break;
        case "Refused":
            if (component) {
                component.unmount();
            };
            changeCheckoutTitle("Payment Refused");
            console.log('%c' + "final resultCode: ", 'color: #90EE90', response.resultCode);
            setTimeout(() => {
                addPaymentCompleteMessage(
                    "We encountered a problem while processing your payment method.",
                );
                addPaymentCompleteMessage(
                    "Please try again, or choose a different payment method to complete your purchase.",
                );
                addButton("/checkout", "Continue");
            }, 500);
            break;
        case "Pending":
            console.log('%c' + "final resultCode: ", 'color: #90EE90', response.resultCode);
        case "Received":
            console.log('%c' + "final resultCode: ", 'color: #90EE90', response.resultCode);
            break;
        default:
            changeCheckoutTitle("Error");
            console.log('%c' + "Error (possibly due to no resultCode) response.resultCode: ", 'color: orange', response.resultCode);
            if (component) {
                component.setStatus('error')
            };
            break;
    }
};



// Call server
async function callServer(url, data) {
    const response = await fetch(url, {
        method: "POST",
        body: data ? JSON.stringify(data) : "",
        headers: {
            "Content-Type": "application/json",
        },
    });

    return await response.json();
};

// Helper Function to determine whether Tokenization should be applied 
function shouldSavePayment() {
    checkboxValue = document.getElementById('save-payment').checked;
    return checkboxValue;
};