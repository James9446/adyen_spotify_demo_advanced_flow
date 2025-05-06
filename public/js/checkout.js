const urlParams = new URLSearchParams(window.location.search);
const redirectResult = urlParams.get("redirectResult");
const returnUrl = window.location.href;
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
            // when not a redirect console.log user data and region data
            colorLog("user: ", user.shopperName.firstName);
            colorLog("regionConfig: ", regionConfig);
            
            // not redirect => start new checkout
            startCheckout();       
        } else {
            handleRedirect(redirectResult);
        }
    } catch (error) {
        colorLog("Failed to initialize checkout - Error: ", error, 'orange');
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
        colorLog("paymentMehods: ", paymentMethods);

        // Create checkout instance using the paymentMethods returned by the server
        const checkout = await createCheckoutInstance({ paymentMethods, checkoutDetails });

        // Create Drop-in component and mount it
        checkout
            .create("dropin", { 
                instantPaymentTypes: ['googlepay']
            })
            .mount(document.getElementById("dropin-container"));
    } catch (error) {
        colorLog("Error in paymentMethods:", error, 'orange');
    }
};



// Create and configure checkout instance
async function createCheckoutInstance({ paymentMethods, checkoutDetails }) {
    const clientKey = await getData('api/getClientKey');
    const { countryCode, locale, amount, channel, lineItems } = checkoutDetails;
    const securedFieldStyles = {
        base: {
            color: '#d8d8d8'
        },
        error: {
            color: 'orange'
        },
        validated: {
            color: '#1db954;',
        },
        // placeholder: {
        //     color: '#d8d8d8'
        // }
    };

    const configuration = {
        clientKey,
        environment: "test",
        amount,
        locale,
        countryCode,
        paymentMethodsResponse: paymentMethods,
        paymentMethodsConfiguration: {
            card: {
                name: 'Credit or debit card',
                // hasHolderName: true,
                // holderNameRequired: true,
                // enableStoreDetails: true,
                // billingAddressRequired: true,
                // billingAddressMode: 'partial'
                styles: securedFieldStyles,
            },
            storedCard: {
                styles: securedFieldStyles,
            },
            threeDS2: {
                challengeWindowSize: '05'
            },
            googlepay: {
                amount,
                countryCode,
                environment: "TEST"
            },
            applepay: {
                amount,
                countryCode,
                environment: "TEST"
            }
        },

        onSubmit: async (state, component) => {
            try {
                colorLog("onSubmit triggered", null, 'yellow');    
                const reference = generateUUID();
                console.log('reference: ', reference);

                let paymentsBody = {
                    ...state.data,
                    ...user,
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

                // Tokenization
                const shouldTokenize = shouldSavePayment();
                const isStoredPaymentMethod = state.data.paymentMethod.storedPaymentMethodId;
                
                const tokenizationProps = {
                    recurringProcessingModel: "CardOnFile", 
                    shopperInteraction: isStoredPaymentMethod ? "ContAuth" : "Ecommerce",
                    storePaymentMethod: !isStoredPaymentMethod,
                }

                if (shouldTokenize || isStoredPaymentMethod) {
                    paymentsBody = {
                        ...paymentsBody,
                        ...tokenizationProps,
                    };
                }

                
                
                // ------------   PAYMENTS REQUEST  ---------------
                colorLog("/payments request: ", paymentsBody);
                const result = await callServer('/api/payments', paymentsBody);

                colorLog("/payments response - resultCode: ", result.resultCode);
                // colorLog("/payments response - full result: ", result);
                
                
                // If the /payments request from the server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }
                
                // handle action 
                if (result.action) {
                    colorLog("/payments response - action.type: ", result.action.type);
                    component.handleAction(result.action);
                } else {
                    handlePaymentResult(result, component);
                }
                colorLog("pspReference: ", result.pspReference)
            } catch (error) {
                colorLog("Error in onSubmit", error, 'orange');
                component.setStatus('error');
            }
        },

        onAdditionalDetails: async (state, component) => {
            try {
                colorLog("onAdditionalDetails triggered", null, 'yellow');
                

                // -------------    PAYMENT DETAILS REQUEST    --------------
                colorLog("/paymentsDetails request: ", state.data);
                const result = await callServer('/api/payments/details', state.data);

                // colorLog("/paymentsDetails response - full result: ", result); 
                colorLog("/paymentsDetails response - resultCode: ", result.resultCode);
   
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }

                if (result.action) {
                    colorLog("/paymentsDetails response - action.type: ", result.action.type);
                    component.handleAction(result.action);
                } else {
                    handlePaymentResult(result, component);
                }
            } catch (error) {
                colorLog("Error in onAdditionalDetails", error, 'orange');
                component.setStatus('error');
            }
        },
        onPaymentCompleted: (result, component) => {
            colorLog("Payment completed", null, 'yellow');
            console.info(result, component);
            handlePaymentResult(result, component);
        },
        onPaymentFailed: (result, component) => {
            colorLog("Payment failed", null, 'orange');
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
        colorLog("handleRedirect triggered", null, 'yellow');
        const requestBody = {
            details: {
                redirectResult
            }
        };

        // -------------    PAYMENT DETAILS REQUEST    --------------
        colorLog("redirect /paymentDetails request: ", requestBody);
        const result = await callServer('api/payments/details', requestBody);

        colorLog("redirect /paymentDetails response - resultCode: ", result.resultCode);
        handlePaymentResult(result);

    } catch (error) {
        colorLog("Error in handleRedirect", error, 'orange');
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
            colorLog("final resultCode: ", response.resultCode);
            break;
        case "Refused":
            if (component) {
                component.unmount();
            };
            changeCheckoutTitle("Payment Refused");
            colorLog("final resultCode: ", response.resultCode);
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
            colorLog("final resultCode: ", response.resultCode);
        case "Received":
            colorLog("final resultCode: ", response.resultCode);
            break;
        default:
            changeCheckoutTitle("Error");
            colorLog("Error (possibly due to no resultCode) response.resultCode: ", response.resultCode, 'orange');
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