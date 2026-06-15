const themeToggle =
  document.getElementById("themeToggle");

const mobileThemeToggle =
  document.getElementById("mobileThemeToggle");

// Update both icons
function updateThemeIcons(isLight) {

  const icon = isLight
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';

  if (themeToggle) {
    themeToggle.innerHTML = icon;
  }

  if (mobileThemeToggle) {
    mobileThemeToggle.innerHTML = icon;
  }
}

// Load saved theme
const savedTheme =
  localStorage.getItem("theme");

if (savedTheme === "light") {

  document.body.classList.add("light-mode");

  updateThemeIcons(true);

} else {

  updateThemeIcons(false);

}

// Toggle theme function
function toggleTheme() {

  document.body.classList.toggle("light-mode");

  const isLight =
    document.body.classList.contains("light-mode");

  localStorage.setItem(
    "theme",
    isLight ? "light" : "dark"
  );

  updateThemeIcons(isLight);

}

// Desktop button
if (themeToggle) {

  themeToggle.addEventListener(
    "click",
    toggleTheme
  );

}

// Mobile button
if (mobileThemeToggle) {

  mobileThemeToggle.addEventListener(
    "click",
    toggleTheme
  );

}