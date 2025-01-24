
async function setUserDropdownSelection() {    
    const user = await getFile('current-user.json');
    const userName = user.shopperName.firstName.toLowerCase();
    let element = document.getElementById('users-dropdown');
    element.value = userName;
}

// set the drop to display the current user
setUserDropdownSelection();

// set the profile pic
setProfilePic();


async function login(e) {
    // get users from users db
    const users = await getFile('users-db.json');

    // identify user based on dropdown selection
    const user = users[document.getElementById("users-dropdown").value];

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
