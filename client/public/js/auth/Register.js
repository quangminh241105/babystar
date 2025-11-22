const passwordDiv = document.getElementById("password-error");
const passwordDiv2 = document.getElementById("password2-error");
const submitBtn = document.getElementById("submitBtn");
const passwordField = document.getElementById("password");
const passwordField2 = document.getElementById("password2");

// Password and confirmation password format validation
submitBtn.addEventListener("click", event => {
    if (passwordField.value.length < 12) {
        passwordDiv.textContent = "Password must be atleast 12 characters long";
        event.preventDefault();
    }
    else if (!/[A-Z]/.test(passwordField.value)) {
        passwordDiv.textContent = "Password must contain at least one uppercase letter";
        event.preventDefault();
    }
    else if (!/[a-z]/.test(passwordField.value)) {
        passwordDiv.textContent = "Password must contain at least one lowercase letter";
        event.preventDefault();
    }
    else if (!/[0-9]/.test(passwordField.value)) {
        passwordDiv.textContent = "Password must contain at least one number";
        event.preventDefault();
    }

    if (passwordField2.value !== passwordField.value) {
        passwordDiv2.textContent = "Please enter a matching password";
        event.preventDefault();
    }
})

// Reset error message when user input text
passwordField.addEventListener("keydown", event => {
    passwordDiv.textContent = "";
})

passwordField2.addEventListener("keydown", event => {
    passwordDiv2.textContent = "";
})