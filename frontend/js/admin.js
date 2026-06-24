
// ==========================
// FILTER BUTTONS
// ==========================

document.addEventListener("DOMContentLoaded", () => {

  const filters =
  document.querySelectorAll(".filter");

  filters.forEach(filter => {

    filter.addEventListener("click", () => {

      filters.forEach(btn => {
        btn.classList.remove("active-filter");
      });

      filter.classList.add("active-filter");

    });

  });

});

const mobileBtn =
document.querySelector(".mobile-menu-btn");

const sidebar =
document.querySelector(".sidebar");

if(mobileBtn && sidebar){

  mobileBtn.addEventListener("click", ()=>{

    sidebar.classList.toggle("active");

  });

}
const openModal =
document.getElementById("openApplicantModal");

const closeModal =
document.getElementById("closeApplicantModal");

const modal =
document.getElementById("applicantModal");

if(openModal && modal){

  openModal.addEventListener("click", ()=>{

    modal.classList.add("active");

  });

}

if(closeModal && modal){

  closeModal.addEventListener("click", ()=>{

    modal.classList.remove("active");

  });

}

window.addEventListener("click",(e)=>{

  if(e.target === modal){

    modal.classList.remove("active");

  }

});
const toggle = document.getElementById("countriesToggle");

if (toggle) {
  const parent = toggle.closest(".has-submenu");
  const menu = document.getElementById("countriesMenu");

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    parent.classList.toggle("open");
  });
}
const cancelBtn = document.querySelector(".cancel-btn");

if (modal && cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("messagesTable");

  if (!table) return;

  const messages = JSON.parse(localStorage.getItem("messages")) || [];

  // update counters (optional)
  const total = document.getElementById("totalMessages");
  const newMsg = document.getElementById("newMessages");

  if (total) total.textContent = messages.length;
  if (newMsg) newMsg.textContent = messages.length;

  if (messages.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="6">No messages found</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = messages.map((msg, index) => `
    <tr>
      <td>${msg.name || ""}</td>
      <td>${msg.phone || ""}</td>
      <td>${msg.country || "-"}</td>
      <td>${msg.message || ""}</td>
      <td>${msg.time ? new Date(msg.time).toLocaleString() : "-"}</td>
      <td>
        <button onclick="deleteMessage(${index})">Delete</button>
      </td>
    </tr>
  `).join("");
});
const profile = document.getElementById("adminProfile");
const dropdown = document.getElementById("profileDropdown");

profile.addEventListener("click", () => {
  dropdown.classList.toggle("active");
});

// close when clicking outside
document.addEventListener("click", (e) => {
  if (!profile.contains(e.target)) {
    dropdown.classList.remove("active");
  }
});
const admin = {
  name: "Administrator",
  role: "Super Admin",
  avatar: null // or URL
};

const adminAvatar = document.getElementById("adminAvatar");
const ddAvatar = document.getElementById("ddAvatar");

const avatarFallback = document.getElementById("avatarFallback");
const ddFallback = document.getElementById("ddFallback");

function setAvatar(imgUrl) {
  const hasImage = imgUrl && imgUrl.trim() !== "";

  if (hasImage) {
    adminAvatar.src = imgUrl;
    ddAvatar.src = imgUrl;

    adminAvatar.style.display = "block";
    ddAvatar.style.display = "block";

    avatarFallback.style.display = "none";
    ddFallback.style.display = "none";
  } else {
    adminAvatar.style.display = "none";
    ddAvatar.style.display = "none";

    avatarFallback.style.display = "flex";
    ddFallback.style.display = "flex";
  }
}
const bell = document.getElementById("notifBell");
const panel = document.getElementById("notifPanel");

bell.addEventListener("click", () => {
  panel.classList.toggle("active");
});