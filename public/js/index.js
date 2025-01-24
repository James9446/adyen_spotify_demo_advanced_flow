// async function saveData(data) {
//     try {
//       const response = await fetch('/api/saveData', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(data)
//       });
  
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
  
//       const result = await response.text();
//       console.log(result); // Log the server's response
//     } catch (error) {
//       console.error('Error:', error.message);
//     }
// }

async function saveData(data, path) {
  console.log('Attempting to save data:', data);
  try {
    const response = await fetch('/api/saveData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({data, path})
    });

    console.log('saveData response status:', response.status);
    console.log('save Data response:', response);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Data saved successfully');
  } catch (error) {
    console.error('Error:', error.message);
  }
}


function login(e) {
    // identify user based on dropdown selection
    let user = users[document.getElementById("users-dropdown").value];
    if (e?.shiftKey) {
      return console.log(JSON.stringify(user, null, ' '));
    };
    saveData(user, 'server/pseudo-db/users-db.json');
}

document.getElementById("login-btn").addEventListener("click", login);



// // Mock player functionality
let isPlaying = false;

function togglePlay() {
    const playButton = document.getElementById('play-button');
    isPlaying = !isPlaying;
    playButton.textContent = isPlaying ? '⏸' : '▶️';
}

function updateProgressBar() {
    const progressBar = document.querySelector('.progress-bar');
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 100) {
            clearInterval(interval);
        } else {
            width++;
            progressBar.style.width = width + '%';
        }
    }, 1000);
}

// Event listeners
// document.addEventListener('DOMContentLoaded', () => {
//     // const premiumButton = document.getElementById('premium-btn');
//     // premiumButton.addEventListener('click', initializeDropin);
    
//     const playButton = document.getElementById('play-button');
//     playButton.addEventListener('click', () => {
//         togglePlay();
//         if (isPlaying) {
//             updateProgressBar();
//         }
//     });

//     // Check if we need to start or finalize the checkout
//     if (!sessionId) {
//         // No session ID, so we're starting a new checkout
//         // We don't auto-start the checkout here, it will be triggered by the premium button
//     } else {
//         // Existing session: complete Checkout
//         finalizeCheckout();
//     }
// });