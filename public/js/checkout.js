// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("sessionId");
const redirectResult = urlParams.get("redirectResult");

// gitpod url
const gitpodURL = window.location.href.split('/checkout')[0];

// Tokenization
function shouldSavePayment() {
    checkboxValue = document.getElementById('save-payment').checked;
    return checkboxValue;
};

// Trigger the checkout process on page load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (!redirectResult) {
            // new session: start checkout
            startCheckout();
        } else {
            // existing session: complete Checkout
            handleRedirect(redirectResult);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to initialize checkout. See console for details.");
    }
});

// Start the checkout process
async function startCheckout() {
    try {
        // const user = await callServer('/api/read-data');
        const user = await getData("/api/getUser");
        console.log('user: ', user.shopperName.firstName);
        const checkoutDetails = {
            amount: {
                value: 10000,
                currency: "USD",
            },
            countryCode: "US",
            locale: "en-US",
            channel: "Web",
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
            gitpodURL,
            shopperReference: user.shopperReference
        };
        // Call the server to create a payment session
        const paymentMethods = await callServer(
            `/api/paymentMethods`,
            checkoutDetails,
        );

        console.log('paymentMehods: ', paymentMethods);
        // Create checkout instance using the session returned by the server
        const checkout = await createCheckoutInstance({
            paymentMethods,
            checkoutDetails,
        });

        // Create Drop-in component and mount it
        checkout
            .create("dropin", { 
                instantPaymentTypes: ["googlepay"]
            })
            .mount(document.getElementById("dropin-container"));
    } catch (error) {
        console.error("Error in paymentMethods:", error);
        // alert("Error occurred. Look at console for details");
    }
}

// Create and configure checkout instance
async function createCheckoutInstance({ paymentMethods, checkoutDetails }) {
    const clientKey = await getData('api/getClientKey');
    const user = await getData("/api/getUser");
    const amount = checkoutDetails.amount;
    const locale = checkoutDetails.locale;
    const countryCode = checkoutDetails.countryCode;
    const lineItems = checkoutDetails.lineItems;
    const gitpodURL = checkoutDetails.gitpodURL;

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
                console.log("state: ", state);
                console.log("component: ", component);
                console.log("paymentMethods: ", paymentMethods);

                const reference = crypto.randomUUID();
                
                let paymentsBody = {};
                const paymentsProps = {
                    countryCode,
                    locale,
                    amount,
                    reference,
                    lineItems,
                    gitpodURL,
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

                console.log('shouldTokenize: ', shouldTokenize);
                console.log('paymentsBody: ', paymentsBody);

                // Make a POST /payments request from your server.
                const result = await callServer(`/api/payments`, paymentsBody);

                console.log("result", result);
                // If the payment is successful, redirect to the success page
                // If the /payments request from your server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }

                // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
                // You must call this, even if the result of the payment is unsuccessful.
                if (result.action) {
                    component.handleAction(action);
                } else {
                    handlePaymentResult(result, component);
                }
            } catch (error) {
                console.error("onSubmit", error);
                component.setStatus('error');
            }
        },

        onAdditionalDetails: async (state, component) => {
            try {
                console.log("onAdditionalDetails triggered");
                console.log("state: ", state);
                console.log("component: ", component);

                const paymentData = state.data;
                const reference = crypto.randomUUID();

                // Make a POST /payments request from your server.
                const result = await callServer(`/api/payments/details`, {
                    paymentData,
                    countryCode,
                    locale,
                    amount,
                    reference,
                    lineItems,
                    gitpodURL,
                });

                console.log("result", result);
                // If the payment is successful, redirect to the success page
                // If the /payments request from your server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    handlePaymentResult(result, component);
                    return;
                }

                // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
                // You must call this, even if the result of the payment is unsuccessful.
                if (result.action) {
                    component.handleAction(action);
                } else {
                    handlePaymentResult(result, component);
                }
            } catch (error) {
                console.error("onSubmit", error);
                component.setStatus('error');
            }
        },
        onPaymentCompleted: (result, component) => {
            console.log("Payment completed:");
            console.info(result, component);
            handlePaymentResult(result, component);
        },
        onPaymentFailed: (result, component) => {
            console.info(result, component);
        },
        onError: (error, component) => {
            console.error(error.name, error.message, error.stack, component);
        },
    };

    return new AdyenCheckout(configuration);
}

