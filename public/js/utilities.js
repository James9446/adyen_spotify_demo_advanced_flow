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