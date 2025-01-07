const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { uuid } = require("uuidv4");
const { hmacValidator } = require("@adyen/api-library");
const { Client, Config, CheckoutAPI, Types } = require("@adyen/api-library");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Adyen NodeJS library configuration
const config = new Config();
// console.log("process.env.ADYEN_API_KEY", process.env.ADYEN_API_KEY);
config.apiKey = process.env.ADYEN_API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST"); // change to LIVE for production
const checkout = new CheckoutAPI(client);

// ----- API ENDPOINTS -----
// GET Payment Methods
app.post("/api/paymentMethods", async (req, res) => {
  console.log("/paymentMethods start");
  try {
    const amount = {
      currency: req.body.amount.currency,
      value: req.body.amount.value,
    };
    const countryCode = req.body.countryCode;
    const shopperLocale = req.body.locale;
    const channel = req.body.channel;
    const lineItems = req.body.lineItems;

    const paymentMethodRequest = {
      amount,
      countryCode,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      shopperLocale,
      channel,
      lineItems,
    };
    // console.log("request body:", paymentMethodRequest);
    const response = await checkout.PaymentsApi.paymentMethods(
      paymentMethodRequest,
      {
        idempotencyKey: uuid(),
      },
    );

    // return the payment methods to the client i.e. return the CreateCheckoutSessionResponse object
    res.json(response);
  } catch (err) {
    console.error(
      `Error: ${err.message}, error code: ${err.errorCode}, stack: ${err.stack}`,
    );
    res
      .status(err.statusCode || 500)
      .json({ error: "An error occurred during payment processing" });
  }
});

// Make a Payment
app.post("/api/payments", async (req, res) => {
  console.log("/payment");
  try {
    // console.log("payment request body", req.body);
    const amount = req.body.amount;
    const reference = req.body.reference;
    const paymentMethod = req.body.paymentData.paymentMethod;
    const riskData = req.body.paymentData.riskData;

    // Create the request object(s)
    const paymentRequest = {
      amount,
      reference,
      paymentMethod,
      riskData,
      returnUrl: "https://207a399b-3262-4a38-908f-787ffe2ae23d-00-1ry6k6zlua0j2.picard.replit.dev/checkout",
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
    };

    // console.log('request body:', paymentRequest);
    const response = await checkout.PaymentsApi.payments(paymentRequest, {
      idempotencyKey: uuid(),
    });

    res.json(response);
  } catch (err) {
    console.error(
      `Error: ${err.message}, error code: ${err.errorCode}, stack: ${err.stack}`,
    );
    res
      .status(err.statusCode || 500)
      .json({ error: "An error occurred during payment processing" });
  }
});

// Webhook
app.post("/api/webhooks/notifications", async (req, res) => {
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator();
  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest.notificationItems;
  const notification = notificationRequestItems[0].NotificationRequestItem;

  if (validator.validateHMAC(notification, hmacKey)) {
    const merchantReference = notification.merchantReference;
    const eventCode = notification.eventCode;
    console.log(
      "merchantReference:" + merchantReference + " eventCode:" + eventCode,
    );

    // Consume event asynchronously
    consumeEvent(notification);

    res.status(202).send();
  } else {
    console.log("Invalid HMAC signature: " + notification);
    res.status(401).send("Invalid HMAC signature");
  }
});

// possible todo: implement event consumption logic
function consumeEvent(notification) {
  // Implement event consumption logic here
  console.log("conusmeEvent", notification);
}

// Serve the index.html file for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Server the checkout.html file
app.get("/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "checkout.html"));
});

// Serve the clientKey to the client
app.get("/api/getClientKey", (req, res) => {
  res.json({ clientKey: process.env.ADYEN_CLIENT_KEY });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
