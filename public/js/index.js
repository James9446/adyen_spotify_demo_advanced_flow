
async function setUserDropdownSelection() {    
    const user = await getFile('current-user.json');
    const userName = user.shopperName.firstName.toLowerCase();
    const isRandomUser = ["luigi", "mario", "homer"].includes(userName) ? false : true; 
    let element = document.getElementById('users-dropdown');
    element.value = isRandomUser ? 'random' : userName;
}

// set the drop to display the current user
setUserDropdownSelection();

// set the profile pic
setProfilePic();


async function login(e) {
    
    const selection = document.getElementById('users-dropdown').value;

    // identify user based on dropdown selection
    let user;
    if (selection === 'random') {
        // generate one-time use random user
        user = generateRandomUser();
    } else {
        // get users from users db
        const users = await getFile('users-db.json');
        user = users[selection];
    };

    // console.log user data instead of switching to that user
    if (e?.shiftKey) {
        return console.log(JSON.stringify(user, null, ' '));
    };

    try {
        // update the current user JSON file 
        await saveFile(user, 'server/pseudo-db/current-user.json');
        // console.log('LOGIN saveData response: ', response.ok, response)


        // save function needs to complete before profile pic can be set
        setTimeout(() => {
            setProfilePic();
        },1000);
    } catch (error) {
        console.error('Error during login:', error);
    }
}

document.getElementById("login-btn").addEventListener("click", login);

function generateRandomUser() {
    const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    return {
      shopperReference: uuid(),
      shopperEmail: `user${Math.floor(Math.random() * 1000)}@example.com`,
      telephoneNumber: `+1 ${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 10000)}`,
      shopperName: {
        firstName: ['Alice', 'Bob', 'Charlie', 'Diana'][Math.floor(Math.random() * 4)],
        gender: ['Male', 'Female', 'Other'][Math.floor(Math.random() * 3)],
        lastName: ['Smith', 'Johnson', 'Williams', 'Brown'][Math.floor(Math.random() * 4)]
      },
      billingAddress: {
        city: ['New York', 'Los Angeles', 'Chicago', 'Houston'][Math.floor(Math.random() * 4)],
        stateOrProvince: ['NY', 'CA', 'IL', 'TX'][Math.floor(Math.random() * 4)],
        country: 'US',
        houseNumberOrName: Math.floor(Math.random() * 1000).toString(),
        postalCode: Math.floor(10000 + Math.random() * 90000).toString(),
        street: `${Math.floor(Math.random() * 1000)} Main St`
      }
    };
  }


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
