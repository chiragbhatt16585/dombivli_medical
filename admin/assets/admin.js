(function () {
  const esc = DMA.esc;
  const fmtDate = DMA.fmtDate;
  const fmtDay = DMA.fmtDay;
  const api = DMA.createClient("dma_admin_token", function () {
    if (!location.hash.startsWith("#/login")) location.hash = "#/login";
  });

  const state = { admin: null, association: null, error: "", notice: "" };
  let runId = 0;

  const memberStatus = { pending: "Pending", approved: "Approved", rejected: "Rejected", blocked: "Blocked", deactivated: "Deactivated" };
  const complaintStatus = { submitted: "Submitted", in_progress: "In Progress", under_review: "Under Review", resolved: "Resolved" };

  function badge(kind, label) {
    const map = {
      pending: "badge-followup",
      approved: "badge-ok",
      rejected: "badge-off",
      blocked: "badge-off",
      deactivated: "badge-off",
      submitted: "badge-new",
      open: "badge-new",
      in_progress: "badge-followup",
      under_review: "badge-draft",
      resolved: "badge-ok",
      closed: "badge-draft",
    };
    return '<span class="badge ' + (map[kind] || "badge-draft") + '">' + esc(label || kind) + "</span>";
  }

  function route() {
    const raw = (location.hash || "#/").slice(1);
    const bits = raw.split("?");
    const path = bits[0] || "/";
    return {
      path: path.startsWith("/") ? path : "/" + path,
      parts: path.split("/").filter(Boolean),
      params: new URLSearchParams(bits[1] || ""),
    };
  }

  function go(hash) {
    if (location.hash === hash) boot();
    else location.hash = hash;
  }

  function flashes() {
    let html = "";
    if (state.error) html += '<div class="flash flash-error">' + esc(state.error) + "</div>";
    if (state.notice) html += '<div class="flash flash-success">' + esc(state.notice) + "</div>";
    return html;
  }

  function initials(name) {
    const letters = String(name || "DMA").split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0);
    }).join("").toUpperCase();
    return letters || "DMA";
  }

  function shell(title, body) {
    const name = state.association ? state.association.name : "Dombivali Medical Association";
    const logo = state.association && state.association.logo_url
      ? '<a class="admin-logo" href="#/"><img src="' + esc(state.association.logo_url) + '" alt=""></a>'
      : esc(name);
    const headerLogo = state.association && state.association.logo_url
      ? '<img class="header-logo" src="' + esc(state.association.logo_url) + '" alt="">'
      : "";
    const current = route().parts[0] || "";
    const links = [
      ["/", "Dashboard", ""],
      ["/members", "Members", "members"],
      ["/complaints", "Complaints", "complaints"],
      ["/masters", "Masters", "masters"],
      ["/flyers", "Flyers", "flyers"],
      ["/sms", "SMS Manager", "sms"],
      ["/settings", "Site settings", "settings"],
    ];
    const nav = links.map(function (item) {
      const active = item[2] === current || (item[2] === "" && current === "") ? "active" : "";
      return '<a class="' + active + '" href="#' + item[0] + '">' + item[1] + "</a>";
    }).join("") + '<a href="/" target="_blank">Member site</a><a href="#/logout">Logout</a>';
    document.title = title + " | " + name + " Admin";
    return {
      html: '<div class="admin-shell"><aside class="admin-sidebar"><div class="admin-brand">' + logo +
        "<span>Admin Panel</span></div><nav class=\"admin-nav\">" + nav + "</nav></aside><main class=\"admin-main\">" +
        '<div class="admin-top"><div class="admin-top-title">' + headerLogo + '<h1>' + esc(title) + '</h1></div><div class="user-meta"><span>Hi, ' +
        esc(state.admin ? state.admin.name : "Admin") + '</span><a href="#/password">Change password</a></div></div>' +
        flashes() + body + siteFoot(state.association) + "</main></div>",
      bind: arguments[2] || null,
    };
  }

  function siteFoot(assoc) {
    if (!assoc) return '<p class="powered">Powered by Hrivya Software</p>';
    const bits = [assoc.support_mobile, assoc.whatsapp ? "WhatsApp " + assoc.whatsapp : "", assoc.support_email, assoc.address, assoc.office_hours].filter(Boolean);
    let html = "";
    if (bits.length) html += '<p class="site-footer">' + esc(bits.join(" · ")) + "</p>";
    if (assoc.copyright) html += '<p class="site-footer">' + esc(assoc.copyright) + "</p>";
    html += '<p class="powered">Powered by Hrivya Software</p>';
    return html;
  }

  function loginHtml(error) {
    const assoc = state.association || { name: "Dombivali Medical Association", tagline: "For medical stores in Dombivali" };
    const mark = assoc.logo_url
      ? '<img src="' + esc(assoc.logo_url) + '" alt="">'
      : '<span class="login-initials">' + esc(initials(assoc.name)) + "</span>";
    document.title = "Sign in | " + assoc.name;
    return '<div class="login-stage"><section class="login-brand"><div class="login-logo">' + mark + "</div><h1>" +
      esc(assoc.name) + "</h1>" + (assoc.tagline ? "<p>" + esc(assoc.tagline) + "</p>" : "") +
      '</section><section class="login-panel"><form class="login-card" id="login-form" autocomplete="off">' +
      '<p class="login-kicker">Admin</p><h2>Sign in</h2><p class="login-lead">Members, complaints, and flyers.</p>' +
      (error ? '<div class="flash flash-error">' + esc(error) + "</div>" : "") +
      '<div class="form-group"><label>Username</label><input type="text" name="username" required autocomplete="username"></div>' +
      '<div class="form-group"><label>Password</label><input type="password" name="password" required autocomplete="current-password"></div>' +
      '<button class="btn login-submit" type="submit">Sign in</button>' +
      '<p class="powered">Powered by Hrivya Software</p></form></section></div>';
  }

  async function loadAssociation() {
    if (state.association) return;
    try {
      state.association = (await api.request("/association")).data;
    } catch (error) {
      state.association = { name: "Dombivali Medical Association", tagline: "", logo_url: null };
    }
  }

  function filters(base, current, options) {
    return '<div class="filters">' + options.map(function (item) {
      const href = item[0] ? base + "?status=" + item[0] : base;
      const active = current === item[0] ? "active" : "";
      return '<a class="' + active + '" href="#' + href + '">' + item[1] + "</a>";
    }).join("") + "</div>";
  }

  async function viewDashboard() {
    const data = (await api.request("/admin/dashboard")).data;
    const counts = data.counts;
    const pending = data.pending_members.length ? data.pending_members.map(function (row) {
      return "<tr><td><strong>" + esc(row.owner_name) + "</strong><br><span class=\"help\">" + esc(row.shop_name) +
        " · " + esc(row.mobile) + "</span></td><td>" + esc(row.drug_licence_no) + "</td><td>" + fmtDate(row.created_at) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/members/' + row.id + '">Review</a></td></tr>';
    }).join("") : '<tr><td colspan="4">No memberships waiting for approval.</td></tr>';
    const complaints = data.open_complaints.length ? data.open_complaints.map(function (row) {
      return '<tr class="row-due"><td><strong>' + esc(row.title) + "</strong><br><span class=\"help\">" +
        esc(row.member.shop_name) + " · " + esc(row.member.mobile) + "</span></td><td>" +
        badge(row.status, complaintLabel(row)) + "</td><td>" + fmtDate(row.created_at) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/complaints/' + row.id + '">Open</a></td></tr>';
    }).join("") : '<tr><td colspan="4">No open complaints.</td></tr>';
    return shell("Dashboard",
      '<div class="stats"><div class="stat"><div class="label">Members</div><div class="value">' + counts.members +
      '</div></div><div class="stat"><div class="label">Pending approval</div><div class="value">' + counts.pending_members +
      '</div></div><div class="stat"><div class="label">Open complaints</div><div class="value">' + counts.open_complaints +
      '</div></div><div class="stat"><div class="label">Active flyers</div><div class="value">' + counts.active_flyers +
      "</div></div></div>" +
      '<div class="admin-card" style="margin-top:1rem"><div class="admin-top" style="margin-bottom:0"><h2 style="margin:0;font-size:1.05rem">Quick actions</h2><div class="actions">' +
      '<a class="btn" href="#/members?status=pending">Review members</a><a class="btn btn-secondary" href="#/complaints?status=submitted">Open complaints</a>' +
      '<a class="btn btn-outline" href="#/flyers/new">Add flyer</a></div></div></div>' +
      '<div class="form-grid"><div class="admin-card"><h2 style="margin:0 0 0.8rem;font-size:1.05rem">Waiting for approval</h2><div class="table-wrap"><table><thead><tr><th>Member</th><th>Drug licence</th><th>Registered</th><th></th></tr></thead><tbody>' +
      pending + "</tbody></table></div></div>" +
      '<div class="admin-card"><h2 style="margin:0 0 0.8rem;font-size:1.05rem">Complaints to handle</h2><div class="table-wrap"><table><thead><tr><th>Complaint</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>' +
      complaints + "</tbody></table></div></div></div>");
  }

  async function viewMembers(params) {
    const status = params.get("status") || "";
    const q = params.get("q") || "";
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (q) query.set("q", q);
    const suffix = query.toString() ? "?" + query.toString() : "";
    const rows = (await api.request("/admin/members" + suffix)).data;
    const body = rows.length ? rows.map(function (row, index) {
      const pdf = "/admin/members/" + row.id + "/application";
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td><strong>" + esc(row.owner_name) + "</strong><br><span class=\"help\">" + esc(row.shop_name) +
        "</span></td><td>" + esc(row.mobile) + "<br><span class=\"help\">" + esc(row.email || "—") +
        "</span></td><td>" + esc(row.drug_licence_no) + "</td><td>" + badge(row.status, memberStatus[row.status]) +
        "</td><td>" + fmtDate(row.created_at) + '</td><td><div class="row-icons">' +
        iconAction("View application", eyeIcon, ' data-application="' + esc(pdf) + '" data-token-key="dma_admin_token"') +
        iconAction("Download application", downloadIcon, ' data-application="' + esc(pdf) + '" data-token-key="dma_admin_token" data-download="1"') +
        '<a class="row-icon" href="#/members/' + row.id + '" title="Edit" aria-label="Edit">' + pencilIcon + "</a>" +
        (row.status === "deactivated" ? "" : iconAction("Delete", trashIcon, ' data-delete="' + row.id + '"', " danger")) +
        "</div></td></tr>";
    }).join("") : '<tr><td colspan="7">No members match this filter.</td></tr>';
    return shell("Members",
      '<div class="admin-top" style="margin-top:-0.4rem"><p class="help" style="margin:0">Delete deactivates the account. That mobile number cannot sign in again.</p><a class="icon-add" href="#/members/new" aria-label="Add member" title="Add member"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></a></div>' +
      filters("/members", status, [["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["blocked", "Blocked"], ["deactivated", "Deactivated"]]) +
      '<form class="search-row" id="member-search"><input type="search" name="q" value="' + esc(q) +
      '" placeholder="Name, shop, mobile, licence"><button class="btn btn-secondary" type="submit">Search</button></form>' +
      '<div class="admin-card table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Member</th><th>Contact</th><th>Drug licence</th><th>Status</th><th>Joined</th><th></th></tr></thead><tbody>' +
      body + "</tbody></table></div>",
      function () {
        document.getElementById("member-search").addEventListener("submit", function (event) {
          event.preventDefault();
          const value = new FormData(event.target).get("q") || "";
          const next = new URLSearchParams();
          if (status) next.set("status", status);
          if (String(value).trim()) next.set("q", String(value).trim());
          go("#/members" + (next.toString() ? "?" + next.toString() : ""));
        });
        bindMemberDelete();
      });
  }

  const eyeIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5c5.2 0 9.3 4.1 10.7 6a1.6 1.6 0 0 1 0 2C21.3 14.9 17.2 19 12 19S2.7 14.9 1.3 13a1.6 1.6 0 0 1 0-2C2.7 9.1 6.8 5 12 5zm0 2C8.1 7 4.8 10.2 3.5 12 4.8 13.8 8.1 17 12 17s7.2-3.2 8.5-5C19.2 10.2 15.9 7 12 7zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/></svg>';
  const downloadIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L11 12.6V4a1 1 0 0 1 1-1zM5 17a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/></svg>';
  const pencilIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 16.8V20h3.2l9.4-9.4-3.2-3.2L4 16.8zM18.7 8.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.2 1.2 3.2 3.2 0.8-1.6z"/></svg>';
  const trashIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1.1l-.8 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5.1 7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1zm1 2h4V5h-4v0zm-2.9 2 .8 12h8.2l.8-12H7.1z"/></svg>';

  function iconAction(label, icon, attrs, extraClass) {
    return '<button class="row-icon' + (extraClass || "") + '" type="button" title="' + esc(label) + '" aria-label="' + esc(label) + '"' + attrs + ">" + icon + "</button>";
  }

  function viewMemberCreate() {
    return shell("Add member",
      '<form id="member-form" class="admin-card"><p class="help">The member signs in later with this mobile number and an OTP. New accounts are approved. A passport photo can be added now or later.</p><div class="form-grid">' +
      memberApplicationFields({}) +
      '<div class="form-group full"><label>Passport-size photo</label><input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/gif"></div>' +
      '<div class="form-group full actions"><button class="btn" type="submit">Add member</button><a class="btn btn-outline" href="#/members">Back</a></div></div></form>',
      function () {
        document.getElementById("member-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = new FormData(form);
          if (!data.get("photo") || !data.get("photo").name) data.delete("photo");
          form.querySelector("button").disabled = true;
          try {
            const created = await api.request("/admin/members", { method: "POST", form: data });
            state.notice = "Member added. They can sign in with their mobile number.";
            state.error = "";
            go("#/members/" + created.data.id);
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function viewMember(id) {
    const row = (await api.request("/admin/members/" + id)).data;
    const controls = row.status === "deactivated"
      ? '<div class="banner">This account is deactivated. This mobile number cannot sign in.</div>'
      : '<div class="actions" style="margin-bottom:1rem">' +
        statusButton(row, "approved", "Approve", "btn") +
        statusButton(row, "rejected", "Reject", "btn-outline") +
        statusButton(row, "blocked", "Block", "btn-danger") +
        statusButton(row, "pending", "Mark pending", "btn-secondary") +
        '<button class="btn btn-danger" type="button" data-delete="' + row.id + '">Delete</button></div>';
    return shell(row.shop_name,
      '<div class="admin-card">' + controls +
      '<div class="actions" style="margin-bottom:1rem">' +
      DMA.applicationActions("/admin/members/" + row.id + "/application", "dma_admin_token") +
      "</div>" +
      "<p>Current status: " + badge(row.status, memberStatus[row.status]) + "</p>" +
      '<form id="member-form" class="form-grid">' +
      memberApplicationFields(row) +
      '<div class="form-group full"><label>Passport-size photo</label>' +
      (row.photo_url ? '<p><img class="owner-photo" src="' + esc(row.photo_url) + '" alt="Shop owner"></p>' : "") +
      '<input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/gif"><span class="help">Leave empty to keep the current photo.</span></div>' +
      '<div class="form-group full actions"><button class="btn" type="submit">Save member</button>' +
      '<a class="btn btn-outline" href="#/members">Back</a></div></form>' +
      '<p class="help">Last sign-in: ' + fmtDate(row.last_login_at) + " · Registered " + fmtDate(row.created_at) + "</p></div>",
      function () {
        document.querySelectorAll("[data-status]").forEach(function (button) {
          button.addEventListener("click", async function () {
            button.disabled = true;
            try {
              await api.request("/admin/members/" + id, { method: "PATCH", body: { status: button.dataset.status } });
              state.notice = "Status updated.";
              state.error = "";
              boot();
            } catch (error) {
              if (error.unauthorized) return;
              state.error = error.message;
              boot();
            }
          });
        });
        document.getElementById("member-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = new FormData(form);
          if (!data.get("photo") || !data.get("photo").name) data.delete("photo");
          form.querySelector("button").disabled = true;
          try {
            await api.request("/admin/members/" + id, { method: "POST", form: data });
            state.notice = "Member saved.";
            state.error = "";
            boot();
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
        bindMemberDelete();
      });
  }

  function bindMemberDelete() {
    document.querySelectorAll("[data-delete]").forEach(function (button) {
      button.addEventListener("click", async function () {
        if (!confirm("Deactivate this account? They will not be able to sign in again.")) return;
        button.disabled = true;
        try {
          await api.request("/admin/members/" + button.dataset.delete, { method: "DELETE" });
          state.notice = "Account deactivated. This mobile number cannot sign in.";
          state.error = "";
          boot();
        } catch (error) {
          if (error.unauthorized) return;
          state.error = error.message;
          boot();
        }
      });
    });
  }

  function statusButton(row, status, label, cls) {
    if (row.status === status) return "";
    return '<button class="btn ' + cls + '" type="button" data-status="' + status + '">' + label + "</button>";
  }

  function attachmentHtml(url) {
    if (!url) return "";
    if (/\.pdf(\?|$)/i.test(url)) {
      return '<p><a class="btn btn-secondary" href="' + esc(url) + '" target="_blank" rel="noopener">Open document</a></p>';
    }
    return '<p><img class="thumb-lg" src="' + esc(url) + '" alt=""></p>';
  }

  function complaintLabel(row) {
    return row.status_name || complaintStatus[row.status] || row.status;
  }

  function field(label, name, value, type) {
    return '<div class="form-group"><label>' + esc(label) + '</label><input type="' + (type || "text") +
      '" name="' + name + '" value="' + esc(value || "") + '"></div>';
  }

  function memberApplicationFields(row) {
    row = row || {};
    function area(label, name, value, required, full) {
      return '<div class="form-group' + (full === false ? "" : " full") + '"><label>' + esc(label) + '</label><textarea name="' + name + '"' +
        (required ? " required" : "") + ">" + esc(value || "") + "</textarea></div>";
    }
    return field("Name of the firm", "shop_name", row.shop_name) +
      area("Address of the firm", "address", row.address, true) +
      field("Proprietor / partner 1", "owner_name", row.owner_name) +
      area("Residential address", "residential_address", row.residential_address, true, false) +
      field("Partner 2", "partner2_name", row.partner2_name) +
      area("Residential address", "partner2_address", row.partner2_address, false, false) +
      field("Partner 3", "partner3_name", row.partner3_name) +
      area("Residential address", "partner3_address", row.partner3_address, false, false) +
      field("Email", "email", row.email, "email") +
      field("Mobile", "mobile", row.mobile, "tel") +
      field("Form 20", "licence_f20", row.licence_f20) +
      field("Form 20C", "licence_f20c", row.licence_f20c) +
      field("Form 21", "licence_f21", row.licence_f21) +
      field("Form 21B", "licence_f21b", row.licence_f21b) +
      field("Qualified person name", "qualified_person_name", row.qualified_person_name) +
      field("Registration number", "pharmacist_reg_no", row.pharmacist_reg_no) +
      field("Mobile", "qualified_person_phone", row.qualified_person_phone, "tel") +
      area("Address", "qualified_person_address", row.qualified_person_address, true, false) +
      field("Qualified person 2 name", "qualified_person2_name", row.qualified_person2_name) +
      field("Registration number", "qualified_person2_reg", row.qualified_person2_reg) +
      field("Mobile", "qualified_person2_phone", row.qualified_person2_phone, "tel") +
      area("Address", "qualified_person2_address", row.qualified_person2_address, false, false);
  }

  async function viewComplaints(params) {
    const status = params.get("status") || "";
    const suffix = status ? "?status=" + encodeURIComponent(status) : "";
    const statuses = (await api.request("/admin/complaint-statuses")).data;
    const rows = (await api.request("/admin/complaints" + suffix)).data;
    const body = rows.length ? rows.map(function (row) {
      return "<tr><td><strong>" + esc(row.title) + "</strong><br><span class=\"help\">" + esc(row.member.shop_name) +
        " · " + esc(row.member.owner_name) + "</span></td><td>" + esc(row.category_name || "—") +
        "</td><td>" + esc(row.member.mobile) +
        "</td><td>" + badge(row.status, complaintLabel(row)) + "</td><td>" + fmtDate(row.created_at) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/complaints/' + row.id + '">Open</a></td></tr>';
    }).join("") : '<tr><td colspan="6">No complaints in this list.</td></tr>';
    const options = [["", "All"]].concat(statuses.map(function (item) {
      return [item.code, item.name];
    }));
    return shell("Complaints",
      filters("/complaints", status, options) +
      '<div class="admin-card table-wrap"><table><thead><tr><th>Complaint</th><th>Category</th><th>Mobile</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>' +
      body + "</tbody></table></div>");
  }

  async function viewComplaint(id) {
    const row = (await api.request("/admin/complaints/" + id)).data;
    const statuses = (await api.request("/admin/complaint-statuses")).data;
    const photo = attachmentHtml(row.photo_url);
    const options = statuses.filter(function (item) {
      return item.is_active || item.code === row.status;
    }).map(function (item) {
      return '<option value="' + esc(item.code) + '"' + (item.code === row.status ? " selected" : "") + ">" + esc(item.name) + "</option>";
    }).join("");
    return shell(row.title,
      '<div class="form-grid"><div class="admin-card"><p>' + badge(row.status, complaintLabel(row)) +
      (row.category_name ? " " + esc(row.category_name) : "") +
      "</p><p>" + esc(row.details) + "</p>" + photo +
      '<p class="help">From ' + esc(row.member.owner_name) + ", " + esc(row.member.shop_name) + "<br>" +
      esc(row.member.mobile) + " · Licence " + esc(row.member.drug_licence_no) + "<br>Received " + fmtDate(row.created_at) +
      '</p><p><a class="btn btn-outline btn-sm" href="#/members/' + row.member.id + '">View member</a></p></div>' +
      '<form class="admin-card" id="reply-form"><div class="form-group"><label>Status</label><select name="status">' +
      options + '</select></div><div class="form-group"><label>Reply to the member</label><textarea name="admin_reply">' +
      esc(row.admin_reply || "") + '</textarea></div><button class="btn" type="submit">Save reply</button></form></div>',
      function () {
        document.getElementById("reply-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = Object.fromEntries(new FormData(form).entries());
          form.querySelector("button").disabled = true;
          try {
            await api.request("/admin/complaints/" + id, { method: "PATCH", body: data });
            state.notice = "Complaint updated.";
            state.error = "";
            boot();
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function viewFlyers() {
    const rows = (await api.request("/admin/flyers")).data;
    const cards = rows.length ? rows.map(function (row) {
      const when = (row.starts_on || row.ends_on)
        ? fmtDay(row.starts_on) + " – " + fmtDay(row.ends_on)
        : "No date limit";
      return '<article class="admin-card flyer-card">' + DMA.flyerButton(row) + "<h3>" + esc(row.title) +
        "</h3><p class=\"help\">" + when + "</p><p>" + (row.is_active ? badge("approved", "Active") : badge("closed", "Hidden")) +
        '</p><div class="actions"><a class="btn btn-sm btn-secondary" href="#/flyers/' + row.id + '">Edit</a>' +
        '<button class="btn btn-sm btn-danger" type="button" data-delete="' + row.id + '">Delete</button></div></article>';
    }).join("") : '<div class="admin-card"><p class="empty">No flyers yet. Add one to show it on the member site and in the app.</p></div>';
    return shell("Flyers",
      '<div class="admin-top" style="margin-top:-0.4rem"><p class="help" style="margin:0">The same flyer record is what the website and the mobile app display.</p><a class="btn" href="#/flyers/new">Add flyer</a></div>' +
      '<div class="flyer-grid">' + cards + "</div>",
      function () {
        document.querySelectorAll("[data-delete]").forEach(function (button) {
          button.addEventListener("click", async function () {
            if (!confirm("Delete this flyer?")) return;
            try {
              await api.request("/admin/flyers/" + button.dataset.delete, { method: "DELETE" });
              state.notice = "Flyer deleted.";
              state.error = "";
              boot();
            } catch (error) {
              if (error.unauthorized) return;
              state.error = error.message;
              boot();
            }
          });
        });
      });
  }

  async function viewFlyerForm(id) {
    const row = id ? (await api.request("/admin/flyers/" + id)).data : {
      title: "", link_url: "", starts_on: "", ends_on: "", is_active: true, sort_order: 0, image_url: ""
    };
    const preview = row.image_url ? '<img class="thumb-lg" src="' + esc(row.image_url) + '" alt="">' : "";
    return shell(id ? "Edit flyer" : "Add flyer",
      '<form class="admin-card" id="flyer-form"><div class="form-grid">' +
      '<div class="form-group full"><label>Title</label><input name="title" required value="' + esc(row.title) + '"></div>' +
      '<div class="form-group full"><label>Image</label><input type="file" name="image" accept="image/*"' + (id ? "" : " required") + ">" +
      '<span class="help">JPG, PNG, WEBP, or GIF. Up to 5 MB. Shown on the website and in the app.</span></div>' +
      '<div class="form-group full">' + preview + "</div>" +
      '<div class="form-group full"><label>Link</label><input type="url" name="link_url" value="' + esc(row.link_url || "") + '" placeholder="https://"></div>' +
      '<div class="form-group"><label>Starts on</label><input type="date" name="starts_on" value="' + esc(row.starts_on || "") + '"></div>' +
      '<div class="form-group"><label>Ends on</label><input type="date" name="ends_on" value="' + esc(row.ends_on || "") + '"></div>' +
      '<div class="form-group"><label>Sort order</label><input type="number" name="sort_order" min="0" max="9999" value="' + esc(row.sort_order) + '"></div>' +
      '<div class="form-group"><label class="checkline"><input type="checkbox" name="is_active"' + (row.is_active ? " checked" : "") + "> Visible on website and app</label></div>" +
      '<div class="form-group full actions"><button class="btn" type="submit">' + (id ? "Save flyer" : "Publish flyer") +
      '</button><a class="btn btn-outline" href="#/flyers">Back</a></div></div></form>',
      function () {
        document.getElementById("flyer-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = new FormData(form);
          data.set("is_active", form.is_active.checked ? "1" : "0");
          if (!data.get("image") || !data.get("image").name) data.delete("image");
          form.querySelector("button").disabled = true;
          try {
            await api.request(id ? "/admin/flyers/" + id : "/admin/flyers", { method: "POST", form: data });
            state.notice = id ? "Flyer saved." : "Flyer published.";
            state.error = "";
            go("#/flyers");
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function viewSms(params) {
    const q = params.get("q") || "";
    const suffix = q ? "?q=" + encodeURIComponent(q) : "";
    const rows = (await api.request("/admin/sms" + suffix)).data;
    const body = rows.length ? rows.map(function (row) {
      const statusLabel = { logged: "Saved", sent: "Sent", failed: "Failed" }[row.status] || row.status;
      const statusKind = row.status === "sent" ? "approved" : (row.status === "failed" ? "rejected" : "pending");
      const provider = row.provider === "routemobile" ? "RouteMobile" : "Local log";
      return "<tr><td>" + fmtDate(row.created_at) + "</td><td><strong>" + esc(row.mobile) +
        "</strong><br><span class=\"help\">" + esc(row.sender) + "</span></td><td>" + esc(row.message) +
        "</td><td>" + esc(provider) + "</td><td>" + badge(statusKind, statusLabel) + "</td></tr>";
    }).join("") : '<tr><td colspan="5">No messages yet. A member OTP will appear here.</td></tr>';
    return shell("SMS Manager",
      '<p class="help">Until RouteMobile is connected, login messages are stored here with the OTP filled in. Nothing is sent to a phone.</p>' +
      '<form class="search-row" id="sms-search"><input type="search" name="q" value="' + esc(q) +
      '" placeholder="Mobile or message"><button class="btn btn-secondary" type="submit">Search</button></form>' +
      '<div class="admin-card table-wrap"><table><thead><tr><th>Time</th><th>Mobile</th><th>Message</th><th>Provider</th><th>Status</th></tr></thead><tbody>' +
      body + "</tbody></table></div>",
      function () {
        document.getElementById("sms-search").addEventListener("submit", function (event) {
          event.preventDefault();
          const value = String(new FormData(event.target).get("q") || "").trim();
          go("#/sms" + (value ? "?q=" + encodeURIComponent(value) : ""));
        });
      });
  }

  async function viewSettings() {
    const data = (await api.request("/admin/settings")).data;
    const assoc = data.association;
    const sms = data.sms;
    state.association = assoc;
    const smsText = {
      routemobile: "RouteMobile is live. OTPs are generated and checked by RouteMobile.",
      local: "RouteMobile is not connected. Each OTP is saved in SMS Manager instead of being sent. Add RM_USERNAME, RM_PASSWORD, and RM_SENDER in .env when the account is ready, and set APP_DEBUG=0.",
      incomplete: "RouteMobile is only partly configured. Username, password, and sender ID are all required.",
      unconfigured: "RouteMobile is not configured, and local OTP is switched off.",
    }[sms.mode] || sms.mode;
    const logo = assoc.logo_url ? '<img class="brand-preview" src="' + esc(assoc.logo_url) + '" alt="">' : '<p class="help">No logo yet. Initials are shown until you upload one.</p>';
    const remove = assoc.logo_url
      ? '<label class="checkline"><input type="checkbox" name="remove_logo" value="1"> Remove current logo</label>'
      : "";
    return shell("Site settings",
      '<form id="settings-form">' +
      '<div class="admin-card"><h2 style="margin:0 0 0.8rem;font-size:1.05rem">Site</h2><div class="form-grid">' +
      field("Site name", "name", assoc.name) +
      field("Tagline", "tagline", assoc.tagline) +
      field("Copyright", "copyright", assoc.copyright) +
      '<div class="form-group full"><label>Logo</label>' + logo +
      '<input type="file" name="logo" accept="image/*"><span class="help">Used on the admin and member sign-in screens, and in both headers.</span>' +
      remove + "</div></div></div>" +
      '<div class="admin-card"><h2 style="margin:0 0 0.8rem;font-size:1.05rem">Contact</h2><div class="form-grid">' +
      field("Phone", "support_mobile", assoc.support_mobile, "tel") +
      field("WhatsApp", "whatsapp", assoc.whatsapp, "tel") +
      field("Email", "support_email", assoc.support_email, "email") +
      field("Office hours", "office_hours", assoc.office_hours) +
      '<div class="form-group full"><label>Address</label><textarea name="address">' + esc(assoc.address || "") + "</textarea></div>" +
      '<div class="form-group full"><button class="btn" type="submit">Save site settings</button></div></div></div></form>' +
      '<div class="admin-card"><h2 style="margin:0 0 0.6rem;font-size:1.05rem">RouteMobile OTP</h2><p>' + esc(smsText) +
      '</p><p class="help">Sender: ' + esc(sms.sender || "not set") + " · OTP length " + esc(sms.otp_length) +
      " · valid for " + esc(sms.otp_expiry_seconds) + " seconds<br>API: " + esc(sms.base_url) +
      "/OtpApi/otpgenerate</p></div>",
      function () {
        document.getElementById("settings-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = new FormData(form);
          if (!data.get("logo") || !data.get("logo").name) data.delete("logo");
          data.set("remove_logo", form.remove_logo && form.remove_logo.checked ? "1" : "0");
          form.querySelector("button").disabled = true;
          try {
            state.association = (await api.request("/admin/settings", { method: "POST", form: data })).data;
            state.notice = "Site settings saved.";
            state.error = "";
            boot();
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  function viewPassword() {
    return shell("Change password",
      '<form class="admin-card" id="password-form" style="max-width:460px"><div class="form-group"><label>Current password</label><input type="password" name="current_password" required autocomplete="current-password"></div>' +
      '<div class="form-group"><label>New password</label><input type="password" name="new_password" required minlength="8" autocomplete="new-password"></div>' +
      '<div class="form-group"><label>Confirm new password</label><input type="password" name="confirm_password" required minlength="8" autocomplete="new-password"></div>' +
      '<button class="btn" type="submit">Update password</button></form>',
      function () {
        document.getElementById("password-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = Object.fromEntries(new FormData(form).entries());
          if (data.new_password !== data.confirm_password) {
            state.error = "New password and confirmation do not match.";
            state.notice = "";
            boot();
            return;
          }
          form.querySelector("button").disabled = true;
          try {
            await api.request("/admin/password", {
              method: "POST",
              body: { current_password: data.current_password, new_password: data.new_password },
            });
            state.notice = "Password updated.";
            state.error = "";
            go("#/");
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function boot() {
    const mine = ++runId;
    const app = document.getElementById("app");
    const current = route();
    try {
      await loadAssociation();
      if (mine !== runId) return;
      if (current.path === "/logout") {
        try { await api.request("/admin/logout", { method: "POST" }); } catch (error) { /* already signed out */ }
        api.setToken("");
        state.admin = null;
        location.hash = "#/login";
        return;
      }
      if (!api.token()) {
        document.body.className = "login-body";
        if (current.path !== "/login") {
          location.hash = "#/login";
          return;
        }
        app.innerHTML = loginHtml(state.error);
        document.getElementById("login-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = Object.fromEntries(new FormData(form).entries());
          form.querySelector("button").disabled = true;
          try {
            const result = await api.request("/admin/login", { method: "POST", body: data });
            api.setToken(result.data.token);
            state.admin = result.data.admin;
            state.error = "";
            location.hash = "#/";
          } catch (error) {
            state.error = error.message;
            boot();
          }
        });
        return;
      }
      if (current.path === "/login") {
        location.hash = "#/";
        return;
      }
      document.body.className = "";
      if (!state.admin) state.admin = (await api.request("/admin/me")).data;
      if (mine !== runId) return;
      const page = await renderPage(current);
      if (mine !== runId) return;
      app.innerHTML = page.html;
      if (page.bind) page.bind();
      state.error = "";
      state.notice = "";
    } catch (error) {
      if (mine !== runId || error.unauthorized) return;
      state.error = error.message;
      if (api.token()) {
        app.innerHTML = shell("Something went wrong", '<div class="admin-card"><p>' + esc(error.message) + '</p><a class="btn" href="#/">Back to dashboard</a></div>').html;
      } else {
        app.innerHTML = loginHtml(error.message);
      }
    }
  }

  function activeLabel(on) {
    return on ? '<span class="badge badge-ok">Active</span>' : '<span class="badge badge-off">Hidden</span>';
  }

  async function viewMasters() {
    const categories = (await api.request("/admin/complaint-categories")).data;
    const statuses = (await api.request("/admin/complaint-statuses")).data;
    const categoryRows = categories.map(function (row) {
      return "<tr><td><strong>" + esc(row.name) + "</strong></td><td>" + row.sort_order + "</td><td>" + activeLabel(row.is_active) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/masters/categories/' + row.id + '">Edit</a></td></tr>';
    }).join("");
    const statusRows = statuses.map(function (row) {
      return "<tr><td><strong>" + esc(row.name) + "</strong><br><span class=\"help\">" + esc(row.code) + "</span></td><td>" +
        row.sort_order + "</td><td>" + activeLabel(row.is_active) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/masters/statuses/' + row.id + '">Edit</a></td></tr>';
    }).join("");
    return shell("Masters",
      '<div class="admin-card"><div class="admin-top"><h2 style="margin:0;font-size:1.05rem">Complaint categories</h2><a class="btn" href="#/masters/categories/new">Add category</a></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Sort</th><th>Status</th><th></th></tr></thead><tbody>' +
      categoryRows + "</tbody></table></div></div>" +
      '<div class="admin-card"><div class="admin-top"><h2 style="margin:0;font-size:1.05rem">Complaint statuses</h2><a class="btn" href="#/masters/statuses/new">Add status</a></div>' +
      '<p class="help">Submitted, In Progress, Under Review, and Resolved are the tracking steps. New complaints start as Submitted.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Sort</th><th>Status</th><th></th></tr></thead><tbody>' +
      statusRows + "</tbody></table></div></div>");
  }

  function viewCategoryForm(row) {
    const editing = !!row;
    row = row || { name: "", sort_order: 0, is_active: true };
    return shell(editing ? "Edit category" : "Add category",
      '<form class="admin-card" id="master-form" style="max-width:560px"><div class="form-grid">' +
      '<div class="form-group full"><label>Name</label><input type="text" name="name" required minlength="3" value="' + esc(row.name) + '"></div>' +
      '<div class="form-group"><label>Sort order</label><input type="number" name="sort_order" min="0" max="9999" value="' + esc(row.sort_order) + '"></div>' +
      '<div class="form-group"><label class="checkline"><input type="checkbox" name="is_active"' + (row.is_active ? " checked" : "") + "> Available for new complaints</label></div>" +
      '<div class="form-group full actions"><button class="btn" type="submit">' + (editing ? "Save category" : "Add category") +
      '</button><a class="btn btn-outline" href="#/masters">Back</a></div></div></form>',
      function () {
        document.getElementById("master-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = Object.fromEntries(new FormData(form).entries());
          data.is_active = form.is_active.checked ? "1" : "0";
          form.querySelector("button").disabled = true;
          try {
            await api.request(editing ? "/admin/complaint-categories/" + row.id : "/admin/complaint-categories", {
              method: editing ? "PATCH" : "POST",
              body: data,
            });
            state.notice = editing ? "Category saved." : "Category added.";
            state.error = "";
            go("#/masters");
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function viewCategoryEdit(id) {
    const rows = (await api.request("/admin/complaint-categories")).data;
    const row = rows.find(function (item) { return String(item.id) === String(id); });
    if (!row) return shell("Category", '<div class="admin-card"><p>That category was not found.</p></div>');
    return viewCategoryForm(row);
  }

  function viewStatusForm(row) {
    const editing = !!row;
    row = row || { code: "", name: "", sort_order: 0, is_active: true };
    return shell(editing ? "Edit status" : "Add status",
      '<form class="admin-card" id="master-form" style="max-width:560px"><div class="form-grid">' +
      (editing
        ? '<div class="form-group full"><label>Code</label><input type="text" value="' + esc(row.code) + '" disabled></div>'
        : '<div class="form-group full"><label>Code</label><input type="text" name="code" required pattern="[a-z][a-z0-9_]{1,39}" placeholder="under_review"><span class="help">Lowercase letters, numbers, and underscores. This cannot be changed later.</span></div>') +
      '<div class="form-group full"><label>Name</label><input type="text" name="name" required minlength="3" value="' + esc(row.name) + '"></div>' +
      '<div class="form-group"><label>Sort order</label><input type="number" name="sort_order" min="0" max="9999" value="' + esc(row.sort_order) + '"></div>' +
      '<div class="form-group"><label class="checkline"><input type="checkbox" name="is_active"' + (row.is_active ? " checked" : "") + "> Available when updating a complaint</label></div>" +
      '<div class="form-group full actions"><button class="btn" type="submit">' + (editing ? "Save status" : "Add status") +
      '</button><a class="btn btn-outline" href="#/masters">Back</a></div></div></form>',
      function () {
        document.getElementById("master-form").addEventListener("submit", async function (event) {
          event.preventDefault();
          const form = event.target;
          const data = Object.fromEntries(new FormData(form).entries());
          data.is_active = form.is_active.checked ? "1" : "0";
          form.querySelector("button").disabled = true;
          try {
            await api.request(editing ? "/admin/complaint-statuses/" + row.id : "/admin/complaint-statuses", {
              method: editing ? "PATCH" : "POST",
              body: data,
            });
            state.notice = editing ? "Status saved." : "Status added.";
            state.error = "";
            go("#/masters");
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function viewStatusEdit(id) {
    const rows = (await api.request("/admin/complaint-statuses")).data;
    const row = rows.find(function (item) { return String(item.id) === String(id); });
    if (!row) return shell("Status", '<div class="admin-card"><p>That status was not found.</p></div>');
    return viewStatusForm(row);
  }

  async function renderPage(current) {
    const parts = current.parts;
    let html;
    let bind = null;
    if (parts.length === 0) html = await viewDashboard();
    else if (parts[0] === "members" && parts[1] === "new") html = viewMemberCreate();
    else if (parts[0] === "members" && parts[1]) html = await viewMember(parts[1]);
    else if (parts[0] === "members") html = await viewMembers(current.params);
    else if (parts[0] === "complaints" && parts[1]) html = await viewComplaint(parts[1]);
    else if (parts[0] === "complaints") html = await viewComplaints(current.params);
    else if (parts[0] === "masters" && parts[1] === "categories" && parts[2] === "new") html = viewCategoryForm(null);
    else if (parts[0] === "masters" && parts[1] === "categories" && parts[2]) html = await viewCategoryEdit(parts[2]);
    else if (parts[0] === "masters" && parts[1] === "statuses" && parts[2] === "new") html = viewStatusForm(null);
    else if (parts[0] === "masters" && parts[1] === "statuses" && parts[2]) html = await viewStatusEdit(parts[2]);
    else if (parts[0] === "masters") html = await viewMasters();
    else if (parts[0] === "flyers" && parts[1] === "new") html = await viewFlyerForm(null);
    else if (parts[0] === "flyers" && parts[1]) html = await viewFlyerForm(parts[1]);
    else if (parts[0] === "flyers") html = await viewFlyers();
    else if (parts[0] === "sms") html = await viewSms(current.params);
    else if (parts[0] === "settings") html = await viewSettings();
    else if (parts[0] === "password") html = viewPassword();
    else html = shell("Not found", '<div class="admin-card"><p>That page does not exist.</p></div>');
    if (html && typeof html === "object") {
      bind = html.bind;
      html = html.html;
    }
    return { html: html, bind: bind };
  }

  window.addEventListener("hashchange", function () {
    state.error = "";
    state.notice = state.notice && location.hash !== "#/login" ? state.notice : "";
    boot();
  });
  boot();
})();
