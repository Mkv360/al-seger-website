'use strict';

// ===============================
// CONFIG
// ===============================
const API_BASE = "http://localhost:5000/api/online-applications";


let selectedApproveId = null;

/**
 * OPEN MODAL
 */
window.openApproveForm = function (id) {
  if (!id) {
    console.error("Missing application ID");
    return;
  }

  selectedApproveId = id;

  const modal = document.getElementById("approveModal");
  if (!modal) {
    console.error("approveModal not found in DOM");
    return;
  }

  modal.style.display = "flex";
modal.classList.add("show");
  console.log("Selected ID:", selectedApproveId);
};

/**
 * CLOSE MODAL
 */
window.closeApproveModal = function () {
  const modal = document.getElementById("approveModal");

  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("show");
  }

  selectedApproveId = null;
};

/**
 * SAFETY RESET ON PAGE LOAD
 * prevents modal reopening after refresh
 */
window.addEventListener("load", () => {
  selectedApproveId = null;

  const modal = document.getElementById("approveModal");
  if (modal) {
    modal.style.display = "none";
  }
});
// ===============================
// DOM ELEMENTS
// ===============================
const tableBody = document.getElementById("applicationsTableBody");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");

/// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", loadApplications);


// ===============================
// LOAD APPLICATIONS
// ===============================
async function loadApplications() {
  try {
    showLoading(true);

    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.type !== 'admin') {
      localStorage.removeItem("token");
      window.location.href = "./login.html";
      return;
    }

    const res = await fetch(API_BASE, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    renderTable(data.data);

  } catch (err) {
    console.error("Load error:", err);
  } finally {
    showLoading(false);
  }
}

function renderTable(applications) {
  
  tableBody.innerHTML = "";

  if (!applications || applications.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }
  if (emptyState) emptyState.style.display = "none";

  // ── log first record to confirm exact field names from your DB ──
  if (applications.length > 0) console.log("Fields:", applications[0]);

  applications.forEach(app => {
    // handle both full_name and first_name + last_name patterns
    const name = app.full_name
      || (app.first_name ? `${app.first_name} ${app.last_name || ''}`.trim() : '-');

    // handle both phone_or_email and phone patterns  
    const contact = app.phone_or_email || app.phone || app.email || '-';

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${name}</td>
      <td>${contact}</td>
      <td><span class="status ${app.status || ''}">${app.status || '-'}</span></td>
      <td>${formatDate(app.created_at)}</td>
      <td>
        <button onclick="openApproveForm(${app.id})" class="btn-approve">Approve</button>
        <button onclick="rejectApp(${app.id})" class="btn-reject">Reject</button>
        <button onclick="deleteApp(${app.id})" class="btn-delete">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// ===============================
// ACTIONS
// ===============================
async function approveApplication(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (application.status === 'approved') {
      return res.status(409).json({ success: false, message: 'Already approved.' });
    }

    const b = req.body || {};

    // merge DB + incoming request
    const merged = { ...application };

    for (const [field] of ASSIGNMENT_FIELDS) {
      if (b[field] !== undefined && b[field] !== null && b[field] !== '') {
        merged[field] = b[field].toString().trim();
      }
    }

    if (!merged.application_number) {
      merged.application_number = generateApplicationNumber(id);
    }

    // validate required fields
    const missing = ASSIGNMENT_FIELDS
      .filter(([f]) => !merged[f])
      .map(([, label]) => label);

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve — missing: ${missing.join(', ')}.`,
      });
    }

    // update application table (USE FRONTEND FIELD NAMES ONLY)
    await Application.updateAssignment(id, {
      application_number: merged.application_number,
      post_applied_for: merged.post_applied_for,
      contract_period: merged.contract_period,
      monthly_salary: merged.monthly_salary,
      education: merged.education,
      destination_country: merged.destination_country,
    });

    // create applicant (map correctly to applicant schema)
    const applicant = await Applicant.create({
      first_name: merged.first_name,
      middle_name: merged.middle_name,
      last_name: merged.last_name,
      dob: merged.dob,
      birth_place: merged.birth_place,
      age: merged.age,
      height: merged.height,
      weight: merged.weight,
      marital_status: merged.marital_status,
      religion: merged.religion,
      nationality: merged.nationality,

      // IMPORTANT MAPPING FIX
      destination_country_id: null, // or remove if not used
      country: merged.destination_country,

      post_applied: merged.post_applied_for,

      contract_period: merged.contract_period,
      monthly_salary: merged.monthly_salary,
      education: merged.education,

      passport_number: merged.passport_number,
      issue_place: merged.issue_place,
      passport_issue_date: merged.passport_issue_date,
      passport_expiry: merged.passport_expiry,

      experience_period: merged.experience_period,
      experience_country: merged.experience_country,

      phone: merged.phone,
      family_phone: merged.family_phone,
      note: merged.note,

      reference_number: merged.application_number,
      user_id: merged.user_id,
      status: 'pending',
    });

    // documents
    const docs = [
      ['portrait', merged.portrait_path],
      ['passport', merged.passport_path],
      ['idcard', merged.idcard_path],
    ];

    for (const [docType, rel] of docs) {
      if (!rel) continue;

      const abs = toAbsolute(rel);
      if (!fs.existsSync(abs)) continue;

      const stat = fs.statSync(abs);

      await Applicant.upsertDocument({
        applicant_id: applicant.id,
        document_type: docType,
        file_path: abs,
        file_name: path.basename(abs),
        file_size: stat.size,
        mime_type: mimeFromExt(abs),
      });
    }

    await Application.updateStatus(id, 'approved');
    await Application.linkApplicant(id, applicant.id);

    return res.status(200).json({
      success: true,
      message: `Approved successfully (${applicant.reference_number || applicant.id}).`,
      data: {
        application_id: id,
        applicant_id: applicant.id,
      },
    });

  } catch (err) {
    next(err);
  }
}
async function rejectApp(id) {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/${id}/reject`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!data.success) throw new Error("Reject failed");

    alert("Application rejected");
    loadApplications();

  } catch (err) {
    console.error(err);
    alert("Error rejecting application");
  }
}

async function deleteApp(id) {
  if (!confirm("Are you sure you want to delete this application?")) return;

  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!data.success) throw new Error("Delete failed");

    alert("Application deleted");
    loadApplications();

  } catch (err) {
    console.error(err);
    alert("Error deleting application");
  }
}

// ===============================
// HELPERS
// ===============================
function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
}

function showLoading(state) {
  if (loadingState) {
    loadingState.style.display = state ? "block" : "none";
  }
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("confirmApproveBtn").addEventListener("click", async () => {
    try {
      const token = localStorage.getItem("token");

     const body = {
  post_applied_for: document.getElementById("postApplied").value,
  contract_period: document.getElementById("contractPeriod").value,
  monthly_salary: document.getElementById("monthlySalary").value,
  education: document.getElementById("education").value,
  destination_country: document.getElementById("destinationCountry").value
};

      const res = await fetch(`${API_BASE}/${selectedApproveId}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      alert("Application approved successfully");

      closeApproveModal();
      loadApplications();

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
});
document.getElementById("approveModal").style.display = "flex";