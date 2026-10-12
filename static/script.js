
const SITE_CONFIG = {
  githubUsername: "aceyen0969-new",
  featuredRepository: "quasar"
};

const contactForm = document.querySelector("#contact-form");
const formNote = document.querySelector("#form-note");
const projectGrid = document.querySelector("#project-grid");

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });

function initializeNavigation() {
  const menuToggle = document.querySelector("#menu-toggle");
  const navLinks = document.querySelector("#nav-links");

  if (!menuToggle || !navLinks) {
    return;
  }

  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
  };

  menuToggle.addEventListener("click", () => {
    const isExpanded =
      menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    navLinks.classList.toggle("is-open", !isExpanded);
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      !navLinks.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      closeMenu();
    }
  });
}

function initializeFooter() {
  const yearElement = document.querySelector("#current-year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

function renderProjects(repositories) {
  if (!projectGrid) {
    return;
  }

  if (!repositories.length) {
    projectGrid.innerHTML = `
      <p class="projects-message">
        No public projects were returned.
        Visit GitHub to browse all repositories.
      </p>
    `;
    projectGrid.setAttribute("aria-busy", "false");
    return;
  }

  const featuredName = SITE_CONFIG.featuredRepository.toLowerCase();

  const orderedRepositories = [...repositories].sort((first, second) => {
    const firstFeatured = first.name.toLowerCase() === featuredName;
    const secondFeatured = second.name.toLowerCase() === featuredName;

    if (firstFeatured !== secondFeatured) {
      return firstFeatured ? -1 : 1;
    }

    return (
      new Date(second.updated_at || 0).getTime() -
      new Date(first.updated_at || 0).getTime()
    );
  });

  projectGrid.innerHTML = orderedRepositories
    .map((repository) => {
      const isFeatured = repository.name.toLowerCase() === featuredName;
      const name = escapeHTML(repository.name);
      const description = escapeHTML(
        repository.description ||
          "Explore this project on GitHub."
      );
      const language = escapeHTML(repository.language || "Various");
      const stars = Number(repository.stargazers_count) || 0;
      const forks = Number(repository.forks_count) || 0;
      const url = escapeHTML(repository.html_url);
      const cardClass = isFeatured
        ? "project-card project-card-featured"
        : "project-card";
      const label = isFeatured
        ? "Featured project"
        : "Public repository";

      return `
        <article class="${cardClass}">
          <div class="project-card-top">
            <span class="project-icon" aria-hidden="true">&lt;/&gt;</span>
            <span class="project-visibility">${label}</span>
          </div>

          <h3>${name}</h3>

          <p class="project-description">${description}</p>

          <div class="project-meta">
            <span class="project-language">
              <span class="language-dot" aria-hidden="true"></span>
              ${language}
            </span>
            <span>★ ${stars}</span>
            <span>⑂ ${forks}</span>
          </div>

          <a
            class="project-link"
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View ${name} on GitHub"
          >
            View project <span>↗</span>
          </a>
        </article>
      `;
    })
    .join("");

  projectGrid.setAttribute("aria-busy", "false");
}

function renderFeaturedFallback() {
  renderProjects([
    {
      name: "quasar",
      description:
        "My Discord AI assistant project, featuring multi-provider AI fallback and approval-based workflows.",
      language: "Python",
      stargazers_count: 0,
      forks_count: 0,
      html_url: "https://github.com/aceyen0969-new/quasar",
      featured: true
    }
  ]);
}

async function initializeProjects() {
  if (!projectGrid) {
    return;
  }

  projectGrid.setAttribute("aria-busy", "true");
  projectGrid.innerHTML = `
    <p class="projects-message">Loading repositories from GitHub...</p>
  `;

  try {
    const response = await fetch("/api/projects", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `The project service returned HTTP ${response.status}.`
      );
    }

    const result = await response.json();

    if (!Array.isArray(result.projects)) {
      throw new Error("The project service returned invalid data.");
    }

    renderProjects(result.projects);

    if (result.github_available === false) {
      const notice = document.createElement("p");
      notice.className = "projects-message";
      notice.textContent =
        "GitHub is temporarily unavailable. Showing the featured project or cached repositories.";

      projectGrid.prepend(notice);
    }
  } catch (error) {
    console.error("Failed to load portfolio projects:", error);
    renderFeaturedFallback();

    const notice = document.createElement("p");
    notice.className = "projects-message";
    notice.textContent =
      "Other repositories could not be loaded right now. Quasar is still available below.";

    projectGrid.prepend(notice);
  }
}

function initializeContactForm() {
  if (!contactForm || !formNote) {
    return;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector(
      'button[type="submit"]'
    );

    const nameInput = document.querySelector("#sender-name");
    const emailInput = document.querySelector("#sender-email");
    const messageInput = document.querySelector("#sender-message");
    const companyInput = document.querySelector("#company");

    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    const message = messageInput?.value.trim() || "";
    const company = companyInput?.value.trim() || "";

    if (!name || !email || !message) {
      formNote.textContent = "Please complete all fields.";
      return;
    }

    if (name.length > 80 || email.length > 150 || message.length > 3000) {
      formNote.textContent = "One or more fields are too long.";
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formNote.textContent = "Please enter a valid email address.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    formNote.textContent = "Sending your message...";

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          message,
          company
        })
      });

      let result;

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Your message could not be sent."
        );
      }

      contactForm.reset();
      formNote.textContent =
        result.message || "Your message was sent successfully.";
    } catch (error) {
      console.error("Contact form submission failed:", error);
      formNote.textContent =
        error.message ||
        "Unable to send your message. Please try again later.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Send message <span>↗</span>';
      }
    }
  });
}

initializeNavigation();
initializeFooter();
initializeProjects();
initializeContactForm();

