
const SITE_CONFIG = {
  githubUsername: "aceyen0969-new",
  featuredRepository: "quasar",
  repositoryPageSize: 100,
  readmeConcurrency: 5,
  readmeLimit: 12
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

function getRepositoryDescription(readme, fallbackDescription) {
  if (!readme || typeof readme !== "string") {
    return fallbackDescription || "Explore this project on GitHub.";
  }

  const cleanedReadme = readme
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#+\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const ignoredHeadings = new Set([
    "overview",
    "introduction",
    "features",
    "installation",
    "getting started",
    "usage",
    "table of contents",
    "contributing",
    "license"
  ]);

  const description = cleanedReadme.find((line) => {
    const normalized = line.toLowerCase().replace(/[:#]/g, "").trim();

    return (
      line.length >= 25 &&
      !ignoredHeadings.has(normalized) &&
      !normalized.startsWith("http://") &&
      !normalized.startsWith("https://")
    );
  });

  const result = description || fallbackDescription;

  if (!result) {
    return "Explore this project on GitHub.";
  }

  return result.length > 180
    ? `${result.slice(0, 177).trimEnd()}...`
    : result;
}

async function fetchGitHubJSON(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error(
        "GitHub's API rate limit was reached. Please try again later."
      );
    }

    if (response.status === 404) {
      throw new Error(
        "The configured GitHub account or featured repository could not be found."
      );
    }

    throw new Error(
      `GitHub could not load repository data (HTTP ${response.status}).`
    );
  }

  return response.json();
}

async function fetchRepositories() {
  const repositories = [];
  let page = 1;

  while (true) {
    const url = new URL(
      `https://api.github.com/users/${encodeURIComponent(
        SITE_CONFIG.githubUsername
      )}/repos`
    );

    url.searchParams.set("type", "owner");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("direction", "desc");
    url.searchParams.set(
      "per_page",
      String(SITE_CONFIG.repositoryPageSize)
    );
    url.searchParams.set("page", String(page));

    const batch = await fetchGitHubJSON(url);

    if (!Array.isArray(batch)) {
      throw new Error("GitHub returned an unexpected repository response.");
    }

    repositories.push(...batch);

    if (batch.length < SITE_CONFIG.repositoryPageSize) {
      break;
    }

    page += 1;
  }

  return repositories.filter((repository) => {
    return (
      !repository.private &&
      !repository.archived &&
      !repository.disabled &&
      !repository.fork
    );
  });
}

async function fetchFeaturedRepository() {
  const url =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(SITE_CONFIG.githubUsername)}/` +
    `${encodeURIComponent(SITE_CONFIG.featuredRepository)}`;

  const repository = await fetchGitHubJSON(url);

  if (
    repository.private ||
    repository.disabled ||
    !repository.html_url
  ) {
    throw new Error("The featured repository is not publicly available.");
  }

  return repository;
}

async function fetchReadme(owner, repository) {
  const url =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repository)}/readme`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.raw+json"
      }
    });

    if (!response.ok) {
      return "";
    }

    const content = await response.text();

    try {
      const parsed = JSON.parse(content);

      if (typeof parsed === "string") {
        return parsed;
      }

      if (parsed && typeof parsed.content === "string") {
        if (parsed.encoding === "base64") {
          const binary = atob(parsed.content.replace(/\s/g, ""));
          const bytes = Uint8Array.from(
            binary,
            (character) => character.charCodeAt(0)
          );

          return new TextDecoder().decode(bytes);
        }

        return parsed.content;
      }
    } catch {
      return content;
    }

    return content;
  } catch {
    return "";
  }
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await callback(items[index], index);
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return results;
}

function renderProjects(repositories) {
  if (!projectGrid) {
    return;
  }

  if (repositories.length === 0) {
    projectGrid.innerHTML = `
      <p class="projects-message">
        No public projects are available to display yet.
        Visit GitHub to see the repositories.
      </p>
    `;

    projectGrid.setAttribute("aria-busy", "false");
    return;
  }

  projectGrid.innerHTML = repositories
    .map((repository) => {
      const isFeatured =
        repository.name.toLowerCase() ===
        SITE_CONFIG.featuredRepository.toLowerCase();

      const name = escapeHTML(repository.name);
      const description = escapeHTML(
        repository.portfolioDescription ||
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

async function initializeProjects() {
  if (!projectGrid) {
    return;
  }

  projectGrid.setAttribute("aria-busy", "true");

  try {
    const [repositories, featuredRepository] = await Promise.all([
      fetchRepositories(),
      fetchFeaturedRepository()
    ]);

    const repositoryMap = new Map();

    repositories.forEach((repository) => {
      repositoryMap.set(repository.name.toLowerCase(), repository);
    });

    repositoryMap.set(
      featuredRepository.name.toLowerCase(),
      featuredRepository
    );

    const featuredName = SITE_CONFIG.featuredRepository.toLowerCase();

    const orderedRepositories = Array.from(repositoryMap.values()).sort(
      (first, second) => {
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
      }
    );

    const readmeRepositories = orderedRepositories.slice(
      0,
      SITE_CONFIG.readmeLimit
    );

    const enrichedRepositories = await mapWithConcurrency(
      readmeRepositories,
      SITE_CONFIG.readmeConcurrency,
      async (repository) => {
        const readme = await fetchReadme(
          repository.owner?.login || SITE_CONFIG.githubUsername,
          repository.name
        );

        const isFeatured =
          repository.name.toLowerCase() === featuredName;

        return {
          ...repository,
          portfolioDescription: isFeatured
            ? "My Discord AI assistant project, featuring multi-provider AI fallback and approval-based workflows."
            : getRepositoryDescription(readme, repository.description)
        };
      }
    );

    const enrichedMap = new Map(
      enrichedRepositories.map((repository) => [
        repository.name.toLowerCase(),
        repository
      ])
    );

    const finalRepositories = orderedRepositories.map((repository) => {
      return (
        enrichedMap.get(repository.name.toLowerCase()) || {
          ...repository,
          portfolioDescription:
            repository.description || "Explore this project on GitHub."
        }
      );
    });

    renderProjects(finalRepositories);
  } catch (error) {
    console.error("Failed to load GitHub projects:", error);

    projectGrid.innerHTML = `
      <div class="projects-message">
        <p>Projects could not be loaded right now.</p>
        <a
          href="https://github.com/${encodeURIComponent(
            SITE_CONFIG.githubUsername
          )}?tab=repositories"
          target="_blank"
          rel="noopener noreferrer"
        >
          Browse my repositories on GitHub ↗
        </a>
        <button class="button button-secondary" id="retry-projects" type="button">
          Try again
        </button>
      </div>
    `;

    projectGrid.setAttribute("aria-busy", "false");

    document
      .querySelector("#retry-projects")
      ?.addEventListener("click", () => {
        projectGrid.innerHTML = `
          <p class="projects-message">Loading repositories from GitHub...</p>
        `;

        initializeProjects();
      });
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

    if (
      name.length > 80 ||
      email.length > 150 ||
      message.length > 3000
    ) {
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
