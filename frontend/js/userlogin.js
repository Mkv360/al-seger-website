const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone_or_email = document.getElementById("phoneOrEmail").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("http://localhost:5000/api/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone_or_email,
        password
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Login failed");
      return;
    }

    // 🔥 SAVE TOKEN (THIS IS WHAT YOU WERE MISSING)
    localStorage.setItem("token", data.data.token);

    // redirect to home page
    window.location.href = "home.html";

  } catch (err) {
    console.log(err);
    alert("Server error");
  }
});