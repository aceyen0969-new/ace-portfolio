const SITE_CONFIG = {
  githubUsername: "aceyen0969-new",
  featuredRepository: "quasar",
  projectsEndpoint: "/api/projects",
  contactEndpoint: "/api/contact"
};

const contactForm = document.querySelector("#contact-form");
const formNote = document.querySelector("#form-note");
const projectGrid = document.querySelector("#project-grid");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function safeImageURL(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(String(value));

    if (url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function initializeNavigation() {
  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".nav-links");

  if (!menuToggle || !navigation) {
    return;
  }

  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    navigation.classList.toggle("active", !isExpanded);
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navigation.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initializeFooter() {
  const yearElement = document.querySelector("#current-year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

function initializeProjectImages() {
  if (!projectGrid) {
    return;
  }

  projectGrid.querySelectorAll(".project-preview-image").forEach((image) => {
    image.addEventListener(
      "error",
      () => {
        image.closest(".project-preview")?.remove();
      },
      { once: true }
    );
  });
}

function renderProjects(repositories) {
  if (!projectGrid) {
    return;
  }

  if (!Array.isArray(repositories) || repositories.length === 0) {
    projectGrid.innerHTML = `
      <p class="projects-message">
        No public projects are available to display yet.
      </p>
    `;

    projectGrid.setAttribute("aria-busy", "false");
    return;
  }

  const featuredName = SITE_CONFIG.featuredRepository.toLowerCase();

  const orderedRepositories = [...repositories].sort((first, second) => {
    const firstFeatured = first.name?.toLowerCase() === featuredName;
    const secondFeatured = second.name?.toLowerCase() === featuredName;

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
      const name = escapeHTML(repository.name || "Untitled project");
      const description = escapeHTML(
        repository.description || "Explore this project on GitHub."
      );
      const language = escapeHTML(repository.language || "Various");
      const stars = Number(repository.stargazers_count) || 0;
      const forks = Number(repository.forks_count) || 0;
      const rawUrl = String(repository.html_url || "");
      const imageUrl = safeImageURL(repository.image_url);

      const validUrl = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(
        rawUrl
      );

      const url = validUrl ? rawUrl : "#";
      const isFeatured = repository.name?.toLowerCase() === featuredName;

      const preview = imageUrl
        ? `
          <div class="project-preview">
            <img
              class="project-preview-image"
              src="${escapeHTML(imageUrl)}"
              alt="Preview image for ${name}"
              loading="lazy"
              decoding="async"
            >
          </div>
        `
        : "";

      return `
        <article class="project-card">
          ${preview}

          <div class="project-card-top">
            <span class="project-icon" aria-hidden="true">&lt;/&gt;</span>
            <span class="project-visibility">
              ${isFeatured ? "Featured project" : "Public repository"}
            </span>
          </div>

          <h3>${name}</h3>

          <p class="project-description">${description}</p>

          <div class="project-meta">
            <span class="project-language">
              <span class="language-dot" aria-hidden="true"></span>
              ${language}
            </span>

            <span>&#9733; ${stars}</span>
            <span>&#9398; ${forks}</span>
          </div>

          <a
            class="project-link"
            href="${escapeHTML(url)}"
            target="_blank"
            rel="noopener noreferrer"
            ${validUrl ? "" : 'aria-disabled="true"'}
          >
            View project <span aria-hidden="true">&#8599;</span>
          </a>
        </article>
      `;
    })
    .join("");

  initializeProjectImages();
  projectGrid.setAttribute("aria-busy", "false");
}

function renderFeaturedFallback() {
  renderProjects([
    {
      name: "Quasar",
      description:
        "My Discord AI assistant project, featuring multi-provider AI fallback and approval-based workflows.",
      language: "Python",
      stargazers_count: 0,
      forks_count: 0,
      html_url: "https://github.com/aceyen0969-new/Quasar",
      updated_at: "",
      fallback: true,
      featured: true,
      image_url: null
    }
  ]);
}

async function initializeProjects() {
  if (!projectGrid) {
    return;
  }

  projectGrid.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(SITE_CONFIG.projectsEndpoint, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Projects request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.projects) || data.projects.length === 0) {
      renderFeaturedFallback();
      return;
    }

    renderProjects(data.projects);

    const existingNotice = document.querySelector("#projects-notice");

    if (existingNotice) {
      existingNotice.remove();
    }

    if (data.github_available === false) {
      const notice = document.createElement("p");

      notice.id = "projects-notice";
      notice.className = "projects-message";
      notice.textContent =
        "GitHub is temporarily unavailable. Showing cached or featured projects.";

      projectGrid.before(notice);
    }
  } catch (error) {
    console.error("Unable to load GitHub projects:", error);

    renderFeaturedFallback();

    const existingNotice = document.querySelector("#projects-notice");

    if (!existingNotice) {
      const notice = document.createElement("p");

      notice.id = "projects-notice";
      notice.className = "projects-message";
      notice.textContent =
        "GitHub is temporarily unavailable. Showing cached or featured projects.";

      projectGrid.before(notice);
    }
  }
}

function initializeContactForm() {
  if (!contactForm) {
    return;
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (formNote) {
      formNote.textContent = "Sending your message...";
    }

    const submitButton = contactForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const formData = new FormData(contactForm);
      const payload = Object.fromEntries(formData.entries());

      const response = await fetch(SITE_CONFIG.contactEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Unable to send your message."
        );
      }

      if (formNote) {
        formNote.textContent =
          result.message || "Your message was sent successfully!";
      }

      contactForm.reset();
    } catch (error) {
      console.error("Contact form submission failed:", error);

      if (formNote) {
        formNote.textContent =
          error.message || "Something went wrong. Please try again later.";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

initializeNavigation();
initializeFooter();
initializeProjects();
initializeContactForm();