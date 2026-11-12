(function (global) {
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fmtDate(value) {
    const date = parseDate(value);
    if (!date) return value ? String(value) : "—";
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fmtDay(value) {
    if (!value) return "—";
    const date = parseDate(String(value).slice(0, 10) + "T00:00:00");
    if (!date) return String(value);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.origin);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function createClient(tokenKey, onUnauthorized) {
    return {
      token: function () {
        return localStorage.getItem(tokenKey) || "";
      },
      setToken: function (token) {
        if (token) localStorage.setItem(tokenKey, token);
        else localStorage.removeItem(tokenKey);
      },
      request: async function (path, options) {
        const opts = options || {};
        const override = Object.prototype.hasOwnProperty.call(opts, "token");
        const token = override ? opts.token || "" : this.token();
        const headers = {};
        if (token) headers.Authorization = "Bearer " + token;
        let body;
        if (opts.form) {
          body = opts.form;
        } else if (opts.body) {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(opts.body);
        }
        let response;
        try {
          response = await fetch("/api" + path, { method: opts.method || "GET", headers: headers, body: body });
        } catch (error) {
          throw new Error("Cannot reach the server.");
        }
        let payload = {};
        try {
          payload = await response.json();
        } catch (error) {
          payload = { ok: false, error: "Unexpected server response." };
        }
        if (response.status === 401 && token && !override) {
          this.setToken("");
          if (onUnauthorized) onUnauthorized();
          const unauthorized = new Error(payload.error || "Please sign in again.");
          unauthorized.unauthorized = true;
          throw unauthorized;
        }
        if (!response.ok || payload.ok === false) {
          const failure = new Error(payload.error || "Request failed.");
          failure.status = response.status;
          throw failure;
        }
        return payload;
      },
    };
  }

  function flyerButton(row) {
    const href = safeUrl(row.link_url);
    return '<button type="button" class="flyer-open" data-flyer="' + esc(row.image_url) + '" data-title="' + esc(row.title) + '"' +
      (href ? ' data-link="' + esc(href) + '"' : "") + ">" +
      '<img src="' + esc(row.image_url) + '" alt="' + esc(row.title) + '"></button>';
  }

  function ensureFlyerView() {
    let dialog = document.getElementById("flyer-view");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "flyer-view";
    dialog.className = "flyer-view";
    dialog.innerHTML = '<form method="dialog" class="flyer-view-bar"><p></p><button class="btn btn-sm btn-outline" type="submit">Close</button></form>' +
      '<img alt=""><p class="flyer-view-link"></p>';
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openFlyer(src, title, link) {
    const dialog = ensureFlyerView();
    const image = dialog.querySelector("img");
    image.src = src;
    image.alt = title || "Flyer";
    dialog.querySelector(".flyer-view-bar p").textContent = title || "Flyer";
    const extra = dialog.querySelector(".flyer-view-link");
    extra.innerHTML = link
      ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">Open link</a>'
      : "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else window.open(src, "_blank", "noopener");
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest(".flyer-open");
    if (!button) return;
    event.preventDefault();
    openFlyer(button.getAttribute("data-flyer"), button.getAttribute("data-title") || "", button.getAttribute("data-link") || "");
  });

  function applicationActions(path, tokenKey, small) {
    if (small === "icons") {
      const eye = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5c5.2 0 9.3 4.1 10.7 6a1.6 1.6 0 0 1 0 2C21.3 14.9 17.2 19 12 19S2.7 14.9 1.3 13a1.6 1.6 0 0 1 0-2C2.7 9.1 6.8 5 12 5zm0 2C8.1 7 4.8 10.2 3.5 12 4.8 13.8 8.1 17 12 17s7.2-3.2 8.5-5C19.2 10.2 15.9 7 12 7zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/></svg>';
      const download = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L11 12.6V4a1 1 0 0 1 1-1zM5 17a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/></svg>';
      function iconButton(label, icon, downloadFlag) {
        return '<button class="row-icon" type="button" title="' + esc(label) + '" aria-label="' + esc(label) + '" data-application="' + esc(path) + '" data-token-key="' + esc(tokenKey) + '"' + (downloadFlag ? ' data-download="1"' : "") + ">" + icon + "</button>";
      }
      return '<span class="row-icons">' + iconButton("View application PDF", eye, false) + iconButton("Download application PDF", download, true) + "</span>";
    }
    const viewClass = small ? "btn btn-sm" : "btn";
    const downloadClass = small ? "btn btn-sm btn-secondary" : "btn btn-secondary";
    return '<button class="' + viewClass + '" type="button" data-application="' + esc(path) + '" data-token-key="' + esc(tokenKey) + '">View application PDF</button>' +
      '<button class="' + downloadClass + '" type="button" data-application="' + esc(path) + '" data-token-key="' + esc(tokenKey) + '" data-download="1">Download application PDF</button>';
  }

  function ensurePdfView() {
    let dialog = document.getElementById("pdf-view");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "pdf-view";
    dialog.className = "pdf-view";
    dialog.innerHTML = '<form method="dialog" class="flyer-view-bar"><p>Membership application</p><button class="btn btn-sm btn-outline" type="submit">Close</button></form><iframe title="Membership application"></iframe>';
    dialog.addEventListener("close", function () {
      const frame = dialog.querySelector("iframe");
      if (frame.dataset.blob) URL.revokeObjectURL(frame.dataset.blob);
      frame.removeAttribute("src");
      delete frame.dataset.blob;
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function showPdfError(message) {
    let flash = document.getElementById("pdf-error");
    if (!flash) {
      flash = document.createElement("div");
      flash.id = "pdf-error";
      flash.className = "flash flash-error";
      const app = document.getElementById("app");
      if (app) app.prepend(flash);
    }
    flash.textContent = message;
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-application]");
    if (!button || button.disabled) return;
    event.preventDefault();
    const path = button.getAttribute("data-application") || "";
    const download = button.getAttribute("data-download") === "1";
    const token = localStorage.getItem(button.getAttribute("data-token-key") || "") || "";
    button.disabled = true;
    fetch("/api" + path + (download ? "?download=1" : ""), {
      headers: token ? { Authorization: "Bearer " + token } : {},
    }).then(async function (response) {
      const type = response.headers.get("Content-Type") || "";
      if (!response.ok || type.indexOf("pdf") === -1) {
        let message = "The application PDF could not be opened.";
        try {
          const payload = await response.json();
          if (payload.error) message = payload.error;
        } catch (error) { /* not json */ }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (download) {
        const named = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "");
        const link = document.createElement("a");
        link.href = url;
        link.download = named ? named[1] : "membership-application.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        return;
      }
      const dialog = ensurePdfView();
      dialog.querySelector(".flyer-view-bar p").textContent = "Membership application";
      const frame = dialog.querySelector("iframe");
      if (frame.dataset.blob) URL.revokeObjectURL(frame.dataset.blob);
      frame.dataset.blob = url;
      frame.src = url;
      dialog.showModal();
    }).catch(function (error) {
      showPdfError(error.message || "The application PDF could not be opened.");
    }).finally(function () {
      button.disabled = false;
    });
  });

  function licenceCopyButton(url, label, outline) {
    if (!url) return "";
    return '<button class="btn btn-sm ' + (outline ? "btn-outline" : "btn-secondary") + '" type="button" data-licence-copy="' + esc(url) + '">' + esc(label || "View licence copy") + "</button>";
  }

  function previousCopyButtons(history, code) {
    const items = (history || []).filter(function (item) {
      return item.form_code === code && item.image_url;
    });
    return items.map(function (item) {
      const label = items.length > 1 && item.replaced_at ? "Previous · " + fmtDate(item.replaced_at) : "Previous copy";
      return licenceCopyButton(item.image_url, label, true);
    }).join("");
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-licence-copy]");
    if (!button) return;
    event.preventDefault();
    const url = button.getAttribute("data-licence-copy") || "";
    if (!url) return;
    if (/\.pdf(\?|$)/i.test(url)) {
      const dialog = ensurePdfView();
      dialog.querySelector(".flyer-view-bar p").textContent = "Licence copy";
      const frame = dialog.querySelector("iframe");
      if (frame.dataset.blob) URL.revokeObjectURL(frame.dataset.blob);
      delete frame.dataset.blob;
      frame.src = url;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else window.open(url, "_blank", "noopener");
      return;
    }
    openFlyer(url, "Licence copy", "");
  });

  const licenceFileFields = ["licence_f20_file", "licence_f20c_file", "licence_f21_file", "licence_f21b_file"];

  function dropEmptyFiles(data, names) {
    (names || []).forEach(function (name) {
      const file = data.get(name);
      if (!file || !file.name) data.delete(name);
    });
  }

  const licenceTypes = [
    ["Form 20 – Retail Allopathic", "licence_f20", "licence_f20_expires", "licence_f20_file", "licence_f20_url"],
    ["Form 20C – Homoeopathic Retail", "licence_f20c", "licence_f20c_expires", "licence_f20c_file", "licence_f20c_url"],
    ["Form 21 – Retail Schedule C/C(1)", "licence_f21", "licence_f21_expires", "licence_f21_file", "licence_f21_url"],
    ["Form 21B – Wholesale Schedule C/C(1)", "licence_f21b", "licence_f21b_expires", "licence_f21b_file", "licence_f21b_url"],
  ];

  function licenceCards(row, locked) {
    return licenceTypes.map(function (form, index) {
      const url = row[form[4]] || "";
      const preview = !url || /\.pdf(\?|$)/i.test(url)
        ? ""
        : '<img class="licence-preview" src="' + esc(url) + '" alt="' + esc(form[0]) + ' copy">';
      return '<section class="licence-card"><h3><span class="row-num">' + (index + 1) + "</span>" + esc(form[0]) + "</h3><div class=\"form-grid\">" +
        '<div class="form-group"><label>Licence number</label><input type="text" name="' + form[1] + '" value="' + esc(row[form[1]] || "") + '"' + (locked ? ' readonly class="is-locked"' : "") + "></div>" +
        '<div class="form-group"><label>Expiry date</label><input type="date" name="' + form[2] + '" value="' + esc(String(row[form[2]] || "").slice(0, 10)) + '"' + (locked ? ' readonly class="is-locked"' : "") + "></div>" +
        '<div class="form-group full"><label>Licence copy</label><div class="licence-copy-row">' +
        preview + licenceCopyButton(url) + previousCopyButtons(row.licence_history, form[1].replace(/^licence_/, "")) +
        (locked ? "" : '<input type="file" name="' + form[3] + '" accept="image/png,image/jpeg,image/webp,image/gif,.pdf,application/pdf">') +
        "</div>" + (locked ? (url ? "" : '<span class="help">No copy uploaded.</span>') : '<span class="help">' + (url ? "Choose a new file only to replace the saved copy." : "Optional. JPG, PNG, WEBP, GIF, or PDF up to 5 MB.") + "</span>") +
        "</div></section>";
    }).join("");
  }

  function licenceHistoryTable(rows) {
    if (!rows || !rows.length) return "";
    const body = rows.map(function (row, index) {
      const copy = row.image_url ? licenceCopyButton(row.image_url) : "—";
      const kind = row.status === "removed" ? "badge-off" : "badge-followup";
      return '<tr><td class="num">' + (index + 1) + "</td><td>" + esc(row.form_label) + "</td><td>" + esc(row.licence_no) + "</td><td>" +
        fmtDay(row.expires_on) + '</td><td><span class="badge ' + kind + '">' + esc(row.status_label || "Updated") +
        "</span></td><td>" + fmtDate(row.replaced_at) + "</td><td>" + copy + "</td></tr>";
    }).join("");
    return '<div class="licence-history"><h3>Previous licences</h3><div class="table-wrap"><table class="member-table"><thead><tr><th class="num">#</th><th>Form</th><th>Licence number</th><th>Expiry</th><th>Status</th><th>Changed</th><th>Copy</th></tr></thead><tbody>' +
      body + "</tbody></table></div></div>";
  }

  function expiringLicences(member) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return licenceTypes.map(function (form) {
      const number = member[form[1]];
      const expires = String(member[form[2]] || "").slice(0, 10);
      if (!number || !expires) return null;
      const when = new Date(expires + "T00:00:00");
      if (Number.isNaN(when.getTime())) return null;
      const days = Math.round((when.getTime() - today.getTime()) / 86400000);
      if (days < 0 || days > 90) return null;
      return { label: form[0], number: number, expires: expires, days: days };
    }).filter(Boolean);
  }

  function licenceAlert(member) {
    if (!member) return "";
    const rows = expiringLicences(member);
    if (!rows.length) return "";
    const items = rows.map(function (row) {
      const when = row.days === 0
        ? "expires today"
        : "expires on " + fmtDay(row.expires) + " (" + row.days + (row.days === 1 ? " day" : " days") + " left)";
      return "<li><strong>" + esc(row.label) + "</strong> · " + esc(row.number) + " " + when + ".</li>";
    }).join("");
    return '<section class="admin-card licence-alert"><h2>Licence renewal</h2><p>These licences expire within the next 90 days.</p><ul>' + items + "</ul></section>";
  }

  global.DMA = {
    esc: esc,
    fmtDate: fmtDate,
    fmtDay: fmtDay,
    safeUrl: safeUrl,
    createClient: createClient,
    flyerButton: flyerButton,
    applicationActions: applicationActions,
    licenceFileFields: licenceFileFields,
    dropEmptyFiles: dropEmptyFiles,
    licenceCopyButton: licenceCopyButton,
    previousCopyButtons: previousCopyButtons,
    licenceCards: licenceCards,
    licenceHistoryTable: licenceHistoryTable,
    licenceAlert: licenceAlert,
  };
})(window);
