(function () {
  const esc = DMA.esc;
  const fmtDate = DMA.fmtDate;
  const state = { association: null, member: null, error: "", notice: "" };
  let runId = 0;
  const api = DMA.createClient("dma_member_token", function () {
    state.member = null;
  });

  const complaintStatus = { submitted: "Submitted", in_progress: "In Progress", under_review: "Under Review", resolved: "Resolved" };

  function route() {
    const raw = (location.hash || "#/").slice(1);
    const bits = raw.split("?");
    const path = bits[0] || "/";
    return {
      path: path.charAt(0) === "/" ? path : "/" + path,
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
    return String(name || "DMA").split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0);
    }).join("").toUpperCase() || "DMA";
  }

  async function loadAssociation() {
    if (state.association) return;
    try {
      state.association = (await api.request("/association")).data;
    } catch (error) {
      state.association = { name: "Dombivali Medical Association", tagline: "For medical stores in Dombivali" };
    }
  }

  function layout(title, body) {
    const assoc = state.association || { name: "Dombivali Medical Association" };
    document.title = title + " | " + assoc.name;
    const current = route().path;
    const links = [["/", "Home", current === "/"]];
    if (state.member && state.member.status === "approved") {
      links.push(["/complaints", "Complaints", current.startsWith("/complaints")]);
      links.push(["/notices", "Notices", current === "/notices"]);
    }
    links.push(["/contact", "Contact Us", current === "/contact"]);
    if (state.member) {
      links.push(["/profile", state.member.status === "approved" ? "My shop" : "My details", current === "/profile"]);
    }
    const nav = links.map(function (item) {
      return '<a class="' + (item[2] ? "active" : "") + '" href="#' + item[0] + '">' + item[1] + "</a>";
    }).join("");
    const account = state.member
      ? '<span class="nav-who">' + esc(state.member.shop_name) + '</span><a href="#/logout">Logout</a>'
      : '<a class="' + (current === "/login" ? "active" : "") + '" href="#/login">Sign in</a>' +
        '<a class="' + (current === "/signup" ? "active" : "") + '" href="#/signup">Sign up</a>';
    const status = memberBanner();
    const logo = assoc.logo_url ? '<img class="header-logo" src="' + esc(assoc.logo_url) + '" alt="">' : "";
    const bits = [assoc.support_mobile, assoc.whatsapp ? "WhatsApp " + assoc.whatsapp : "", assoc.support_email, assoc.address, assoc.office_hours].filter(Boolean);
    return '<header class="site-top"><div class="site-brand">' + logo + "<div><strong>" + esc(assoc.name) + "</strong>" +
      (assoc.tagline ? "<small>" + esc(assoc.tagline) + "</small>" : "") +
      '</div></div><nav class="site-nav">' + nav + account + "</nav></header>" +
      '<main class="site-wrap"><h1 style="margin:0.2rem 0 1rem;font-size:1.45rem">' + esc(title) + "</h1>" +
      flashes() + status + body +
      (bits.length ? '<p class="site-footer">' + esc(bits.join(" · ")) + "</p>" : "") +
      (assoc.copyright ? '<p class="site-footer">' + esc(assoc.copyright) + "</p>" : "") +
      '<p class="powered">Powered by Hrivya Software</p></main>';
  }

  function memberBanner() {
    if (!state.member) return "";
    if (state.member.status === "pending") {
      return '<div class="banner">Your membership is waiting for approval. You can read notices now. Complaints open after the association checks your drug licence.</div>';
    }
    if (state.member.status === "rejected") {
      return '<div class="banner">The association has not approved this membership. Contact the office if the drug licence needs a correction.</div>';
    }
    return "";
  }

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
    return '<span class="badge ' + (map[kind] || "badge-draft") + '">' + esc(label) + "</span>";
  }

  function authScreen(purpose) {
    const signup = purpose === "register";
    const assoc = state.association || { name: "Dombivali Medical Association", tagline: "" };
    const mark = assoc.logo_url
      ? '<img src="' + esc(assoc.logo_url) + '" alt="">'
      : '<span class="login-initials">' + esc(initials(assoc.name)) + "</span>";
    const mobile = sessionStorage.getItem("dma_otp_mobile") || "";
    const otpStep = mobile !== "" && sessionStorage.getItem("dma_auth_purpose") === purpose;
    const localLog = sessionStorage.getItem("dma_otp_mode") === "local";
    document.title = (signup ? "Sign up" : "Sign in") + " | " + assoc.name;
    document.body.className = "login-body";
    const debug = localLog && otpStep
      ? '<div class="banner">RouteMobile is not connected yet. The OTP is saved in Admin → SMS Manager.</div>'
      : "";
    let heading = signup ? "Sign up" : "Sign in";
    let lead = signup
      ? "Start with your name, email, and mobile number. Shop details come after the OTP."
      : "Already registered stores sign in with their mobile number.";
    let form = "";
    if (otpStep) {
      heading = "Enter OTP";
      lead = "Enter the code sent to " + mobile + ".";
      form = debug +
        '<div class="form-group"><label>OTP</label><input type="text" name="otp" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{4,8}"></div>' +
        '<button class="btn login-submit" type="submit">' + (signup ? "Create account" : "Sign in") + "</button>" +
        '<p class="help" style="margin-top:0.8rem"><a href="#' + (signup ? "/signup" : "/login") + '" id="change-number">' +
        (signup ? "Edit name or email" : "Use a different number") + "</a></p>";
    } else if (signup) {
      form =
        '<div class="form-group"><label>Name</label><input type="text" name="owner_name" required value="' + draftValue("owner_name") + '"></div>' +
        '<div class="form-group"><label>Email</label><input type="email" name="email" required value="' + draftValue("email") + '"></div>' +
        '<div class="form-group"><label>Mobile number</label><input name="mobile" type="tel" inputmode="numeric" autocomplete="tel" required placeholder="10-digit mobile" value="' + draftValue("mobile") + '"></div>' +
        '<button class="btn login-submit" type="submit">Send OTP</button>';
    } else {
      form = '<div class="form-group"><label>Mobile number</label><input name="mobile" type="tel" inputmode="numeric" autocomplete="tel" required placeholder="10-digit mobile"></div>' +
        '<button class="btn login-submit" type="submit">Send OTP</button>';
    }
    const switchLink = signup
      ? '<p class="login-switch">Already registered? <a href="#/login">Sign in</a></p>'
      : '<p class="login-switch">New medical store? <a href="#/signup">Sign up</a></p>';
    return '<div class="login-stage"><section class="login-brand"><div class="login-logo">' + mark + "</div><h1>" +
      esc(assoc.name) + "</h1>" + (assoc.tagline ? "<p>" + esc(assoc.tagline) + "</p>" : "") +
      '</section><section class="login-panel"><form class="login-card" id="otp-form">' +
      '<p class="login-kicker">Member</p><h2>' + esc(heading) + "</h2>" +
      '<p class="login-lead">' + esc(lead) + "</p>" +
      (state.error ? '<div class="flash flash-error">' + esc(state.error) + "</div>" : "") +
      (state.notice ? '<div class="flash flash-success">' + esc(state.notice) + "</div>" : "") +
      form + switchLink + '<p class="powered">Powered by Hrivya Software</p></form></section></div>';
  }

  function attachmentHtml(url) {
    if (!url) return "";
    if (/\.pdf(\?|$)/i.test(url)) {
      return '<p><a class="btn btn-secondary" href="' + esc(url) + '" target="_blank" rel="noopener">Open document</a></p>';
    }
    return '<p><img class="thumb-lg" src="' + esc(url) + '" alt=""></p>';
  }

  function statusName(row) {
    return row.status_name || complaintStatus[row.status] || row.status;
  }

  function statIcon(name) {
    const paths = {
      complaints: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    };
    return '<span class="stat-icon"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || "") + "</svg></span>";
  }

  function flyerCard(row, index) {
    return '<article class="admin-card flyer-card"><span class="row-num">' + (index + 1) + "</span>" + DMA.flyerButton(row) + "<h3>" + esc(row.title) + "</h3></article>";
  }

  function fact(label, value) {
    return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value || "—") + "</dd></div>";
  }

  function wideFact(label, value, first) {
    if (!value) return "";
    return '<div class="member-address' + (first ? " is-first" : "") + '"><dt>' + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
  }

  function complaintRows(rows) {
    return rows.map(function (row, index) {
      return '<tr><td class="num">' + (index + 1) + "</td><td><strong>" + esc(row.title) + "</strong></td><td>" + esc(row.category_name || "—") +
        "</td><td>" + badge(row.status, statusName(row)) +
        "</td><td>" + fmtDate(row.created_at) + '</td><td><a class="btn btn-sm btn-secondary" href="#/complaints/' + row.id + '">View</a></td></tr>';
    }).join("");
  }

  async function viewNotices() {
    const rows = (await api.request("/flyers")).data;
    const cards = rows.length ? '<div class="flyer-grid">' + rows.map(flyerCard).join("") + "</div>" : '<div class="admin-card"><p class="empty">No notices right now.</p></div>';
    const join = state.member ? "" : '<p class="actions"><a class="btn" href="#/login">Sign in</a> <a class="btn btn-secondary" href="#/signup">Sign up</a></p>';
    return layout("Notices", join + cards);
  }

  function viewWaiting() {
    const member = state.member;
    const ready = member.details_complete;
    const message = member.status === "rejected"
      ? "The association has not approved this account. Update your details and contact the office."
      : member.status === "blocked"
        ? "This account is blocked. Contact the association office."
        : ready
          ? "Your details are with the association. Complaints, notices, and the other menus open after your account is verified."
          : "Your account is created. Add the shop, drug licence, qualified person, and a passport photo. The other menus open after the association verifies your account.";
    return layout("Home",
      DMA.licenceAlert(member) +
      '<div class="admin-card"><p class="help" style="margin-top:0">Signed in as ' + esc(member.owner_name) + "</p>" +
      "<p>" + badge(member.status, memberStatusLabel(member.status)) + "</p>" +
      "<p>" + esc(message) + "</p>" +
      licenceLine(member) +
      '<p class="actions"><a class="btn" href="#/profile">' +
      (ready ? "View my details" : "Add shop details") + "</a>" +
      DMA.applicationActions("/me/application", "dma_member_token", "icons") + "</p></div>");
  }

  async function viewHome() {
    if (!state.member) return viewNotices();
    if (state.member.status !== "approved") return viewWaiting();
    const member = state.member;
    const complaints = (await api.request("/complaints")).data;
    const notes = (await api.request("/notifications")).data;
    const unread = notes.filter(function (row) { return !row.read_at; });
    const recent = complaints.slice(0, 4);
    const recentTable = recent.length
      ? '<div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Subject</th><th>Category</th><th>Status</th><th>Sent</th><th></th></tr></thead><tbody>' +
        complaintRows(recent) + "</tbody></table></div>"
      : '<p class="empty">No complaints yet.</p>';
    const updates = unread.length
      ? '<div class="note-list">' + unread.slice(0, 5).map(function (row) {
          const href = row.complaint_id ? "#/complaints/" + row.complaint_id : "#/complaints";
          return '<a class="note unread" href="' + href + '"><strong>' + esc(row.title) + "</strong><span>" +
            esc(row.body) + '</span><span class="help">' + fmtDate(row.created_at) + "</span></a>";
        }).join("") + "</div>"
      : "";
    return layout(member.shop_name,
      '<div class="stack">' + DMA.licenceAlert(member) +
      '<section class="admin-card"><p class="help" style="margin-top:0">Signed in as ' + esc(member.owner_name) + "</p>" +
      "<p>" + badge(member.status, memberStatusLabel(member.status)) + "</p>" +
      (member.photo_url ? '<img class="owner-photo" src="' + esc(member.photo_url) + '" alt="Shop owner">' : "") +
      wideFact("Firm address", member.address, true) +
      '<dl class="member-facts' + (member.address ? " after-address" : "") + '">' +
      fact("Proprietor", member.owner_name) +
      fact("Mobile", member.mobile) +
      fact("Email", member.email) +
      "</dl>" +
      licenceLine(member) +
      qualifiedLine(member) +
      ((member.partner2_name || member.partner3_name) ? '<p class="help">Partner details are on Edit shop details.</p>' : "") +
      '<div class="actions" style="margin-top:1rem">' +
      DMA.applicationActions("/me/application", "dma_member_token", "icons") +
      '<a class="btn btn-outline" href="#/profile">Edit shop details</a></div></section>' +
      (updates ? '<section class="admin-card"><div class="section-head"><h2>Updates</h2><button class="btn btn-sm btn-outline" type="button" id="mark-read">Mark all read</button></div>' + updates + "</section>" : "") +
      '<section class="admin-card"><div class="section-head"><h2>Recent complaints</h2><a class="btn btn-sm btn-secondary" href="#/complaints">See all</a></div>' +
      recentTable + "</section></div>");
  }

  function viewContact() {
    const assoc = state.association || {};
    const rows = [
      assoc.support_mobile ? fact("Phone", assoc.support_mobile) : "",
      assoc.whatsapp ? fact("WhatsApp", assoc.whatsapp) : "",
      assoc.support_email ? fact("Email", assoc.support_email) : "",
      assoc.office_hours ? fact("Office hours", assoc.office_hours) : "",
    ].join("");
    return layout("Contact Us",
      '<section class="admin-card"><p class="help" style="margin-top:0">' + esc(assoc.name || "Association office") +
      (assoc.tagline ? " · " + esc(assoc.tagline) : "") + "</p>" +
      '<dl class="member-facts">' + rows + "</dl>" +
      wideFact("Office", assoc.address) +
      (assoc.copyright ? '<p class="help">' + esc(assoc.copyright) + "</p>" : "") +
      "</section>");
  }

  function memberStatusLabel(status) {
    const labels = { pending: "Waiting for approval", approved: "Approved member", rejected: "Not approved", blocked: "Blocked", deactivated: "Deactivated" };
    return labels[status] || status;
  }

  function signupDraft() {
    try {
      return JSON.parse(sessionStorage.getItem("dma_signup") || "{}");
    } catch (error) {
      return {};
    }
  }

  function draftValue(name) {
    return esc(signupDraft()[name] || "");
  }

  function signupInput(label, name, extra) {
    const opts = extra || {};
    return '<div class="form-group"><label>' + label + '</label><input type="' + (opts.type || "text") + '" name="' + name + '"' +
      (opts.required ? " required" : "") + ' value="' + draftValue(name) + '">' +
      (opts.help ? '<span class="help">' + opts.help + "</span>" : "") + "</div>";
  }

  function signupArea(label, name, required) {
    return '<div class="form-group span-2"><label>' + label + '</label><textarea name="' + name + '"' +
      (required ? " required" : "") + ">" + draftValue(name) + "</textarea></div>";
  }

  function lineFacts(items) {
    const filled = items.filter(function (item) { return item[1]; });
    if (!filled.length) return "";
    return '<dl class="member-line cols-' + filled.length + '">' +
      filled.map(function (item) { return fact(item[0], item[1]); }).join("") +
      "</dl>";
  }

  function licenceLine(member) {
    const forms = [
      ["f20", "Form 20 – Retail Allopathic", member.licence_f20, member.licence_f20_expires, member.licence_f20_url],
      ["f20c", "Form 20C – Homoeopathic Retail", member.licence_f20c, member.licence_f20c_expires, member.licence_f20c_url],
      ["f21", "Form 21 – Retail Schedule C/C(1)", member.licence_f21, member.licence_f21_expires, member.licence_f21_url],
      ["f21b", "Form 21B – Wholesale Schedule C/C(1)", member.licence_f21b, member.licence_f21b_expires, member.licence_f21b_url],
    ].filter(function (item) { return item[2]; });
    const history = DMA.licenceHistoryTable(member.licence_history);
    if (!forms.length) {
      return lineFacts([["Drug licence", member.drug_licence_no]]) + history;
    }
    return '<div class="licence-public-list">' + forms.map(function (item, index) {
      const till = item[3] ? '<div class="help">Valid till ' + esc(DMA.fmtDay(item[3])) + "</div>" : "";
      const preview = item[4] && !/\.pdf(\?|$)/i.test(item[4])
        ? '<img class="licence-preview" src="' + esc(item[4]) + '" alt="' + esc(item[1]) + ' copy">'
        : "";
      const copy = '<div class="licence-copy-row">' + preview + DMA.licenceCopyButton(item[4]) + DMA.previousCopyButtons(member.licence_history, item[0]) + "</div>";
      return '<div class="licence-public"><div class="licence-public-main"><span class="row-num">' + (index + 1) + '</span><div><div class="licence-public-name">' + esc(item[1]) + "</div><div class=\"licence-public-no\">" + esc(item[2]) + "</div>" + till + "</div></div>" + copy + "</div>";
    }).join("") + "</div>" + history;
  }

  function qualifiedLine(member) {
    return lineFacts([
      ["Qualified person", member.qualified_person_name],
      ["Registration", member.pharmacist_reg_no],
      ["Mobile", member.qualified_person_phone],
    ]) + lineFacts([
      ["Qualified person 2", member.qualified_person2_name],
      ["Registration", member.qualified_person2_reg],
      ["Mobile", member.qualified_person2_phone],
    ]);
  }

  function applicationFields(row, locked) {
    const photo = row.photo_url
      ? '<img class="owner-photo" src="' + esc(row.photo_url) + '" alt="Shop owner" data-licence-copy="' + esc(row.photo_url) + '">'
      : "";
    return textField("Name of the firm", "shop_name", row.shop_name, false) +
      '<div class="form-group full"><label>Address of the firm</label><textarea name="address" required>' + esc(row.address || "") + "</textarea></div>" +
      textField("Proprietor / partner 1", "owner_name", row.owner_name, false) +
      textField("Partner 2", "partner2_name", row.partner2_name, false) +
      textField("Partner 3", "partner3_name", row.partner3_name, false) +
      '<div class="form-group full"><label>Residential address of proprietor</label><textarea name="residential_address" required>' + esc(row.residential_address || "") + "</textarea></div>" +
      '<div class="form-group full"><label>Residential address of partner 2</label><textarea name="partner2_address">' + esc(row.partner2_address || "") + "</textarea></div>" +
      '<div class="form-group full"><label>Residential address of partner 3</label><textarea name="partner3_address">' + esc(row.partner3_address || "") + "</textarea></div>" +
      textField("Email", "email", row.email, false, "email") +
      DMA.licenceCards(row, locked) +
      textField("Qualified person name", "qualified_person_name", row.qualified_person_name, false) +
      textField("Qualified person registration", "pharmacist_reg_no", row.pharmacist_reg_no, false) +
      textField("Qualified person phone", "qualified_person_phone", row.qualified_person_phone, false, "tel") +
      '<div class="form-group full"><label>Qualified person address</label><textarea name="qualified_person_address" required>' + esc(row.qualified_person_address || "") + "</textarea></div>" +
      textField("Qualified person 2 name", "qualified_person2_name", row.qualified_person2_name, false) +
      textField("Qualified person 2 registration", "qualified_person2_reg", row.qualified_person2_reg, false) +
      textField("Qualified person 2 phone", "qualified_person2_phone", row.qualified_person2_phone, false, "tel") +
      '<div class="form-group full"><label>Qualified person 2 address</label><textarea name="qualified_person2_address">' + esc(row.qualified_person2_address || "") + "</textarea></div>" +
      '<div class="form-group full"><label>Passport-size photo</label><div class="licence-copy-row">' + photo +
      '<input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/gif"' + (row.photo_url || locked ? "" : " required") + '></div><span class="help">' +
      (locked ? "After approval, only the association can change a drug licence, its expiry, or its copy. " : "") +
      (row.photo_url ? "Upload a new photo only if you want to replace the current one." : "Passport-size photo of the shop owner is required.") +
      "</span></div>";
  }

  async function viewComplaints(params) {
    const status = params.get("status") || "";
    const rows = (await api.request("/complaints")).data;
    const notes = (await api.request("/notifications")).data;
    const statuses = (await api.request("/complaint-statuses")).data;
    const openCount = rows.filter(function (row) { return row.status !== "resolved"; }).length;
    const unread = notes.filter(function (row) { return !row.read_at; }).length;
    const shown = status ? rows.filter(function (row) { return row.status === status; }) : rows;
    const chips = '<div class="filters"><a class="' + (status === "" ? "active" : "") + '" href="#/complaints">All</a>' +
      statuses.map(function (item) {
        return '<a class="' + (status === item.code ? "active" : "") + '" href="#/complaints?status=' + encodeURIComponent(item.code) + '">' + esc(item.name) + "</a>";
      }).join("") + "</div>";
    const list = shown.length
      ? '<div class="admin-card table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Subject</th><th>Category</th><th>Status</th><th>Sent</th><th></th></tr></thead><tbody>' +
        complaintRows(shown) + "</tbody></table></div>"
      : '<div class="admin-card"><p class="empty">No complaints in this list.</p></div>';
    const canFile = state.member && state.member.status === "approved";
    return layout("Complaints",
      '<div class="section-head"><p class="help" style="margin:0">Track each complaint from Submitted to Resolved.</p>' +
      (canFile ? '<a class="icon-add" href="#/complaints/new" aria-label="Add complaint" title="Add complaint"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></a>' : "") + "</div>" +
      '<div class="stats"><div class="stat">' + statIcon("complaints") + '<div><div class="label">Complaints</div><div class="value">' + rows.length +
      '</div></div></div><div class="stat">' + statIcon("clock") + '<div><div class="label">Still open</div><div class="value">' + openCount +
      '</div></div></div><div class="stat">' + statIcon("bell") + '<div><div class="label">New updates</div><div class="value">' + unread +
      "</div></div></div></div>" + chips + list);
  }

  async function viewNewComplaint() {
    if (!state.member || state.member.status !== "approved") {
      return layout("Add complaint", '<div class="admin-card"><p>Complaints open after your drug licence is approved.</p><p><a class="btn btn-outline" href="#/">Back to home</a></p></div>');
    }
    const categories = (await api.request("/complaint-categories")).data;
    const options = categories.map(function (row) {
      return '<option value="' + row.id + '">' + esc(row.name) + "</option>";
    }).join("");
    return layout("Add complaint",
      '<form class="admin-card" id="complaint-form"><div class="form-grid">' +
      '<div class="form-group full"><label>Complaint category</label><select name="category_id" required><option value="">Choose a category</option>' +
      options + "</select></div>" +
      '<div class="form-group full"><label>Subject</label><input type="text" name="title" required minlength="5" maxlength="160"></div>' +
      '<div class="form-group full"><label>Detailed description</label><textarea name="details" required minlength="10"></textarea></div>' +
      '<div class="form-group full"><label>Upload image or document</label><input type="file" name="photo" accept="image/*,.pdf,application/pdf"><span class="help">Optional. JPG, PNG, WEBP, GIF, or PDF up to 5 MB.</span></div>' +
      '<div class="form-group full actions"><button class="btn" type="submit">Submit complaint</button><a class="btn btn-outline" href="#/complaints">Back</a></div></div></form>');
  }

  async function viewComplaint(id) {
    const row = (await api.request("/complaints/" + id)).data;
    try {
      await api.request("/notifications/read", { method: "POST", body: { complaint_id: Number(id) } });
    } catch (error) {
      if (error.unauthorized) throw error;
    }
    const reply = row.admin_reply
      ? '<div class="admin-card"><h2 style="margin:0 0 0.4rem;font-size:1rem">Association reply</h2><p>' + esc(row.admin_reply) +
        '</p><p class="help">' + fmtDate(row.replied_at) + "</p></div>"
      : '<div class="admin-card"><p class="empty">The association has not replied yet. You will see an update here when the status changes.</p></div>';
    const close = row.status === "resolved"
      ? ""
      : '<p class="actions"><button class="btn" type="button" id="close-ticket" data-id="' + Number(row.id) + '">Close ticket</button></p>';
    return layout(row.title,
      '<p class="actions"><a class="btn btn-sm btn-outline" href="#/complaints">All complaints</a></p>' +
      close +
      '<div class="admin-card"><dl class="member-facts">' +
      fact("Category", row.category_name) +
      "<div><dt>Status</dt><dd>" + badge(row.status, statusName(row)) + "</dd></div>" +
      fact("Sent", fmtDate(row.created_at)) +
      fact("Updated", fmtDate(row.updated_at)) +
      "</dl><h2 style=\"margin:1rem 0 0.4rem;font-size:1rem\">What happened</h2><p>" +
      esc(row.details) + "</p>" + attachmentHtml(row.photo_url) + "</div>" + reply);
  }

  function viewProfile() {
    const row = state.member;
    const locked = row.status === "approved";
    const intro = row.status === "approved"
      ? ""
      : '<div class="banner">Add the shop, drug licences, qualified person, and a passport photo. Complaints and notices open after the association verifies your account.</div>';
    return layout(row.status === "approved" ? "Shop details" : "My details",
      DMA.licenceAlert(row) +
      intro + '<section class="admin-card"><h2 style="margin:0 0 0.35rem;font-size:1.05rem">Membership application</h2><p class="help" style="margin-top:0">This is your filled CAF, including the passport photo.</p><div class="actions">' +
      DMA.applicationActions("/me/application", "dma_member_token", "icons") +
      '</div></section><form class="admin-card" id="profile-form"><div class="form-grid">' +
      '<div class="form-group"><label>Mobile</label><input value="' + esc(row.mobile) + '" disabled><span class="help">Mobile is the sign-in. Ask the association office to change it.</span></div>' +
      applicationFields(row, locked) +
      '<div class="form-group full"><button class="btn" type="submit">Save profile</button></div></div></form>' +
      (DMA.licenceHistoryTable(row.licence_history) ? '<section class="admin-card">' + DMA.licenceHistoryTable(row.licence_history) + "</section>" : ""));
  }

  function textField(label, name, value, disabled, type) {
    return '<div class="form-group"><label>' + label + '</label><input type="' + (type || "text") + '" name="' + name +
      '" value="' + esc(value || "") + '"' + (disabled ? ' readonly class="is-locked"' : "") + "></div>";
  }

  function bind(current) {
    const otpForm = document.getElementById("otp-form");
    if (otpForm) {
      const change = document.getElementById("change-number");
      if (change) {
        change.addEventListener("click", function (event) {
          event.preventDefault();
          sessionStorage.removeItem("dma_otp_mobile");
          sessionStorage.removeItem("dma_otp_mode");
          state.error = "";
          state.notice = "";
          boot();
        });
      }
      otpForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = event.target;
        const data = Object.fromEntries(new FormData(form).entries());
        form.querySelector("button").disabled = true;
        try {
          const purpose = route().path === "/signup" ? "register" : "login";
          const waiting = sessionStorage.getItem("dma_otp_mobile") && sessionStorage.getItem("dma_auth_purpose") === purpose;
          if (!waiting) {
            if (purpose === "register") {
              if (!String(data.owner_name || "").trim() || !String(data.email || "").trim()) {
                state.error = "Enter your name and email.";
                form.querySelector("button").disabled = false;
                boot();
                return;
              }
              sessionStorage.setItem("dma_signup", JSON.stringify({
                owner_name: data.owner_name,
                email: data.email,
                mobile: data.mobile,
              }));
            }
            const sent = await api.request("/auth/otp/send", {
              method: "POST",
              body: { mobile: data.mobile, purpose: purpose },
            });
            sessionStorage.setItem("dma_otp_mobile", sent.data.mobile);
            sessionStorage.setItem("dma_otp_mode", sent.data.mode || "");
            sessionStorage.setItem("dma_auth_purpose", purpose);
            state.error = "";
            state.notice = sent.data.mode === "routemobile" ? "OTP sent by SMS." : "Message saved in SMS Manager.";
            boot();
            return;
          }
          const verified = await api.request("/auth/otp/verify", {
            method: "POST",
            body: { mobile: sessionStorage.getItem("dma_otp_mobile"), otp: data.otp, purpose: purpose },
          });
          sessionStorage.removeItem("dma_otp_mobile");
          sessionStorage.removeItem("dma_otp_mode");
          sessionStorage.removeItem("dma_auth_purpose");
          if (purpose === "register") {
            const draft = signupDraft();
            const result = await api.request("/auth/register", {
              method: "POST",
              body: { owner_name: draft.owner_name, email: draft.email },
              token: verified.data.registration_token,
            });
            sessionStorage.removeItem("dma_signup");
            api.setToken(result.data.token);
            state.member = result.data.member;
            state.notice = "Account created. Add your shop details. Other menus open after verification.";
            state.error = "";
            go("#/profile");
            return;
          }
          api.setToken(verified.data.token);
          state.member = verified.data.member;
          state.notice = "";
          state.error = "";
          go("#/");
        } catch (error) {
          state.error = error.message;
          form.querySelector("button").disabled = false;
          boot();
        }
      });
    }

    const closeTicket = document.getElementById("close-ticket");
    if (closeTicket) {
      closeTicket.addEventListener("click", async function () {
        if (!window.confirm("Close this ticket? It will be marked resolved.")) return;
        closeTicket.disabled = true;
        try {
          await api.request("/complaints/" + closeTicket.dataset.id + "/close", { method: "POST", body: {} });
          state.notice = "Ticket closed.";
          state.error = "";
          boot();
        } catch (error) {
          state.error = error.message;
          closeTicket.disabled = false;
          boot();
        }
      });
    }

    const complaintForm = document.getElementById("complaint-form");
    if (complaintForm) {
      complaintForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        if (!data.get("photo") || !data.get("photo").name) data.delete("photo");
        form.querySelector("button").disabled = true;
        try {
          await api.request("/complaints", { method: "POST", form: data });
          state.notice = "Complaint submitted.";
          state.error = "";
          go("#/complaints");
        } catch (error) {
          if (error.unauthorized) {
            location.hash = "#/login";
            return;
          }
          state.error = error.message;
          form.querySelector("button").disabled = false;
          boot();
        }
      });
    }

    const markRead = document.getElementById("mark-read");
    if (markRead) {
      markRead.addEventListener("click", async function () {
        markRead.disabled = true;
        try {
          await api.request("/notifications/read", { method: "POST", body: {} });
          state.notice = "Updates marked as read.";
          state.error = "";
          boot();
        } catch (error) {
          if (error.unauthorized) return;
          state.error = error.message;
          boot();
        }
      });
    }

    const profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = event.target;
        const data = new FormData(form);
        DMA.dropEmptyFiles(data, ["photo"].concat(DMA.licenceFileFields));
        form.querySelector("button").disabled = true;
        try {
          state.member = (await api.request("/me", { method: "POST", form: data })).data;
          state.notice = "Profile saved.";
          state.error = "";
          boot();
        } catch (error) {
          if (error.unauthorized) {
            location.hash = "#/login";
            return;
          }
          state.error = error.message;
          form.querySelector("button").disabled = false;
          boot();
        }
      });
    }
  }

  async function boot() {
    const mine = ++runId;
    const app = document.getElementById("app");
    const current = route();
    try {
      await loadAssociation();
      if (mine !== runId) return;
      if (current.path === "/logout") {
        try { await api.request("/auth/logout", { method: "POST" }); } catch (error) { /* token may already be gone */ }
        api.setToken("");
        state.member = null;
        location.hash = "#/";
        return;
      }
      if (api.token()) {
        try {
          state.member = (await api.request("/me")).data;
        } catch (error) {
          if (!error.unauthorized) throw error;
          state.member = null;
        }
      } else {
        state.member = null;
      }
      if (mine !== runId) return;
      if ((current.path === "/complaints" || current.path.startsWith("/complaints/") || current.path === "/profile") && !state.member) {
        location.hash = "#/login";
        return;
      }
      if (state.member && state.member.status !== "approved" && (current.path === "/complaints" || current.path.startsWith("/complaints/") || current.path === "/notices")) {
        location.hash = "#/";
        return;
      }
      if ((current.path === "/login" || current.path === "/signup") && state.member) {
        location.hash = "#/";
        return;
      }
      if (current.path === "/register") {
        location.hash = "#/signup";
        return;
      }
      let html = "";
      if (current.path === "/login" || current.path === "/signup") {
        html = authScreen(current.path === "/signup" ? "register" : "login");
      } else {
        document.body.className = "";
        if (current.parts.length === 0) html = await viewHome();
        else if (current.path === "/notices") html = await viewNotices();
        else if (current.path === "/complaints/new") html = await viewNewComplaint();
        else if (current.parts[0] === "complaints" && current.parts[1]) html = await viewComplaint(current.parts[1]);
        else if (current.path === "/complaints") html = await viewComplaints(current.params);
        else if (current.path === "/contact") html = viewContact();
        else if (current.path === "/profile") html = viewProfile();
        else html = layout("Not found", '<div class="admin-card"><p>That page does not exist.</p></div>');
      }
      if (mine !== runId) return;
      app.innerHTML = html;
      bind(current);
      if (current.path !== "/login" && current.path !== "/signup") {
        state.error = "";
        state.notice = "";
      }
    } catch (error) {
      if (mine !== runId) return;
      if (error.unauthorized) {
        location.hash = "#/login";
        return;
      }
      document.body.className = "";
      state.error = error.message;
      app.innerHTML = layout("Something went wrong", '<div class="admin-card"><p>' + esc(error.message) + "</p></div>");
    }
  }

  window.addEventListener("hashchange", function () {
    if (!location.hash.startsWith("#/login") && !location.hash.startsWith("#/signup")) state.error = "";
    boot();
  });
  if (!location.hash) location.hash = "#/";
  else boot();
})();
