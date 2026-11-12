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
      superadmin: "badge-ok",
      administrator: "badge-followup",
      staff: "badge-new",
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

  function navIcon(name) {
    const paths = {
      dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
      members: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      complaints: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      masters: '<path d="m12.83 2.18 8 3.2a2 2 0 0 1 0 3.24l-8 3.2a2 2 0 0 1-1.66 0l-8-3.2a2 2 0 0 1 0-3.24l8-3.2a2 2 0 0 1 1.66 0z"/><path d="m22 17.5-9.17 3.32a2 2 0 0 1-1.66 0L2 17.5"/><path d="m22 12.5-9.17 3.32a2 2 0 0 1-1.66 0L2 12.5"/>',
      flyers: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      sms: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      site: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 5.5 19 2"/><path d="m18 8 3-3"/>',
      admins: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 9h3"/><path d="M15 13h3"/><path d="M7 16h10"/>',
      categories: '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
      status: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    };
    return '<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || "") + "</svg>";
  }

  function can(key) {
    const admin = state.admin;
    if (!admin) return false;
    if (admin.role === "superadmin" || admin.role === "administrator") return true;
    return Array.isArray(admin.permissions) && admin.permissions.indexOf(key) !== -1;
  }

  function canAny(keys) {
    for (let i = 0; i < keys.length; i += 1) {
      if (can(keys[i])) return true;
    }
    return false;
  }

  function denied(title) {
    return shell(title, '<div class="admin-card"><p>Your account does not include this.</p></div>');
  }

  function homeHash() {
    if (can("dashboard.view")) return "#/";
    if (canAny(["members.view", "members.edit", "members.status", "members.deactivate", "members.pdf"])) return "#/members";
    if (can("members.create")) return "#/members/new";
    if (canAny(["complaints.view", "complaints.update"])) return "#/complaints";
    if (canAny(["staff.view", "staff.manage"])) return "#/masters/staff";
    if (canAny(["categories.view", "categories.manage"])) return "#/masters/categories";
    if (canAny(["statuses.view", "statuses.manage"])) return "#/masters/statuses";
    if (canAny(["flyers.view", "flyers.edit", "flyers.delete"])) return "#/flyers";
    if (can("flyers.create")) return "#/flyers/new";
    if (can("sms.view")) return "#/sms";
    if (canAny(["settings.view", "settings.edit"])) return "#/settings";
    return "#/password";
  }

  function shell(title, body) {
    const name = state.association ? state.association.name : "Dombivali Medical Association";
    const logo = state.association && state.association.logo_url
      ? '<a class="admin-logo" href="#/"><img src="' + esc(state.association.logo_url) + '" alt=""></a>'
      : esc(name);
    const headerLogo = state.association && state.association.logo_url
      ? '<img class="header-logo" src="' + esc(state.association.logo_url) + '" alt="">'
      : "";
    const parts = route().parts;
    const current = parts[0] || "";
    const sub = parts[1] || "";
    const links = [
      can("dashboard.view") ? ["/", "Dashboard", "", "dashboard"] : null,
      canAny(["members.view", "members.edit", "members.status", "members.deactivate", "members.pdf", "members.create"])
        ? [canAny(["members.view", "members.edit", "members.status", "members.deactivate", "members.pdf"]) ? "/members" : "/members/new", "Members", "members", "members"] : null,
      canAny(["complaints.view", "complaints.update"]) ? ["/complaints", "Complaints", "complaints", "complaints"] : null,
      canAny(["staff.view", "staff.manage", "categories.view", "categories.manage", "statuses.view", "statuses.manage"])
        ? ["/masters", "Masters", "masters", "masters"] : null,
      canAny(["flyers.view", "flyers.create", "flyers.edit", "flyers.delete"])
        ? [canAny(["flyers.view", "flyers.edit", "flyers.delete"]) ? "/flyers" : "/flyers/new", "Flyers", "flyers", "flyers"] : null,
      can("sms.view") ? ["/sms", "SMS Manager", "sms", "sms"] : null,
      canAny(["settings.view", "settings.edit"]) ? ["/settings", "Site settings", "settings", "settings"] : null,
    ].filter(Boolean);
    let mastersOpen = false;
    try {
      if (current === "masters") mastersOpen = sessionStorage.getItem("dma_masters_open") !== "0";
      else sessionStorage.removeItem("dma_masters_open");
    } catch (error) { /* storage can be blocked */ }
    let nav = links.map(function (item) {
      const active = item[2] === current ? "active" : "";
      if (item[2] !== "masters") {
        return '<a class="' + active + '" href="#' + item[0] + '">' + navIcon(item[3]) + "<span>" + item[1] + "</span></a>";
      }
      const masterLinks = [
        canAny(["staff.view", "staff.manage"]) ? ["/masters/staff", "Admin Manager", "staff", "admins"] : null,
        canAny(["categories.view", "categories.manage"]) ? ["/masters/categories", "Complaint Categories", "categories", "categories"] : null,
        canAny(["statuses.view", "statuses.manage"]) ? ["/masters/statuses", "Complaint Status", "statuses", "status"] : null,
      ].filter(Boolean);
      const children = masterLinks.map(function (link) {
        const on = current === "masters" && sub === link[2] ? "active" : "";
        return '<a class="sub ' + on + '" href="#' + link[0] + '">' + navIcon(link[3]) + "<span>" + link[1] + "</span></a>";
      }).join("");
      return '<div class="nav-group' + (mastersOpen ? " open" : "") + '" id="masters-group">' +
        '<button type="button" class="nav-toggle ' + active + '" id="masters-toggle" aria-expanded="' + (mastersOpen ? "true" : "false") + '">' +
        navIcon(item[3]) + "<span>" + item[1] + "</span>" +
        '<svg class="nav-icon chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '<div class="nav-sub">' + children + "</div></div>";
    }).join("");
    nav += '<a href="/" target="_blank">' + navIcon("site") + "<span>Member site</span></a>";
    document.title = title + " | " + name + " Admin";
    return {
      html: '<div class="admin-shell"><aside class="admin-sidebar"><div class="admin-brand">' + logo +
        "<span>Admin Panel</span></div><nav class=\"admin-nav\">" + nav + "</nav></aside><main class=\"admin-main\">" +
        '<div class="admin-top"><div class="admin-top-title">' + headerLogo + '<h1>' + esc(title) + "</h1></div>" +
        profileMenu() + "</div>" +
        flashes() + body + siteFoot(state.association) + "</main></div>",
      bind: arguments[2] || null,
    };
  }

  function profileMenu() {
    const admin = state.admin || { name: "Admin", username: "", role: "staff" };
    const role = admin.role === "superadmin" ? "Super admin" : (admin.role === "administrator" ? "Administrator" : "Staff");
    return '<div class="profile"><button type="button" class="profile-btn" id="profile-btn" aria-label="Account" aria-haspopup="true" aria-expanded="false">' +
      navIcon("user") + '</button><div class="profile-menu" id="profile-menu" hidden>' +
      '<div class="profile-who"><strong>' + esc(admin.name) + "</strong>" +
      (admin.username ? "<span>" + esc(admin.username) + "</span>" : "") +
      '<span class="profile-role">' + esc(role) + "</span></div>" +
      '<a href="#/password">' + navIcon("key") + "<span>Change password</span></a>" +
      '<a href="#/logout">' + navIcon("logout") + "<span>Logout</span></a></div></div>";
  }

  function bindProfile() {
    const button = document.getElementById("profile-btn");
    const menu = document.getElementById("profile-menu");
    if (!button || !menu) return;
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  function bindMasters() {
    const group = document.getElementById("masters-group");
    const button = document.getElementById("masters-toggle");
    if (!group || !button) return;
    button.addEventListener("click", function () {
      const open = !group.classList.contains("open");
      group.classList.toggle("open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      try {
        if (route().parts[0] === "masters") sessionStorage.setItem("dma_masters_open", open ? "1" : "0");
      } catch (error) { /* storage can be blocked */ }
    });
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

  function statCard(icon, label, value) {
    return '<div class="stat"><span class="stat-icon">' + navIcon(icon) + '</span><div><div class="label">' + label + '</div><div class="value">' + value + "</div></div></div>";
  }

  async function viewDashboard() {
    if (!can("dashboard.view")) return denied("Dashboard");
    const data = (await api.request("/admin/dashboard")).data;
    const counts = data.counts;
    const access = data.access || { members: true, complaints: true, flyers: true };
    const pending = data.pending_members.length ? data.pending_members.map(function (row, index) {
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td><strong>" + esc(row.owner_name) + "</strong><br><span class=\"help\">" + esc(row.shop_name) +
        " · " + esc(row.mobile) + "</span></td><td>" + esc(row.drug_licence_no) + "</td><td>" + fmtDate(row.created_at) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/members/' + row.id + '">Review</a></td></tr>';
    }).join("") : '<tr><td colspan="5">No memberships waiting for approval.</td></tr>';
    const complaints = data.open_complaints.length ? data.open_complaints.map(function (row, index) {
      return '<tr class="row-due"><td class="num">' + (index + 1) + "</td><td><strong>" + esc(row.title) + "</strong><br><span class=\"help\">" +
        esc(row.member.shop_name) + " · " + esc(row.member.mobile) + "</span></td><td>" +
        badge(row.status, complaintLabel(row)) + "</td><td>" + fmtDate(row.created_at) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/complaints/' + row.id + '">Open</a></td></tr>';
    }).join("") : '<tr><td colspan="5">No open complaints.</td></tr>';
    const stats = [
      access.members ? statCard("members", "Members", counts.members) : "",
      access.members ? statCard("clock", "Pending approval", counts.pending_members) : "",
      access.complaints ? statCard("complaints", "Open complaints", counts.open_complaints) : "",
      access.flyers ? statCard("flyers", "Active flyers", counts.active_flyers) : "",
    ].join("");
    const actions = [
      access.members ? '<a class="btn" href="#/members?status=pending">Review members</a>' : "",
      access.complaints ? '<a class="btn btn-secondary" href="#/complaints?status=submitted">Open complaints</a>' : "",
      can("flyers.create") ? '<a class="btn btn-outline" href="#/flyers/new">Add flyer</a>' : "",
    ].join("");
    const boards = (access.members
      ? '<div class="admin-card"><h2 style="margin:0 0 0.8rem;font-size:1.05rem">Waiting for approval</h2><div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Member</th><th>Drug licence</th><th>Registered</th><th></th></tr></thead><tbody>' + pending + "</tbody></table></div></div>"
      : "") +
      (access.complaints
        ? '<div class="admin-card"><h2 style="margin:0 0 0.8rem;font-size:1.05rem">Complaints to handle</h2><div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Complaint</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>' + complaints + "</tbody></table></div></div>"
        : "");
    return shell("Dashboard",
      (stats ? '<div class="stats">' + stats + "</div>" : "") +
      (actions ? '<div class="admin-card" style="margin-top:1rem"><div class="admin-top" style="margin-bottom:0"><h2 style="margin:0;font-size:1.05rem">Quick actions</h2><div class="actions">' + actions + "</div></div></div>" : "") +
      (boards ? '<div class="form-grid">' + boards + "</div>" : '<div class="admin-card"><p>No dashboard sections are included in your rights.</p></div>'));
  }

  async function viewMembers(params) {
    if (!canAny(["members.view", "members.edit", "members.status", "members.deactivate", "members.pdf"])) return denied("Members");
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
        (can("members.pdf")
          ? iconAction("View application", eyeIcon, ' data-application="' + esc(pdf) + '" data-token-key="dma_admin_token"') +
            iconAction("Download application", downloadIcon, ' data-application="' + esc(pdf) + '" data-token-key="dma_admin_token" data-download="1"')
          : "") +
        (canAny(["members.view", "members.edit"]) ? '<a class="row-icon" href="#/members/' + row.id + '" title="' + (can("members.edit") ? "Edit" : "View") + '" aria-label="' + (can("members.edit") ? "Edit" : "View") + '">' + pencilIcon + "</a>" : "") +
        (can("members.deactivate") && row.status !== "deactivated" ? iconAction("Delete", trashIcon, ' data-delete="' + row.id + '"', " danger") : "") +
        "</div></td></tr>";
    }).join("") : '<tr><td colspan="7">No members match this filter.</td></tr>';
    return shell("Members",
      '<div class="admin-top" style="margin-top:-0.4rem"><p class="help" style="margin:0">' + (can("members.deactivate") ? "Delete deactivates the account. That mobile number cannot sign in again." : "") + "</p>" +
      (can("members.create") ? '<a class="icon-add" href="#/members/new" aria-label="Add member" title="Add member"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></a>' : "") + "</div>" +
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
  const approveIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8.6-8.6 1.4 1.4z"/></svg>';
  const rejectIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>';
  const blockIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.2 16.8 16.8 7.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const pendingIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function iconAction(label, icon, attrs, extraClass) {
    return '<button class="row-icon' + (extraClass || "") + '" type="button" title="' + esc(label) + '" aria-label="' + esc(label) + '"' + attrs + ">" + icon + "</button>";
  }

  function labeledIcon(label, caption, icon, attrs, extraClass) {
    return '<button class="tool-btn" type="button" title="' + esc(label) + '" aria-label="' + esc(label) + '"' + attrs + ">" +
      '<span class="row-icon' + (extraClass || "") + '">' + icon + "</span>" +
      '<span class="tool-name">' + esc(caption) + "</span></button>";
  }

  function viewMemberCreate() {
    if (!can("members.create")) return denied("Add member");
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
          DMA.dropEmptyFiles(data, ["photo"].concat(DMA.licenceFileFields));
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
    if (!canAny(["members.view", "members.edit", "members.status", "members.deactivate", "members.pdf"])) return denied("Member");
    const row = (await api.request("/admin/members/" + id)).data;
    const statusBits = can("members.status")
      ? statusButton(row, "approved", "Approve", "Approve", approveIcon, " ok") +
        statusButton(row, "rejected", "Reject", "Reject", rejectIcon, " danger") +
        statusButton(row, "blocked", "Block", "Block", blockIcon, " danger") +
        statusButton(row, "pending", "Mark pending", "Pending", pendingIcon, " warn")
      : "";
    const deleteBit = can("members.deactivate") ? labeledIcon("Delete", "Delete", trashIcon, ' data-delete="' + row.id + '"', " danger") : "";
    const pdfPath = "/admin/members/" + row.id + "/application";
    const pdfBit = can("members.pdf")
      ? labeledIcon("View application PDF", "View PDF", eyeIcon, ' data-application="' + esc(pdfPath) + '" data-token-key="dma_admin_token"') +
        labeledIcon("Download application PDF", "Download", downloadIcon, ' data-application="' + esc(pdfPath) + '" data-token-key="dma_admin_token" data-download="1"')
      : "";
    const toolBits = statusBits + deleteBit + pdfBit;
    const controls = row.status === "deactivated"
      ? '<div class="banner">This account is deactivated. This mobile number cannot sign in.</div>' +
        (pdfBit ? '<div class="row-icons member-tools">' + pdfBit + "</div>" : "")
      : (toolBits ? '<div class="row-icons member-tools">' + toolBits + "</div>" : "");
    const editable = can("members.edit");
    const history = DMA.licenceHistoryTable(row.licence_history);
    return shell(row.shop_name,
      '<form id="member-form" class="admin-card">' + controls +
      "<p>Current status: " + badge(row.status, memberStatus[row.status]) + "</p>" +
      "<fieldset" + (editable ? "" : " disabled") + '><div class="form-grid">' +
      memberApplicationFields(row) +
      '<div class="form-group full"><label>Passport-size photo</label><div class="licence-copy-row">' +
      (row.photo_url ? '<img class="owner-photo" src="' + esc(row.photo_url) + '" alt="Shop owner" data-licence-copy="' + esc(row.photo_url) + '">' : "") +
      '<input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/gif"></div><span class="help">Leave empty to keep the current photo.</span></div>' +
      (editable ? '<div class="form-group full actions"><button class="btn" type="submit">Save member</button>' : '<div class="form-group full actions">') +
      '<a class="btn btn-outline" href="#/members">Back</a></div></div></fieldset></form>' +
      (history ? '<section class="admin-card">' + history + "</section>" : "") +
      '<p class="help">Last sign-in: ' + fmtDate(row.last_login_at) + " · Registered " + fmtDate(row.created_at) + "</p>",
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
          DMA.dropEmptyFiles(data, ["photo"].concat(DMA.licenceFileFields));
          const save = form.querySelector('button[type="submit"]');
          if (save) save.disabled = true;
          try {
            await api.request("/admin/members/" + id, { method: "POST", form: data });
            state.notice = "Member saved.";
            state.error = "";
            boot();
          } catch (error) {
            if (error.unauthorized) return;
            if (save) save.disabled = false;
            const main = document.querySelector(".admin-main");
            let flash = main ? main.querySelector(".flash-error") : null;
            if (!flash && main) {
              flash = document.createElement("div");
              flash.className = "flash flash-error";
              const top = main.querySelector(".admin-top");
              if (top && top.nextSibling) main.insertBefore(flash, top.nextSibling);
              else main.prepend(flash);
            }
            if (flash) flash.textContent = error.message;
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

  function statusButton(row, status, label, caption, icon, extraClass) {
    if (row.status === status) return "";
    return labeledIcon(label, caption, icon, ' data-status="' + status + '"', extraClass);
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

  function officeBearerCard(people) {
    const rows = people || {};
    const roles = [
      ["president", "President"],
      ["secretary", "Hon. Gen. Secretary"],
      ["treasurer", "Treasurer"],
      ["zonal", "Zonal Leader"],
    ];
    const fields = roles.map(function (role) {
      const row = rows[role[0]] || {};
      return '<div class="licence-card"><h3>' + esc(role[1]) + "</h3><div class=\"form-grid\">" +
        field("Name", role[0] + "_name", row.name) +
        field("Designation", role[0] + "_title", row.title) +
        field("Mobile", role[0] + "_mobile", row.mobile, "tel") +
        "</div></div>";
    }).join("");
    return '<div class="admin-card"><h2 style="margin:0 0 0.35rem;font-size:1.05rem">Office bearers</h2>' +
      '<p class="help">These names are printed on the membership application. Members who have already registered keep the names from the day they joined. A change here applies only to members who register after you save.</p>' +
      fields + "</div>";
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
      DMA.licenceCards(row, false) +
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
    if (!canAny(["complaints.view", "complaints.update"])) return denied("Complaints");
    const status = params.get("status") || "";
    const suffix = status ? "?status=" + encodeURIComponent(status) : "";
    const statuses = (await api.request("/admin/complaint-statuses")).data;
    const rows = (await api.request("/admin/complaints" + suffix)).data;
    const body = rows.length ? rows.map(function (row, index) {
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td><strong>" + esc(row.title) + "</strong><br><span class=\"help\">" + esc(row.member.shop_name) +
        " · " + esc(row.member.owner_name) + "</span></td><td>" + esc(row.category_name || "—") +
        "</td><td>" + esc(row.member.mobile) +
        "</td><td>" + badge(row.status, complaintLabel(row)) + "</td><td>" + fmtDate(row.created_at) +
        '</td><td><a class="btn btn-sm btn-secondary" href="#/complaints/' + row.id + '">Open</a></td></tr>';
    }).join("") : '<tr><td colspan="7">No complaints in this list.</td></tr>';
    const options = [["", "All"]].concat(statuses.map(function (item) {
      return [item.code, item.name];
    }));
    return shell("Complaints",
      filters("/complaints", status, options) +
      '<div class="admin-card table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Complaint</th><th>Category</th><th>Mobile</th><th>Status</th><th>Received</th><th></th></tr></thead><tbody>' +
      body + "</tbody></table></div>");
  }

  async function viewComplaint(id) {
    if (!canAny(["complaints.view", "complaints.update"])) return denied("Complaint");
    const row = (await api.request("/admin/complaints/" + id)).data;
    const statuses = can("complaints.update") ? (await api.request("/admin/complaint-statuses")).data : [];
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
      "</p>" + (canAny(["members.view", "members.edit"]) ? '<p><a class="btn btn-outline btn-sm" href="#/members/' + row.member.id + '">View member</a></p>' : "") + "</div>" +
      (can("complaints.update")
        ? '<form class="admin-card" id="reply-form"><div class="form-group"><label>Status</label><select name="status">' +
          options + '</select></div><div class="form-group"><label>Reply to the member</label><textarea name="admin_reply">' +
          esc(row.admin_reply || "") + '</textarea></div><button class="btn" type="submit">Save reply</button></form>'
        : "") + "</div>",
      function () {
        const reply = document.getElementById("reply-form");
        if (!reply) return;
        reply.addEventListener("submit", async function (event) {
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
    if (!canAny(["flyers.view", "flyers.edit", "flyers.delete"])) return denied("Flyers");
    const rows = (await api.request("/admin/flyers")).data;
    const cards = rows.length ? rows.map(function (row, index) {
      const when = (row.starts_on || row.ends_on)
        ? fmtDay(row.starts_on) + " – " + fmtDay(row.ends_on)
        : "No date limit";
      return '<article class="admin-card flyer-card"><span class="row-num">' + (index + 1) + "</span>" + DMA.flyerButton(row) + "<h3>" + esc(row.title) +
        "</h3><p class=\"help\">" + when + "</p><p>" + (row.is_active ? badge("approved", "Active") : badge("closed", "Hidden")) +
        "</p>" + (can("flyers.edit") || can("flyers.delete")
          ? '<div class="actions">' +
            (can("flyers.edit") ? '<a class="btn btn-sm btn-secondary" href="#/flyers/' + row.id + '">Edit</a>' : "") +
            (can("flyers.delete") ? '<button class="btn btn-sm btn-danger" type="button" data-delete="' + row.id + '">Delete</button>' : "") +
            "</div>"
          : "") + "</article>";
    }).join("") : '<div class="admin-card"><p class="empty">No flyers yet. Add one to show it on the member site and in the app.</p></div>';
    return shell("Flyers",
      '<div class="admin-top" style="margin-top:-0.4rem"><p class="help" style="margin:0">The same flyer record is what the website and the mobile app display.</p>' +
      (can("flyers.create") ? '<a class="btn" href="#/flyers/new">Add flyer</a>' : "") + "</div>" +
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
    if (id && !can("flyers.edit")) return denied("Edit flyer");
    if (!id && !can("flyers.create")) return denied("Add flyer");
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
    if (!can("sms.view")) return denied("SMS Manager");
    const q = params.get("q") || "";
    const suffix = q ? "?q=" + encodeURIComponent(q) : "";
    const rows = (await api.request("/admin/sms" + suffix)).data;
    const body = rows.length ? rows.map(function (row, index) {
      const statusLabel = { logged: "Saved", sent: "Sent", failed: "Failed" }[row.status] || row.status;
      const statusKind = row.status === "sent" ? "approved" : (row.status === "failed" ? "rejected" : "pending");
      const provider = row.provider === "routemobile" ? "RouteMobile" : "Local log";
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td>" + fmtDate(row.created_at) + "</td><td><strong>" + esc(row.mobile) +
        "</strong><br><span class=\"help\">" + esc(row.sender) + "</span></td><td>" + esc(row.message) +
        "</td><td>" + esc(provider) + "</td><td>" + badge(statusKind, statusLabel) + "</td></tr>";
    }).join("") : '<tr><td colspan="6">No messages yet. A member OTP will appear here.</td></tr>';
    return shell("SMS Manager",
      '<p class="help">Until RouteMobile is connected, login messages are stored here with the OTP filled in. Nothing is sent to a phone.</p>' +
      '<form class="search-row" id="sms-search"><input type="search" name="q" value="' + esc(q) +
      '" placeholder="Mobile or message"><button class="btn btn-secondary" type="submit">Search</button></form>' +
      '<div class="admin-card table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Time</th><th>Mobile</th><th>Message</th><th>Provider</th><th>Status</th></tr></thead><tbody>' +
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
    if (!canAny(["settings.view", "settings.edit"])) return denied("Site settings");
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
    const editable = can("settings.edit");
    return shell("Site settings",
      '<form id="settings-form"><fieldset' + (editable ? "" : " disabled") + ">" +
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
      '<div class="form-group full"><label>Address</label><textarea name="address">' + esc(assoc.address || "") + "</textarea></div></div></div>" +
      officeBearerCard(assoc.office_bearers) +
      (editable ? '<div class="admin-card"><button class="btn" type="submit">Save site settings</button></div>' : "") +
      "</fieldset></form>" +
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
            location.hash = homeHash();
          } catch (error) {
            state.error = error.message;
            boot();
          }
        });
        return;
      }
      if (current.path === "/login") {
        location.hash = homeHash();
        return;
      }
      document.body.className = "";
      if (!state.admin) state.admin = (await api.request("/admin/me")).data;
      if (mine !== runId) return;
      const page = await renderPage(current);
      if (mine !== runId) return;
      app.innerHTML = page.html;
      if (page.bind) page.bind();
      bindProfile();
      bindMasters();
      state.error = "";
      state.notice = "";
    } catch (error) {
      if (mine !== runId || error.unauthorized) return;
      state.error = error.message;
      if (api.token()) {
        app.innerHTML = shell("Something went wrong", '<div class="admin-card"><p>' + esc(error.message) + '</p><a class="btn" href="#/">Back to dashboard</a></div>').html;
        bindProfile();
        bindMasters();
      } else {
        app.innerHTML = loginHtml(error.message);
      }
    }
  }

  function activeLabel(on) {
    return on ? '<span class="badge badge-ok">Active</span>' : '<span class="badge badge-off">Hidden</span>';
  }

  function masterTile(href, icon, title, text) {
    return '<a class="master-item" href="' + href + '">' + navIcon(icon) + "<strong>" + esc(title) + "</strong><span>" + esc(text) + "</span></a>";
  }

  function viewMasters() {
    const tiles = [
      canAny(["staff.view", "staff.manage"]) ? masterTile("#/masters/staff", "admins", "Admin Manager", "Staff who can sign in to this portal, and the rights each person has.") : "",
      canAny(["categories.view", "categories.manage"]) ? masterTile("#/masters/categories", "categories", "Complaint Categories", "The choices a member picks when filing a complaint.") : "",
      canAny(["statuses.view", "statuses.manage"]) ? masterTile("#/masters/statuses", "status", "Complaint Status", "The steps a complaint moves through.") : "",
    ].join("");
    if (!tiles) return denied("Masters");
    return shell("Masters", '<div class="master-menu">' + tiles + "</div>");
  }

  async function viewCategories() {
    if (!canAny(["categories.view", "categories.manage"])) return denied("Complaint Categories");
    const categories = (await api.request("/admin/complaint-categories")).data;
    const rows = categories.map(function (row, index) {
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td><strong>" + esc(row.name) + "</strong></td><td>" + row.sort_order + "</td><td>" + activeLabel(row.is_active) +
        "</td><td>" + (can("categories.manage") ? '<a class="btn btn-sm btn-secondary" href="#/masters/categories/' + row.id + '">Edit</a>' : "") + "</td></tr>";
    }).join("");
    return shell("Complaint Categories",
      '<div class="admin-card"><div class="admin-top"><h2 style="margin:0;font-size:1.05rem">Complaint categories</h2>' +
      (can("categories.manage") ? '<a class="btn" href="#/masters/categories/new">Add category</a>' : "") + "</div>" +
      '<div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Name</th><th>Sort</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table></div></div>");
  }

  async function viewStatuses() {
    if (!canAny(["statuses.view", "statuses.manage"])) return denied("Complaint Status");
    const statuses = (await api.request("/admin/complaint-statuses")).data;
    const rows = statuses.map(function (row, index) {
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td><strong>" + esc(row.name) + "</strong><br><span class=\"help\">" + esc(row.code) + "</span></td><td>" +
        row.sort_order + "</td><td>" + activeLabel(row.is_active) +
        "</td><td>" + (can("statuses.manage") ? '<a class="btn btn-sm btn-secondary" href="#/masters/statuses/' + row.id + '">Edit</a>' : "") + "</td></tr>";
    }).join("");
    return shell("Complaint Status",
      '<div class="admin-card"><div class="admin-top"><h2 style="margin:0;font-size:1.05rem">Complaint statuses</h2>' +
      (can("statuses.manage") ? '<a class="btn" href="#/masters/statuses/new">Add status</a>' : "") + "</div>" +
      '<p class="help">Submitted, In Progress, Under Review, and Resolved are the tracking steps. New complaints start as Submitted.</p>' +
      '<div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Name</th><th>Sort</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table></div></div>");
  }

  async function staffMasterCard() {
    const rows = (await api.request("/admin/staff")).data;
    const body = rows.length ? rows.map(function (row, index) {
      const rights = row.role === "staff" ? String((row.permissions || []).length) : "All";
      const canEditRow = can("staff.manage") && (state.admin.role === "superadmin" || (state.admin.role === "administrator" && row.role !== "superadmin") || row.role === "staff");
      const roleName = row.role === "superadmin" ? "Super admin" : (row.role === "administrator" ? "Administrator" : "Staff");
      return "<tr><td class=\"num\">" + (index + 1) + "</td><td><strong>" + esc(row.name) + "</strong></td><td>" +
        esc(row.username) + "</td><td>" + badge(row.role, roleName) +
        "</td><td>" + esc(rights) + "</td><td>" + activeLabel(row.is_active) + "</td><td>" +
        (canEditRow ? '<div class="row-icons"><a class="row-icon" href="#/masters/staff/' + row.id + '" title="Edit" aria-label="Edit">' + pencilIcon + "</a></div>" : "") +
        "</td></tr>";
    }).join("") : '<tr><td colspan="7">No staff yet.</td></tr>';
    return '<div class="admin-card"><div class="admin-top"><h2 style="margin:0;font-size:1.05rem">Staff accounts</h2>' +
      (can("staff.manage") ? '<a class="icon-add" href="#/masters/staff/new" aria-label="Add staff" title="Add staff"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></a>' : "") + "</div>" +
      '<p class="help">Each person only sees the menus and buttons included in their rights.</p>' +
      '<div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Name</th><th>Username</th><th>Role</th><th>Rights</th><th>Status</th><th></th></tr></thead><tbody>' +
      body + "</tbody></table></div></div>";
  }

  function rightsFields(row) {
    const catalog = (state.admin && state.admin.permission_catalog) || [];
    const selected = {};
    (row.permissions || []).forEach(function (key) { selected[key] = true; });
    const actorIsSuper = state.admin && state.admin.role === "superadmin";
    const groups = catalog.map(function (group) {
      const items = group.items.filter(function (item) {
        return actorIsSuper || can(item.key);
      }).map(function (item) {
        return '<label class="checkline"><input type="checkbox" name="permissions" value="' + esc(item.key) + '"' +
          (selected[item.key] ? " checked" : "") + "> " + esc(item.label) + "</label>";
      }).join("");
      if (!items) return "";
      return '<section class="rights-group"><h3>' + esc(group.group) + "</h3>" + items + "</section>";
    }).join("");
    const fullRole = row.role === "superadmin" || row.role === "administrator";
    return '<div class="form-group full" id="rights"' + (fullRole ? " hidden" : "") + ">" +
      '<p class="help" style="margin-top:0">Tick the pages and actions this person may use. An administrator has every right except creating a super admin. A super admin has every right.</p><div class="rights">' +
      groups + "</div></div>";
  }

  function viewStaffForm(row) {
    if (!can("staff.manage")) return denied(row ? "Edit staff" : "Add staff");
    const editing = !!row;
    row = row || { name: "", username: "", role: "staff", is_active: true, permissions: [] };
    const actorIsSuper = state.admin && state.admin.role === "superadmin";
    return shell(editing ? "Edit staff" : "Add staff",
      '<form class="admin-card" id="staff-form" style="max-width:760px"><div class="form-grid">' +
      '<div class="form-group"><label>Name</label><input type="text" name="name" required minlength="2" value="' + esc(row.name) + '"></div>' +
      '<div class="form-group"><label>Username</label><input type="text" name="username" required minlength="3" value="' + esc(row.username) + '"></div>' +
      '<div class="form-group"><label>Password</label><input type="password" name="password" ' + (editing ? "" : "required ") + 'minlength="8" autocomplete="new-password"><span class="help">' +
      (editing ? "Leave blank to keep the current password." : "At least 8 characters.") + "</span></div>" +
      '<div class="form-group"><label>Role</label><select name="role"><option value="staff"' + (row.role === "staff" ? " selected" : "") + ">Staff</option>" +
      (actorIsSuper || (state.admin && state.admin.role === "administrator") ? '<option value="administrator"' + (row.role === "administrator" ? " selected" : "") + ">Administrator</option>" : "") +
      (actorIsSuper ? '<option value="superadmin"' + (row.role === "superadmin" ? " selected" : "") + ">Super admin</option>" : "") +
      "</select></div>" +
      '<div class="form-group full"><label class="checkline"><input type="checkbox" name="is_active"' + (row.is_active ? " checked" : "") + "> Can sign in</label></div>" +
      rightsFields(row) +
      '<div class="form-group full actions"><button class="btn" type="submit">' + (editing ? "Save staff" : "Add staff") +
      '</button><a class="btn btn-outline" href="#/masters/staff">Back</a></div></div></form>',
      function () {
        const form = document.getElementById("staff-form");
        const rights = document.getElementById("rights");
        form.role.addEventListener("change", function () {
          rights.hidden = form.role.value === "superadmin" || form.role.value === "administrator";
        });
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());
          data.is_active = form.is_active.checked ? "1" : "0";
          data.permissions = [];
          if (form.role.value === "staff") {
            form.querySelectorAll('input[name="permissions"]:checked').forEach(function (box) {
              data.permissions.push(box.value);
            });
          }
          if (!data.password) delete data.password;
          form.querySelector("button").disabled = true;
          try {
            await api.request(editing ? "/admin/staff/" + row.id : "/admin/staff", {
              method: editing ? "PATCH" : "POST",
              body: data,
            });
            state.notice = editing ? "Staff saved." : "Staff added. They can sign in with this username.";
            state.error = "";
            go("#/masters/staff");
          } catch (error) {
            if (error.unauthorized) return;
            state.error = error.message;
            form.querySelector("button").disabled = false;
            boot();
          }
        });
      });
  }

  async function viewStaffList() {
    if (!canAny(["staff.view", "staff.manage"])) return denied("Admin Manager");
    return shell("Admin Manager", await staffMasterCard());
  }

  async function viewStaffEdit(id) {
    if (!can("staff.manage")) return denied("Edit staff");
    const rows = (await api.request("/admin/staff")).data;
    const row = rows.find(function (item) { return String(item.id) === String(id); });
    if (!row) return shell("Staff", '<div class="admin-card"><p>That staff account was not found.</p></div>');
    if (row.role === "superadmin" && state.admin.role !== "superadmin") return denied("Edit staff");
    if (row.role === "administrator" && state.admin.role !== "superadmin" && state.admin.role !== "administrator") return denied("Edit staff");
    return viewStaffForm(row);
  }

  function viewCategoryForm(row) {
    if (!can("categories.manage")) return denied(row ? "Edit category" : "Add category");
    const editing = !!row;
    row = row || { name: "", sort_order: 0, is_active: true };
    return shell(editing ? "Edit category" : "Add category",
      '<form class="admin-card" id="master-form" style="max-width:560px"><div class="form-grid">' +
      '<div class="form-group full"><label>Name</label><input type="text" name="name" required minlength="3" value="' + esc(row.name) + '"></div>' +
      '<div class="form-group"><label>Sort order</label><input type="number" name="sort_order" min="0" max="9999" value="' + esc(row.sort_order) + '"></div>' +
      '<div class="form-group"><label class="checkline"><input type="checkbox" name="is_active"' + (row.is_active ? " checked" : "") + "> Available for new complaints</label></div>" +
      '<div class="form-group full actions"><button class="btn" type="submit">' + (editing ? "Save category" : "Add category") +
      '</button><a class="btn btn-outline" href="#/masters/categories">Back</a></div></div></form>',
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
            go("#/masters/categories");
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
    if (!can("statuses.manage")) return denied(row ? "Edit status" : "Add status");
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
      '</button><a class="btn btn-outline" href="#/masters/statuses">Back</a></div></div></form>',
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
            go("#/masters/statuses");
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
    if (parts.length === 0) {
      if (!can("dashboard.view")) {
        const next = homeHash();
        if (next !== "#/") location.hash = next;
        html = denied("Dashboard");
      } else html = await viewDashboard();
    }
    else if (parts[0] === "members" && parts[1] === "new") html = viewMemberCreate();
    else if (parts[0] === "members" && parts[1]) html = await viewMember(parts[1]);
    else if (parts[0] === "members") html = await viewMembers(current.params);
    else if (parts[0] === "complaints" && parts[1]) html = await viewComplaint(parts[1]);
    else if (parts[0] === "complaints") html = await viewComplaints(current.params);
    else if (parts[0] === "masters" && parts[1] === "staff" && parts[2] === "new") html = viewStaffForm(null);
    else if (parts[0] === "masters" && parts[1] === "staff" && parts[2]) html = await viewStaffEdit(parts[2]);
    else if (parts[0] === "masters" && parts[1] === "staff") html = await viewStaffList();
    else if (parts[0] === "masters" && parts[1] === "categories" && parts[2] === "new") html = viewCategoryForm(null);
    else if (parts[0] === "masters" && parts[1] === "categories" && parts[2]) html = await viewCategoryEdit(parts[2]);
    else if (parts[0] === "masters" && parts[1] === "categories") html = await viewCategories();
    else if (parts[0] === "masters" && parts[1] === "statuses" && parts[2] === "new") html = viewStatusForm(null);
    else if (parts[0] === "masters" && parts[1] === "statuses" && parts[2]) html = await viewStatusEdit(parts[2]);
    else if (parts[0] === "masters" && parts[1] === "statuses") html = await viewStatuses();
    else if (parts[0] === "masters") html = viewMasters();
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

  document.addEventListener("click", function () {
    const menu = document.getElementById("profile-menu");
    const button = document.getElementById("profile-btn");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    const menu = document.getElementById("profile-menu");
    const button = document.getElementById("profile-btn");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("hashchange", function () {
    state.error = "";
    state.notice = state.notice && location.hash !== "#/login" ? state.notice : "";
    boot();
  });
  boot();
})();
