
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

  if (!Array.isArray(repositories) || repositories.length === 0) {
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
    const firstFeatured =
      first.name.toLowerCase() === featuredName;
    const secondFeatured =
      second.name.toLowerCase() === featuredName;

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
      const name = escapeHTML(repository.name);
      const description = escapeHTML(
        repository.description || "No description provided yet."
      );
      const language = escapeHTML(repository.language || "Other");
      const stars = Number(repository.stargazers_count) || 0;
      const forks = Number(repository.forks_count) || 0;
      const url = String(repository.html_url || "");
      const validUrl =
        url.startsWith("https://github.com/") ? url : "#";
      const isFeatured =
        repository.name.toLowerCase() === featuredName;

      return `
        <article class="project-card${isFeatured ? " project-card-featured" : ""}">
          <div class="project-card-top">
            <span class="project-language">${language}</span>
            ${isFeatured ? '<span class="project-featured">Featured</span>' : ""}
          </div>
          <h3>${name}</h3>
          <p>${description}</p>
          <div class="project-stats">
            <span>★ ${stars} stars</span>
            <span>⑂ ${forks} forks</span>
          </div>
          <a
            class="project-link"
            href="${escapeHTML(validUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            ${validUrl === "#" ? 'aria-disabled="true"' : ""}
          >
            View repository <span aria-hidden="true">↗</span>
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
        "AI-powered Discord server assistant with secure automation, moderation, AI provider fallback, and human approval workflows.",
      language: "Python",
      stargazers_count: 0,
      forks_count: 0,
      html_url: "https://github.com/aceyen0969-new/Quasar",
      updated_at: "",
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

    if (!result || !Array.isArray(result.projects)) {
      throw new Error("The project service returned invalid data.");
    }

    renderProjects(result.projects);

    if (result.github_available === false) {
      const notice = document.createElement("p");
      notice.className = "projects-message";
      notice.textContent =
        "GitHub is temporarily unavailable. Showing cached or featured projects.";

      projectGrid.prepend(notice);
    }
  } catch (error) {
    console.error("Project loading failed:", error);

    renderFeaturedFallback();

    const notice = document.createElement("p");
    notice.className = "projects-message";
    notice.textContent =
      "Some projects could not be loaded. You can still visit the featured repository.";

    projectGrid.prepend(notice);
  } finally {
    projectGrid.setAttribute("aria-busy", "false");
  }
}

function initializeContactForm() {
  if (!contactForm || !formNote) {
    return;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector(
      'button[type="submit"], button:not([type])'
    );

    const formData = new FormData(contactForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const company = String(formData.get("company") || "").trim();

    formNote.textContent = "";

    if (!name || !email || !message) {
      formNote.textContent = "Please complete every field.";
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
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
