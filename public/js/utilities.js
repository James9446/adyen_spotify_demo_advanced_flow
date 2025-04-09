//  ----- SERVER DATA FUNCTIONS -----
async function getFile(file) {
    try {
        const response = await fetch('/api/getFile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({file})
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('Data retrieved successfully: ', data);
        return data;
    } catch (error) {
        console.error('Error fetching data:', error.message);
        throw error;
    }
}
  

async function saveFile(data, path) {
    // console.log('Attempting to save data:', data);
    try {
      const response = await fetch('/api/saveFile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({data, path})
      });
  
    //   console.log('saveData response status:', response.status);
    //   console.log('save Data response:', response);
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
        return response.json();
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

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


//  ----- UPDATE UI FUNCTIONS -----

async function setProfilePic() {
    try {
        const user = await getFile('current-user.json');
        const userName = user.shopperName.firstName.toLowerCase();
        const isRandomUser = ["luigi", "mario", "homer"].includes(userName) ? false : true; 
        const newSrc = isRandomUser ? `./images/generic.png` : `./images/${userName}.png`
        document.getElementById('profile-picture').src = newSrc;
    }  catch (error) {
        console.error('Error:', error.message);
        throw error;
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

//  ----- HELPER FUNCTIONS -----

// This allows the you to console.log things with a colored label 
// Example usage:
// colorLog("This is log");                                       // (defaults to light green)
// colorLog("Message with data: ", { someData: 123 });              // (defaults to light green)
// colorLog("Info message!", null, 'yellow');                 // (nice way to distinguish logs that are only a single string)
// colorLog("There was an error: ", { someData: 123 }, 'orange');

const colorLog = (message, data, color = '#90EE90') => {
    // explicitly check for null rather than use a truthy value. That way falsy values (other than null) can still be logged 
    if (data !== null) {
        console.log(`%c${message}`, `color: ${color}`, data);
    } else {
        console.log(`%c${message}`, `color: ${color}`);
    }
};

function generateUUID() {
    // Check if crypto.randomUUID is available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    } else {
      // Fallback for older environments (see method 2)
      console.warn("crypto.randomUUID() not supported, using fallback function to generate UUID.");
      return generateUUIDFallback();
    }
  }
  
  // --- Fallback function (Method 2, see below) ---
  function generateUUIDFallback() {
    // Implementation using crypto.getRandomValues()
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
  
    // Set version bits (to 4)
    buffer[6] = (buffer[6] & 0x0f) | 0x40; // M: version 4
  
    // Set variant bits (to RFC4122)
    buffer[8] = (buffer[8] & 0x3f) | 0x80; // N: variant 10xx
  
    // Convert bytes to hex string and format
    const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, '0'));
  
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join('')
    ].join('-');
  }