// ===============================
// REGISTER MODAL
// ===============================

const registerBtn2 =
document.getElementById("registerBtn");

const registerModal2 =
document.getElementById("registerModal");

const loginModal2 =
document.getElementById("loginModal");

const switchToLogin =
document.getElementById("switchToLogin");

const registerForm =
document.getElementById("registerForm");

const registerError =
document.getElementById("registerError");

const passwordStrength =
document.getElementById("passwordStrength");

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

// Close Outside

window.addEventListener("click", (e) => {

    if(e.target === registerModal2){

        registerModal2.classList.remove("show");

    }

});

// ===============================
// ETHIOPIAN PHONE VALIDATION
// ===============================

function isValidEthiopianPhone(phone){

    const regex =
    /^(09\d{8}|07\d{8}|\+2519\d{8}|\+2517\d{8})$/;

    return regex.test(phone);

}

// ===============================
// EMAIL VALIDATION
// ===============================

function isEmail(value){

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

}

// ===============================
// PASSWORD STRENGTH
// ===============================

document
.getElementById("password")
.addEventListener("input", function(){

    const password = this.value;

    let score = 0;

    if(password.length >= 8) score++;
    if(/[A-Z]/.test(password)) score++;
    if(/[a-z]/.test(password)) score++;
    if(/[0-9]/.test(password)) score++;
    if(/[!@#$%^&*]/.test(password)) score++;

    if(score <= 2){

        passwordStrength.textContent =
        "Weak Password";

    }
    else if(score <= 4){

        passwordStrength.textContent =
        "Medium Password";

    }
    else{

        passwordStrength.textContent =
        "Strong Password";

    }

});

// ===============================
// REGISTER
// ===============================

registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    registerError.textContent = "";

    const fullName =
    document.getElementById("fullName").value.trim();

    const phoneOrEmail =
    document.getElementById("phoneOrEmail").value.trim();

    const gender =
    document.getElementById("gender").value;

    const password =
    document.getElementById("password").value;

    const confirmPassword =
    document.getElementById("confirmPassword").value;

    // Name Validation

    const nameRegex =
    /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/;

    if(!nameRegex.test(fullName)){

        registerError.textContent =
        "Use Camel Case. Example: Hamza Mohammed";

        return;

    }

    // Email or Phone Validation

    const validPhone =
    isValidEthiopianPhone(phoneOrEmail);

    const validEmail =
    isEmail(phoneOrEmail);

    if(!validPhone && !validEmail){

        registerError.textContent =
        "Enter valid Ethiopian phone or email.";

        return;

    }

    if(password !== confirmPassword){

        registerError.textContent =
        "Passwords do not match.";

        return;

    }

    try{

        const response = await fetch(
            "http://localhost:5000/api/auth/register",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    fullName,
                    phoneOrEmail,
                    gender,
                    password
                })
            }
        );

        const data =
        await response.json();

        if(!response.ok){

            registerError.textContent =
            data.message ||
            "Registration failed.";

            return;

        }

        sessionStorage.setItem(
            "welcomeUser",
            fullName
        );

        alert("Registration successful!");

        window.location.href =
        "home.html";

    }

    catch(error){

        registerError.textContent =
        "Server connection failed.";

        console.error(error);

    }

});
const mobileRegisterBtn =
  document.getElementById("mobileRegisterBtn");

if (mobileRegisterBtn) {

  mobileRegisterBtn.addEventListener("click", () => {

    document
      .querySelector(".mobile-menu")
      .classList.remove("active");

    registerModal2.classList.add("show");

  });

}