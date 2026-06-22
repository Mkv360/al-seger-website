document.getElementById("openApplicantModal").addEventListener("click", () => {
  document.getElementById("applicantModal").style.display = "flex";
});

document.querySelector(".cancel-btn").addEventListener("click", () => {
  document.getElementById("applicantModal").style.display = "none";
});