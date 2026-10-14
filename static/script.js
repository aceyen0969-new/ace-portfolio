
const SITE_CONFIG = {
  githubUsername: "aceyen0969-new",
  featuredRepository: "quasar",
  projectsEndpoint: "/api/projects",
  contactEndpoint: "/api/contact"
};

const DEMO_URLS = {
  "still-form-barbershop": "https://still-form-barbershop.onrender.com/",
  "sunday-table-restaurant": "https://sunday-table-restaurant.onrender.com/",
  "kinetiq-studio": "https://kinetiq-studio-x3fd.onrender.com/",
  "noir-atelier": "https://noir-atelier-g9re.onrender.com/",
  "velora-wellness": "https://velora-wellness.onrender.com/",
  "ember-house-restaurant": "https://ember-house-restaurant-76jv.onrender.com/"
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
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function getPreviewURL(repository) {
  const repositoryName = String(repository.name || "").toLowerCase();
  const demoURL = DEMO_URLS[repositoryName];

  if (demoURL) {
    return `https://image.thum.io/get/width/1200/crop/675/noanimate/${demoURL}`;
  }

  return safeImageURL(repository.image_url);
}

function renderProjectCover(repository) {
  const name = String(repository.name || "Untitled project");
  const language = String(repository.language || "Various");
  const monogram = name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "</>";

  return `
    <div class="project-cover">
      <span class="project-cover-kicker">PROJECT / ${escapeHTML(language)}</span>
      <span class="project-cover-monogram">${escapeHTML(monogram)}</span>
      <span class="project-cover-name">${escapeHTML(name)}</span>
      <span class="project-cover-caption">BUILT WITH CURIOSITY.</span>
    </div>
  `;
}

function renderProjectPreview(repository) {
  const imageURL = getPreviewURL(repository);

  if (!imageURL) {
    return renderProjectCover(repository);
  }

  const alt = `${repository.name || "Project"} preview`;

  return `
    <img
      class="project-preview-image"
      src="${escapeHTML(imageURL)}"
      alt="${escapeHTML(alt)}"
      loading="lazy"
      referrerpolicy="no-referrer"
    >
  `;
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

  projectGrid.innerHTML = orderedRepositories.map((repository) => {
    const name = escapeHTML(repository.name || "Untitled project");
    const description = escapeHTML(
      repository.description || "Explore this project on GitHub."
    );
    const language = escapeHTML(repository.language || "Various");
    const stars = Number(repository.stargazers_count) || 0;
    const forks = Number(repository.forks_count) || 0;
    const rawURL = String(repository.html_url || "");

    const validURL =
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(rawURL);

    const url = validURL ? rawURL : "#";
    const isFeatured = repository.name?.toLowerCase() === featuredName;

    return `
      <article class="project-card">
        <div class="project-preview">
          ${renderProjectPreview(repository)}
        </div>

        <div class="project-card-content">
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
            <span>&#8919; ${forks}</span>
          </div>

          <a
            class="project-link"
            href="${escapeHTML(url)}"
            target="_blank"
            rel="noopener noreferrer"
            ${validURL ? "" : 'aria-disabled="true"'}
          >
            View project <span aria-hidden="true">&#8599;</span>
          </a>
        </div>
      </article>
    `;
  }).join("");

  projectGrid.querySelectorAll(".project-preview-image").forEach((image) => {
    image.addEventListener("error", () => {
      const repositoryCard = image.closest(".project-card");
      const title = repositoryCard?.querySelector("h3")?.textContent || "Project";
      const language =
        repositoryCard?.querySelector(".project-language")?.textContent?.trim() ||
        "Various";
      const preview = image.closest(".project-preview");

      if (preview) {
        preview.innerHTML = renderProjectCover({
          name: title,
          language
        });
      }
    }, { once: true });
  });

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
      featured: true
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

    if (!document.querySelector("#projects-notice")) {
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
