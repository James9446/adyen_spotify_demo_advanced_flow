// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const redirectResult = urlParams.get("redirectResult");

// gitpod url needs to be grabbed because the value may be different 
const returnUrl = window.location.href;
// console.log("returnUrl: ", returnUrl);

let user;
let regionConfig;

// On page load get data from the server; trigger the checkout process
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // set the profile pic
        setProfilePic();

        // get user data from server
        user = await getFile('current-user.json');
        console.log('user: ', user.shopperName.firstName);

        // get region data from server
        regionConfig = await getFile('region-config.json');
        console.log('regionConfig: ', regionConfig);
        
        // check if there is a redirect parameter in the URL 
        if (!redirectResult) {
            // new session: start checkout
            startCheckout();
        } else {
            // complete Checkout
            handleRedirect(redirectResult);
        }
    } catch (error) {
        console.error("Failed to initialize checkout - Error:", error);
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

        // Call the server to create a payment session
        const paymentMethods = await callServer('/api/paymentMethods', checkoutDetails);
        console.log('paymentMehods: ', paymentMethods);

        // Create checkout instance using the session returned by the server
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
        console.error("Error in paymentMethods:", error);
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

        // The full /paymentMethods response object from your server. Contains the payment methods configured in your account.
        paymentMethodsResponse: paymentMethods,

        onSubmit: async (state, component) => {
            try {
                console.log("onSubmit triggered");
                // console.log("onSubmit state: ", state);
                // console.log("onSubmit component: ", component);
                // console.log("onSubmit paymentMethods: ", paymentMethods);

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

                if (shouldTokenize || state.data.paymentMethod.storedPaymentMethodId) { 
                    paymentsBody = Object.assign(state.data, user, paymentsProps, additionalTokenizationProps);
                } else {
                    paymentsBody = Object.assign(state.data, user, paymentsProps);
                }

                console.log("shouldTokenize: ", shouldTokenize);
                console.log("onSubmit /api/payments request: ", paymentsBody);

                // Make a POST /payments request from your server.
                const result = await callServer('/api/payments', paymentsBody);

                console.log("onSubmit /api/payments resultCode: ", result.resultCode);
                console.log("onSubmit /api/payments full result: ", result);
                console.log("pspReference: ", result.pspReference)
                // If the payment is successful, redirect to the success page
                // If the /payments request from your server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }

                // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
                // You must call this, even if the result of the payment is unsuccessful.
                if (result.action) {
                    console.log("onSubmit action: ", result.action);
                    component.handleAction(result.action);
                } else {
                    handlePaymentResult(result, component);
                }
            } catch (error) {
                console.error("Error in onSubmit", error);
                component.setStatus('error');
            }
        },

        onAdditionalDetails: async (state, component) => {
            try {
                console.log("onAdditionalDetails triggered");
                // console.log("onAdditionalDetails state: ", state);
                // console.log("onAdditionalDetails component: ", component);

                const paymentData = state.data;
                const reference = crypto.randomUUID();

                const paymentDetailsBody = {
                    paymentData,
                    countryCode,
                    locale,
                    amount,
                    reference,
                    lineItems,
                    returnUrl,
                }
                console.log("onAdditionalDetails /api/payments/details request: ", paymentDetailsBody);

                // Make a POST /payments request from your server.
                const result = await callServer('/api/payments/details', paymentDetailsBody);

                console.log("onAdditionalDetails /api/payments/details resultCode: ", result.resultCode);
                console.log("onAdditionalDetails /api/payments/details full result: ", result);
   
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }

                if (result.action) {
                    console.log("onAdditionalDetails action: ", result.action);
                    component.handleAction(result.action);
                } else {
                    handlePaymentResult(result, component);
                }
            } catch (error) {
                console.error("Error in onAdditionalDetails", error);
                component.setStatus('error');
            }
        },
        onPaymentCompleted: (result, component) => {
            console.log("Payment completed:");
            console.info(result, component);
            handlePaymentResult(result, component);
        },
        onPaymentFailed: (result, component) => {
            console.log("Payment failed:");
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
        const result = await callServer('/api/payments/details', {redirectResult});
        console.log('redirect payment details result: ', result);
        handlePaymentResult(result);

    } catch (error) {
        console.error("Error in handleRedirect", error);
    }
};



// Handle the payment result
function handlePaymentResult(response, component) {
    switch (response.resultCode) {
        case "Authorised":
            component ? component.unmount() : console.log('no component - unmount not necessary');
            changeCheckoutTitle("Payment Completed");
            setTimeout(addPaymentCompleteMessage, 2000);
            setTimeout(addButton, 3000);
            console.log("final resultCode: ", response.resultCode);
            break;
        case "Refused":
            component ? component.unmount() : console.log('no component - unmount not necessary');
            changeCheckoutTitle("Payment Refused");
            console.log("final resultCode: ", response.resultCode);
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
            console.log("final resultCode: ", response.resultCode);
        case "Received":
            console.log("final resultCode: ", response.resultCode);
            break;
        default:
            changeCheckoutTitle("Error");
            console.log("Error (possibly due to no resultCode) response.resultCode: ", response.resultCode);
            component ? component.setStatus('error') : console.log('no component');
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