async function makePaymentsCall(paymentData) {
    try {
        console.log("makePaymentsCall Data: ", paymentData);
        const paymentResult = await callServer(`/api/payments`, paymentData);
        return paymentResult;
    } catch (error) {
        console.error(error);
        alert("Error occurred. Look at console for details");
    }
}

// Handle redirects after card challenges
async function handleRedirect(redirectResult) {
    try {
        const result = await callServer(`/api/payments/details`, {redirectResult});
        console.log('redirect payment details result: ', result);
        handlePaymentResult(result);

    } catch (error) {
        console.error(error);
        alert("Error occurred. Look at console for details");
    }
}

// Handle the payment result
function handlePaymentResult(response, component) {
    switch (response.resultCode) {
        case "Authorised":
            component ? component.unmount() : console.log('no component');
            changeCheckoutTitle("Payment Completed");
            setTimeout(addPaymentCompleteMessage, 2000);
            setTimeout(addButton, 3000);
            console.log("response.resultCode: ", response.resultCode);
            break;
        case "Refused":
            changeCheckoutTitle("Payment Refused");
            setTimeout(() => {
                addPaymentCompleteMessage(
                    "We encountered a problem while processing your payment method.",
                );
                addPaymentCompleteMessage(
                    "Please try again, or choose a different payment method to complete your purchase.",
                );
                addButton("/checkout", "Continue");
            }, 1500);
            console.log("response.resultCode: ", response.resultCode);
            break;
        case "Pending":
            console.log("response.resultCode: ", response.resultCode);
        case "Received":
            console.log("response.resultCode: ", response.resultCode);
            break;
        default:
            changeCheckoutTitle("Error");
            console.log("response.resultCode: ", response.resultCode);
            component ? component.setStatus('error') : console.log('no component');
            break;
    }
}

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
}

// async function callServer(url, data, method='POST') {
//     try {
//       const response = await fetch(url, {
//         method,
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(data)
//       });
  
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
  
//       return await response.json();

//     } catch (error) {
//       console.error('Error:', error.message);
//       alert('Failed to save data. Please try again.');
//     }
// }

// ----- Utility functions ------

async function getData(url) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('Data retrieved successfully: ', data);
        return data;
    } catch (error) {
        console.error('Error fetching data:', error.message);
        alert('Failed to retrieve data. Please try again.');
        return null;
    }
}

function changeCheckoutTitle(newTitle) {
    const titleElement = document.getElementById("checkout-title");
    if (titleElement) {
        titleElement.textContent = newTitle;
    } else {
        console.error("Checkout title element not found");
    }
}

function addPaymentCompleteMessage(
    message = "Welcome to Spotify Premium! Enjoy music like never before!",
) {
    const container = document.querySelector(".checkout-container");

    // Add payment complete message after session is complete
    const paymentCompleteMessage = document.createElement("p");
    paymentCompleteMessage.textContent = message;
    paymentCompleteMessage.style.marginTop = "20px";
    container.appendChild(paymentCompleteMessage);
}

function addButton(href = "/", buttonText = "Explore Your Benefits") {
    const container = document.querySelector(".checkout-container");

    // Add button to navigate back to homepage
    const button = document.createElement("button");
    button.textContent = buttonText;
    button.style.marginTop = "20px";
    button.style.padding = "10px 20px";
    button.style.backgroundColor = "#1DB954";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "20px";
    button.style.cursor = "pointer";

    button.addEventListener("click", () => {
        window.location.href = href; // Adjust this if your homepage URL is different
    });

    container.appendChild(button);
}

// document.getElementById("login-btn").addEventListener("click", getUser);