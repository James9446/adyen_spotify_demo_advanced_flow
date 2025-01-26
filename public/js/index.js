
// USE PERSISTENT DATA ON PAGE LOAD 

// set the drop to display the current user
setUserDropdownSelection();
// set the modal dropdown to display the current region configuration
setModalSelections();
// set the profile pic
setProfilePic();



// USER SELECTION
async function setUserDropdownSelection() {    
    const user = await getFile('current-user.json');
    const userName = user.shopperName.firstName.toLowerCase();
    const isRandomUser = ['luigi', 'mario', 'homer'].includes(userName) ? false : true; 
    let element = document.getElementById('users-dropdown');
    element.value = isRandomUser ? 'random' : userName;
}

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
        return console.log(JSON.stringify(user, null, 2));
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

document.getElementById('login-btn').addEventListener('click', login);

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



// REGION CONFIGURATION MODAL
async function setModalSelections() {    
    const selections = await getFile('region-config.json');
    for (const selection in selections) {
        // console.log(`${selection}: ${selections[selection]}`);
        document.getElementById(`${selection}-selection`).value = selections[selection]
    };
}

// called profile pic is clicked 
async function openModal(e) {
    if (e?.shiftKey) {
        const user = await getFile('current-user.json');
        return console.log(JSON.stringify(user, null, 2));
    };
    toggleModal()
}

// two ways to close the modal when not saving
function closeModal(e) {
    const clickIsOutside = !e.target.closest('.modal-content');
    const closeButton = document.getElementById("close-modal");
    if (clickIsOutside || e.target === closeButton) {
      toggleModal();
    };
}

function toggleModal() {
    const modal = document.getElementById('modal');
    const isOpen = modal.style.display === 'flex';
    if (isOpen) {
        modal.style.display = 'none' 
        // when the modal is closed the dropdowns should be set to reflect the persistent region config data
        setTimeout(() => {
            setModalSelections();
        }, 1000)
    } else { 
        modal.style.display = 'flex'; 
    };
}



async function saveRegionConfig(e) {
    const selections = {
        currency: document.getElementById('currency-selection').value,
        country: document.getElementById('country-selection').value,
        locale: document.getElementById('locale-selection').value
    };
    try {
        await saveFile(selections, 'server/pseudo-db/region-config.json');
        toggleModal();
    } catch (error) {
        console.error('Error saving the region config:', error);
    }
}

document.getElementById('profile-picture').addEventListener('click', openModal);
document.getElementById('modal').addEventListener('click', closeModal);
document.getElementById('modal-save-btn').addEventListener('click', saveRegionConfig);





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
