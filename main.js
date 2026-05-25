// ==========================
// ACTIVE NAV LINK
// ==========================

const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-links a");

window.addEventListener("scroll", () => {

  let current = "";

  sections.forEach(section => {

    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;

    if (pageYOffset >= sectionTop - 200) {

      current = section.getAttribute("id");

    }

  });

  navLinks.forEach(link => {

    link.classList.remove("active");

    if (link.getAttribute("href") === `#${current}`) {

      link.classList.add("active");

    }

  });

});
// ==========================
// MOBILE MENU TOGGLE
// ==========================

const menuBtn = document.querySelector(".menu-btn");
const mobileMenu = document.querySelector(".mobile-menu");

menuBtn.addEventListener("click", () => {

  mobileMenu.classList.toggle("active");

});


// ==========================
// CLOSE MENU WHEN CLICK LINK
// ==========================

const mobileLinks =
  document.querySelectorAll(".mobile-menu a");

mobileLinks.forEach(link => {

  link.addEventListener("click", () => {

    mobileMenu.classList.remove("active");

  });

});
