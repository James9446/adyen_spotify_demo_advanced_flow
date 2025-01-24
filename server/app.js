const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const morgan = require("morgan");
const fs = require('fs').promises;
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
    const shopperReference = req.body.shopperReference;

    const paymentMethodRequest = {
      amount,
      countryCode,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      shopperLocale,
      channel,
      lineItems,
      shopperReference
    };
    console.log("request body:", paymentMethodRequest);
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
    const gitpodURL = req.body.gitpodURL;

    let paymentRequest = {
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      returnUrl: `${gitpodURL}/checkout`,
      lineItems: [ {
        quantity: "1",
        taxPercentage: "2100",
        description: "Shoes",
        id: "Item #1",
        amountIncludingTax: "400",
        productUrl: "URL_TO_PURCHASED_ITEM",
        imageUrl: "URL_TO_PICTURE_OF_PURCHASED_ITEM"
      }, {
        quantity: "2",
        taxPercentage: "2100",
        description: "Socks",
        id: "Item #2",
        amountIncludingTax: "300",
        productUrl: "URL_TO_PURCHASED_ITEM",
        imageUrl: "URL_TO_PICTURE_OF_PURCHASED_ITEM"
      } ]
    }

    paymentRequest = Object.assign(paymentRequest, req.body)

    console.log("payment request object", paymentRequest);

    const response = await checkout.PaymentsApi.payments(paymentRequest, {
      idempotencyKey: uuid(),
    });
    console.log('Payment response: ', response);
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




// Payment Details
app.post("/api/payments/details", async (req, res) => {
  console.log("/payment/details start");
  
  try {
    const redirectResult = req.body.redirectResult;
    console.log("redirectResult: ", redirectResult);
    const response = await checkout.PaymentsApi.paymentsDetails(
      {
        "details": {
          "redirectResult": redirectResult
        }
      },
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

// Server the checkout.html file
app.get("/thank-you", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "thank-you.html"));
});

// Serve the clientKey to the client
app.get("/api/getClientKey", (req, res) => {
  const clientKey = process.env.ADYEN_CLIENT_KEY
  res.json(clientKey);
});

// PSEUDO DB - SIMPLE JSON FILES

app.post('/api/getFile', async (req, res) => {
  const filePath = `server/pseudo-db/${req.body.file}`;
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    console.log('jsonData: ', jsonData);
    res.json(jsonData);
  } catch (err) {
    console.error(err);
    if (err.code === 'ENOENT') {
      return res.status(404).send('File not found');
    }
    res.status(500).send('Error reading file');
  }
});


app.post('/api/saveFile', async (req, res) => {
  // const { data, path: filePath } = req.body;

  const data = req.body.data;
  const filePath = req.body.path;

  if (!data || !filePath) {
    return res.status(400).json({ error: 'Missing data or file path' });
  }

  // const fullPath = path.resolve(filePath);

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved successfully to ${filePath}`);
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (err) {
    console.error('Error writing to file:', err);
    res.status(500).json({ error: 'Error writing to file', details: err.message });
  }
});


// app.post('/api/saveFile', async (req, res) => {
//   // console.log('Received request to /api/saveFile');
//   // console.log('saveFile request body:', req.body);

//   const data = req.body.data;
//   const filePath = req.body.path;

//   try {
//     await fs.writeFile(filePath, JSON.stringify(data));
//     console.log('Data saved successfully');
//     res.status(200).json({ message: 'Data saved successfully' });
//   } catch (err) {
//     console.error('Error writing to file:', err);
//     res.status(500).json({ error: 'Error writing to file' });
//   }
// });


// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
