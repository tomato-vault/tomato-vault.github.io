/**
 * Mermaid.js Integration for Jekyll Hydejack Theme
 * Supports initial page load and hy-push-state-load (PJAX navigation)
 */
(function () {
  // Inject responsive styling for mermaid diagrams
  const style = document.createElement("style");
  style.innerHTML = `
    .mermaid-wrapper {
      text-align: center;
      margin: 2rem 0;
      padding: 1.5rem;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }
    .mermaid-wrapper svg {
      max-width: 100% !important;
      height: auto !important;
      display: inline-block;
    }
  `;
  document.head.appendChild(style);

  function getMermaidConfig() {
    return {
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      fontFamily: "Fira Code, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis"
      }
    };
  }

  function initAndRender() {
    if (typeof mermaid === "undefined") {
      setTimeout(initAndRender, 100);
      return;
    }

    try {
      mermaid.initialize(getMermaidConfig());
    } catch (e) {
      console.warn("Mermaid initialize error:", e);
    }

    renderMermaidDiagrams();
  }

  async function renderMermaidDiagrams() {
    if (typeof mermaid === "undefined") return;

    const mermaidCodes = document.querySelectorAll(
      "pre code.language-mermaid, div.language-mermaid pre code, pre.language-mermaid code, div.language-mermaid"
    );

    for (let i = 0; i < mermaidCodes.length; i++) {
      const codeEl = mermaidCodes[i];
      const container = codeEl.closest(".language-mermaid") || codeEl.closest("pre") || codeEl;
      if (!container || container.dataset.mermaidRendered === "true") continue;

      const rawContent = (codeEl.tagName === "DIV" ? codeEl.textContent : codeEl.textContent).trim();
      if (!rawContent) continue;

      const diagramId = "mermaid-svg-" + Math.random().toString(36).substring(2, 9) + "-" + i;

      try {
        const { svg, bindFunctions } = await mermaid.render(diagramId, rawContent);
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-wrapper";
        wrapper.innerHTML = svg;

        // Sequence diagram note-lifeline overlay fix: ensure notes render above lines
        const svgEl = wrapper.querySelector("svg");
        if (svgEl) {
          const notes = svgEl.querySelectorAll("g[data-et='note'], g.note");
          notes.forEach(note => svgEl.appendChild(note));
        }

        container.parentNode.replaceChild(wrapper, container);
        if (typeof bindFunctions === "function") {
          bindFunctions(wrapper);
        }
        wrapper.dataset.mermaidRendered = "true";
      } catch (err) {
        console.error("Mermaid rendering failed for element:", codeEl, err);
      }
    }
  }

  window.renderMermaid = renderMermaidDiagrams;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAndRender);
  } else {
    initAndRender();
  }

  const pushState = document.getElementById("_pushState");
  if (pushState) {
    pushState.addEventListener("hy-push-state-load", function () {
      renderMermaidDiagrams();
    });
  }
})();
