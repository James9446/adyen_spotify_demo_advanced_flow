const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const { uuid } = require('uuidv4');
const { hmacValidator } = require('@adyen/api-library');
const { Client, Config, CheckoutAPI } = require("@adyen/api-library");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Adyen NodeJS library configuration
const config = new Config();
config.apiKey = process.env.ADYEN_API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST");  // change to LIVE for production
const checkout = new CheckoutAPI(client);

// API Endpoints
app.post("/api/sessions", async (req, res) => {
  try {
    const orderRef = uuid();
    const address = req.get('host'); // testing on localhost:3000
    const protocol = req.socket.encrypted ? 'https' : 'http';
    const amount = {
      currency: req.body.amount.currency,
      value: req.body.amount.value
    };
    const countryCode = req.body.countryCode;
    const lineItems = req.body.lineItems;

    const response = await checkout.PaymentsApi.sessions({
      amount,
      countryCode,
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
      reference: orderRef,
      returnUrl: `${protocol}://${address}/checkout?orderRef=${orderRef}`,
      lineItems,
    });

    // return the session to the client i.e. return the CreateCheckoutSessionResponse object
    res.json(response);
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}, stack: ${err.stack}`);
    res.status(err.statusCode || 500).json({ error: 'An error occurred during payment processing' });
  }
});

// Webhook
app.post("/api/webhooks/notifications", async (req, res) => {
  const hmacKey = process.env.ADYEN_HMAC_KEY;
  const validator = new hmacValidator();
  const notificationRequest = req.body;
  const notificationRequestItems = notificationRequest.notificationItems
  const notification = notificationRequestItems[0].NotificationRequestItem
  
  if (validator.validateHMAC(notification, hmacKey)) {
    const merchantReference = notification.merchantReference;
    const eventCode = notification.eventCode;
    console.log("merchantReference:" + merchantReference + " eventCode:" + eventCode);
    
    // Consume event asynchronously
    consumeEvent(notification);
    
    res.status(202).send();
  } else {
    console.log("Invalid HMAC signature: " + notification);
    res.status(401).send('Invalid HMAC signature');
  }
});

// possible todo: implement event consumption logic
function consumeEvent(notification) {
  // Implement event consumption logic here
}

// Serve the index.html file for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Server the checkout.html file 
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'checkout.html'));
});

// Serve the clientKey to the client
app.get('/api/getClientKey', (req, res) => {
  res.json({ clientKey: process.env.ADYEN_CLIENT_KEY });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});