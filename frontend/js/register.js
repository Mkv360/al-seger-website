// ===============================
// DOM ELEMENTS
// ===============================

const registerBtn2 = document.getElementById("registerBtn");
const registerModal2 = document.getElementById("registerModal");
const loginModal2 = document.getElementById("loginModal");
const switchToLogin = document.getElementById("switchToLogin");
const registerForm = document.getElementById("registerForm");
const registerError = document.getElementById("registerError");
const passwordStrength = document.getElementById("passwordStrength");
const mobileRegisterBtn = document.getElementById("mobileRegisterBtn");

const fullNameInput = document.getElementById("fullName");
const phoneOrEmailInput = document.getElementById("phoneOrEmail");
const genderInput = document.getElementById("gender");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

// ===============================
// HELPER FUNCTIONS
// ===============================

function isValidEthiopianPhone(phone) {

    const regex = /^(09\d{8}|07\d{8}|\+2519\d{8}|\+2517\d{8})$/;

    return regex.test(phone);

}

function isEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

}

function toTitleCase(name) {

    return name
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ");

}

// Live per-keystroke formatting while typing (preserves spacing as typed,
// unlike toTitleCase which collapses double spaces on blur)
function liveCapitalize(value) {

    return value
        .split(" ")
        .map(word => {

            if (!word) return "";

            return word.charAt(0).toUpperCase() +
                   word.slice(1).toLowerCase();

        })
        .join(" ");

}

function getPasswordStrengthLabel(password) {

    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;

    if (score <= 2) return "Weak Password";
    if (score <= 4) return "Medium Password";
    return "Strong Password";

}

// ===============================
// SUBMIT HANDLER
// ===============================

async function handleRegisterSubmit(e) {

    e.preventDefault();

    registerError.textContent = "";

    const fullName = toTitleCase(fullNameInput.value.trim());
    const phoneOrEmail = phoneOrEmailInput.value.trim();
    const gender = genderInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Name Validation
    const nameRegex = /^[A-Za-z]+(?:\s+[A-Za-z]+)+$/;

    if (!nameRegex.test(fullName)) {
        registerError.textContent = "Enter your full name. Example: Hamza Mohammed";
        return;
    }

    // Email or Phone Validation
    const validPhone = isValidEthiopianPhone(phoneOrEmail);
    const validEmail = isEmail(phoneOrEmail);

    if (!validPhone && !validEmail) {
        registerError.textContent = "Enter valid Ethiopian phone or email.";
        return;
    }

    if (password !== confirmPassword) {
        registerError.textContent = "Passwords do not match.";
        return;
    }

    try {

        const response = await fetch(
            "http://localhost:5000/api/users/register",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    full_name: fullName,
                    phone_or_email: phoneOrEmail,
                    gender,
                    password
                })
            }
        );

        const data = await response.json();
        console.log("REGISTER RESPONSE:", data);

        if (!response.ok) {
            registerError.textContent = data.message || "Registration failed.";
            return;
        }

        sessionStorage.setItem("welcomeUser", fullName);
        alert("Registration successful!");

        localStorage.setItem("token", data.data.token);
        localStorage.setItem("user", JSON.stringify(data.data.user));

        window.location.href = "home.html";

    } catch (error) {

        registerError.textContent = "Server connection failed.";
        console.error(error);

    }

}

// ===============================
// EVENT LISTENERS (registered once)
// ===============================

// Open Register Modal
registerBtn2.addEventListener("click", () => {
    registerModal2.classList.add("show");
});

// Switch Register → Login
switchToLogin.addEventListener("click", (e) => {
    e.preventDefault();
    registerModal2.classList.remove("show");
    loginModal2.classList.add("show");
});

// Close Modal on Outside Click
window.addEventListener("click", (e) => {
    if (e.target === registerModal2) {
        registerModal2.classList.remove("show");
    }
});

// Full Name Auto-Formatting
fullNameInput.addEventListener("blur", () => {
    fullNameInput.value = toTitleCase(fullNameInput.value);
});

fullNameInput.addEventListener("input", () => {
    fullNameInput.value = liveCapitalize(fullNameInput.value);
});

// Password Strength Meter
passwordInput.addEventListener("input", () => {
    passwordStrength.textContent = getPasswordStrengthLabel(passwordInput.value);
});

// Mobile Register Button
if (mobileRegisterBtn) {
    mobileRegisterBtn.addEventListener("click", () => {
        document.querySelector(".mobile-menu").classList.remove("active");
        registerModal2.classList.add("show");
    });
}

// Form Submission
registerForm.addEventListener("submit", handleRegisterSubmit);