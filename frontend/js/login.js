// ===============================
// LOGIN MODAL
// ===============================

const loginBtn = document.getElementById("loginBtn");
const loginModal = document.getElementById("loginModal");

const registerBtn = document.getElementById("registerBtn");
const registerModal = document.getElementById("registerModal");

const switchToRegister = document.getElementById("switchToRegister");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

// Open Login Modal

loginBtn.addEventListener("click", () => {
    loginModal.classList.add("show");
});

// Close Modals

document.querySelectorAll(".close-modal").forEach(btn => {

  btn.addEventListener("click", () => {

    document
      .querySelectorAll(".modal")
      .forEach(m => m.classList.remove("show"));

    closeMobileEffects();

  });

});
// Switch Login → Register

switchToRegister.addEventListener("click", (e) => {

    e.preventDefault();

    loginModal.classList.remove("show");
    registerModal.classList.add("show");

});

// Close When Clicking Outside

window.addEventListener("click", (e) => {

    if (e.target === loginModal) {
        loginModal.classList.remove("show");
    }

});

// ===============================
// PASSWORD TOGGLE
// ===============================

document.querySelectorAll(".toggle-password").forEach(icon => {

    icon.addEventListener("click", () => {

        const input =
        icon.previousElementSibling;

        if(input.type === "password"){

            input.type = "text";
            icon.classList.replace("fa-eye","fa-eye-slash");

        }else{

            input.type = "password";
            icon.classList.replace("fa-eye-slash","fa-eye");

        }

    });

});

// ===============================
// LOGIN FORM
// ===============================

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    loginError.textContent = "";

    const identifier =
    document.getElementById("loginIdentifier").value.trim();

    const password =
    document.getElementById("loginPassword").value;

    if(!identifier || !password){

        loginError.textContent =
        "Please fill all fields.";

        return;

    }

    try{

        const response = await fetch(
            "http://localhost:5000/api/users/login",
            {
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
              body: JSON.stringify({
    phone_or_email: identifier,
    password
})
            }
        );

        const data = await response.json();

        if(!response.ok){

            loginError.textContent =
            data.message || "Invalid login.";

            return;

        }

        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        window.location.href =
        "home.html";

    }

    catch(error){

        loginError.textContent =
        "Server connection failed.";

        console.error(error);

    }

});
const mobileLoginBtn =
document.getElementById("mobileLoginBtn");

if (mobileLoginBtn) {

  mobileLoginBtn.addEventListener("click", () => {

    document
      .querySelector(".mobile-menu")
      .classList.remove("active");

    loginModal.classList.add("show");

  });

}
