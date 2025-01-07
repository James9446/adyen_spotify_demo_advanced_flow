// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("sessionId");
const redirectResult = urlParams.get("redirectResult");

// Trigger the checkout process on page load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (!sessionId) {
            // new session: start checkout
            startCheckout();
        } else {
            // existing session: complete Checkout
            handleRedirect();
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to initialize checkout. See console for details.");
    }
});

// Start the checkout process
async function startCheckout() {
    try {
        const checkoutDetails = {
            amount: {
                value: 10000,
                currency: "EUR",
            },
            countryCode: "NL",
            locale: "nl-NL",
            channel: "Web",
            lineItems: [
                {
                    quantity: 1,
                    amountIncludingTax: 10000,
                    description: "Premium Membership",
                },
            ],
        };
        // Call the server to create a payment session
        const paymentMethods = await callServer(
            `/api/paymentMethods`,
            checkoutDetails,
        );

        // Create checkout instance using the session returned by the server
        const checkout = await createCheckoutInstance({
            paymentMethods,
            checkoutDetails,
        });

        // Create Drop-in component and mount it
        checkout
            .create("dropin", { instantPaymentTypes: ["googlepay"] })
            .mount(document.getElementById("dropin-container"));
    } catch (error) {
        console.error("Error in paymentMethods:", error);
        // alert("Error occurred. Look at console for details");
    }
}

// Create and configure checkout instance
async function createCheckoutInstance({ paymentMethods, checkoutDetails }) {
    const clientKey = await getClientKey();
    const amount = checkoutDetails.amount;
    const locale = checkoutDetails.locale;
    const countryCode = checkoutDetails.countryCode;

    console.log("amount createCheckoutInstance", amount);

    const configuration = {
        clientKey,
        environment: "test",
        amount,
        locale,
        countryCode,

        // The full /paymentMethods response object from your server. Contains the payment methods configured in your account.
        paymentMethodsResponse: paymentMethods,

        onSubmit: async (state, component, actions) => {
            try {
                console.log("state: ", state);
                console.log("component: ", component);
                console.log("actions: ", actions);

                // Make a POST /payments request from your server.
                const paymentData = state.data;
                const reference = crypto.randomUUID();
                const result = await makePaymentsCall({
                    paymentData,
                    countryCode,
                    locale,
                    amount,
                    reference,
                });

                console.log("result", result);
                // If the payment is successful, redirect to the success page
                // If the /payments request from your server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    actions.reject();
                    return;
                }

                const { resultCode, action, order, donationToken } = result;

                // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
                // You must call this, even if the result of the payment is unsuccessful.
                console.log("actions: ", actions);
                actions.resolve({
                    resultCode,
                    action,
                    order,
                    donationToken,
                });

                // if (action) {
                //   component.handleAction(action);
                // } else {
                //   component.setStatus(resultCode);
                // }
            } catch (error) {
                console.error("onSubmit", error);
                actions.reject();
            }
        },

        onAdditionalDetails: async (state, component, actions) => {
            // try {
            //     const result = await makeDetailsCall(state.data);

            //     if (!result.resultCode) {
            //       component.setStatus('error');
            //       return;
            //     }

            //     const { resultCode, action } = result;

            //     if (action) {
            //       component.handleAction(action);
            //     } else {
            //       component.setStatus(resultCode);
            //     }
            //   } catch (error) {
            //     console.error("onAdditionalDetails", error);
            //     component.setStatus('error');
            //   }

            try {
                // Make a POST /payments/details request from your server.
                const result = await makeDetailsCall(state.data);

                // If the /payments/details request from your server fails, or if an unexpected error occurs.
                if (!result.resultCode) {
                    actions.reject();
                    return;
                }

                const { resultCode, action, order, donationToken } = result;

                // If the /payments/details request request from your server is successful, you must call this to resolve whichever of the listed objects are available.
                // You must call this, even if the result of the payment is unsuccessful.
                actions.resolve({
                    resultCode,
                    action,
                    order,
                    donationToken,
                });
            } catch (error) {
                console.error("onSubmit", error);
                actions.reject();
            }
        },
        onPaymentCompleted: (result, component) => {
            console.log("Payment completed:");
            console.info(result, component);
            handlePaymentResult(result);
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
async function handleRedirect() {
    try {
        // Create checkout instance using Session extracted from query string parameter
        const checkout = await createCheckoutInstance({ id: sessionId });

        // Submit the extracted redirectResult - triggers the onPaymentCompleted() handler
        checkout.submitDetails({ details: { redirectResult } });
    } catch (error) {
        console.error(error);
        alert("Error occurred. Look at console for details");
    }
}

// Handle the payment result
function handlePaymentResult(response) {
    switch (response.resultCode) {
        case "Authorised":
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

// ----- Utility functions ------

async function getClientKey() {
    const response = await fetch("/api/getClientKey");
    const data = await response.json();
    console.log(data.clientKey);
    return data.clientKey;
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
