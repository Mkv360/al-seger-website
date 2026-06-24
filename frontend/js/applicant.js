document.getElementById("openApplicantModal").addEventListener("click", () => {
  document.getElementById("applicantModal").style.display = "flex";
});

document.querySelector(".cancel-btn").addEventListener("click", () => {
  document.getElementById("applicantModal").style.display = "none";
});
document.addEventListener("DOMContentLoaded", () => {
  loadApplicants();

  const openBtn = document.getElementById("openApplicantModal");
  const modal = document.getElementById("applicantModal");
  const cancelBtn = document.querySelector(".cancel-btn");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });
  }

  if (cancelBtn && modal) {
    cancelBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
});

async function loadApplicants() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:5000/api/applicants", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data.message || "Request failed");
      return;
    }

    const applicants = data?.data?.data || [];

    const tbody = document.getElementById("applicantsTableBody");

    if (!tbody) {
      console.error("Missing <tbody id='applicantsTableBody'> in HTML");
      return;
    }

    tbody.innerHTML = "";

    applicants.forEach((a) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>#${a.id}</td>
        <td>${a.first_name || ""} ${a.last_name || ""}</td>
        <td>${a.phone || "-"}</td>
        <td>${a.destination_country || "-"}</td>
        <td>
          <span class="${a.status || ""}">
            ${a.status || "-"}
          </span>
        </td>
        <td>
          <a href="applicant-view.html?id=${a.id}" class="action-btn view-btn">
  View
</a>
        </td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("Failed to load applicants:", err);
  }
}