const SITE_CONFIG = {
  githubUsername: "aceyen0969-new",
  featuredRepository: "quasar"
};

const contactForm = document.querySelector("#contact-form");
const formNote = document.querySelector("#form-note");
const projectGrid = document.querySelector("#project-grid");

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });

function initializeNavigation() {
  const menuToggle = document.querySelector("#menu-toggle");
  const navLinks = document.querySelector("#nav-links");

  if (!menuToggle || !navLinks) {
    return;
  }

  const closeMenu = () => {
    menuToggle.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
  };

  menuToggle.addEventListener("click", () => {
    const isExpanded =
      menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    navLinks.classList.toggle("is-open", !isExpanded);
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      !navLinks.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      closeMenu();
    }
  });
}

function initializeFooter() {
  const yearElement = document.querySelector("#current-year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

function renderProjects(repositories) {
  if (!projectGrid) {
    return;
  }

  if (!repositories.length) {
    projectGrid.innerHTML = `
      <p class="projects-message">
        No public projects were returned.
        Visit GitHub to browse all repositories.
      </p>
    `;
    projectGrid.setAttribute("aria-busy", "false");
    return;
  }

  const featuredName = SITE_CONFIG.featuredRepository.toLowerCase();

  const orderedRepositories = [...repositories].sort((first, second) => {
    const firstFeatured = first.name.toLowerCase() === featuredName;
    const secondFeatured = second.name.toLowerCase() === featuredName;

    if (firstFeatured !== secondFeatured) {
      return firstFeatured ? -1 : 1;
    }

    return (
      new Date(second.updated_at || 0).getTime() -
      new Date(first.updated_at || 0).getTime()
    );
  });

  projectGrid.innerHTML = orderedRepositories
    .map((repository) => {
      const isFeatured = repository.name.toLowerCase() === featuredName;
      const name = escapeHTML(repository.name);
      const description = escapeHTML(
        repository.description ||
          "Explore this project on GitHub."
      );
      const language = escapeHTML(repository.language || "Various");
      const stars = Number(repository.stargazers_count) || 0;
      const forks = Number(repository.forks_count) || 0;
      const url = escapeHTML(repository.html_url);
      const cardClass = isFeatured
        ? "project-card project-card-featured"
        : "project-card";
      const label = isFeatured
        ? "Featured project"
        : "Public repository";

      return `
        <article class="${cardClass}">
          <div class="project-card-top">
            <span class="project-icon" aria-hidden="true">&lt;/&gt;</span>
            <span class="project-visibility">${label}</span>
          </div>

          <h3>${name}</h3>

          <p class="project-description">${description}</p>

          <div class="project-meta">
            <span class="project-language">
              <span class="language-dot" aria-hidden="true"></span>
              ${language}
            </span>
            <span>★ ${stars}</span>
            <span>⑂ ${forks}</span>
          </div>

          <a
            class="project-link"
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View ${name} on GitHub"
          >
            View project <span>↗</span>
          </a>
        </article>
      `;
    })
    .join("");

  projectGrid.setAttribute("aria-busy", "false");
}

function renderFeaturedFallback() {
  renderProjects([
    {
      name: "quasar",
      description:
        "My Discord AI assistant project, featuring multi-provider AI fallback and approval-based workflows.",
      language: "Python",
      stargazers_count: 0,
      forks_count: 0,
      html_url: "https://github.com/aceyen0969-new/quasar",
      featured: true
    }
  ]);
}

async function initializeProjects() {
  if (!projectGrid) {
    return;
  }

  projectGrid.setAttribute("aria-busy", "true");
  projectGrid.innerHTML = `
    <p class="projects-message">Loading repositories from GitHub...</p>
  `;

  try {
    const response = await fetch("/api/projects", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `The project service returned HTTP ${response.status}.`
      );
    }

    const result = await response.json();

    if (!Array.isArray(result.projects)) {
      throw new Error("The project service returned invalid data.");
    }

    renderProjects(result.projects);

    if (result.github_available === false) {
      const notice = document.createElement("p");
      notice.className = "projects-message";
      notice.textContent =
        "GitHub is temporarily unavailable. Showing the featured project or cached repositories.";

      projectGrid.prepend(notice);
    }
  } catch (error) {
    console.error("Failed to load portfolio projects:", error);
    renderFeaturedFallback();

    const notice = document.createElement("p");
    notice.className = "projects-message";
    notice.textContent =
      "Other repositories could not be loaded right now. Quasar is still available below.";

    projectGrid.prepend(notice);
  }
}

function initializeContactForm() {
  if (!contactForm || !formNote) {
    return;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector(
      'button[type="submit"]'
    );

    const nameInput = document.querySelector("#sender-name");
    const emailInput = document.querySelector("#sender-email");
    const messageInput = document.querySelector("#sender-message");
    const companyInput = document.querySelector("#company");

    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    const message = messageInput?.value.trim() || "";
    const company = companyInput?.value.trim() || "";

    if (!name || !email || !message) {
      formNote.textContent = "Please complete all fields.";
      return;
    }

    if (name.length > 80 || email.length > 150 || message.length > 3000) {
      formNote.textContent = "One or more fields are too long.";
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formNote.textContent = "Please enter a valid email address.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    formNote.textContent = "Sending your message...";

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          email,
          message,
          company
        })
      });

      let result;

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Your message could not be sent."
        );
      }

      contactForm.reset();
      formNote.textContent =
        result.message || "Your message was sent successfully.";
    } catch (error) {
      console.error("Contact form submission failed:", error);
      formNote.textContent =
        error.message ||
        "Unable to send your message. Please try again later.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Send message <span>↗</span>';
      }
    }
  });
}

initializeNavigation();
initializeFooter();
initializeProjects();
initializeContactForm();
