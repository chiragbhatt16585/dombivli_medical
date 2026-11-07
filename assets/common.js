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

  global.DMA = {
    esc: esc,
    fmtDate: fmtDate,
    fmtDay: fmtDay,
    safeUrl: safeUrl,
    createClient: createClient,
    flyerButton: flyerButton,
    applicationActions: applicationActions,
  };
})(window);
