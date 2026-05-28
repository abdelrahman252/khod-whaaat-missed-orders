"use strict";

window.KhodTooltip = (() => {
  let tooltipEl = null;
  let currentTarget = null;
  let showTimeout = null;

  function init() {
    if (tooltipEl) return;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "khod-floating-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    document.body.appendChild(tooltipEl);

    // Event delegation
    document.body.addEventListener("mouseover", handleMouseOver, true);
    document.body.addEventListener("mouseout", handleMouseOut, true);
    document.body.addEventListener("focusin", handleMouseOver, true);
    document.body.addEventListener("focusout", handleMouseOut, true);
    
    // Hide on scroll to prevent detachment
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide, { passive: true });
  }

  function handleMouseOver(e) {
    const target = e.target.closest("[data-tooltip]");
    if (!target) return;
    
    const text = target.getAttribute("data-tooltip");
    if (!text) return;
    
    currentTarget = target;
    clearTimeout(showTimeout);
    
    showTimeout = setTimeout(() => {
      show(target, text);
    }, 100);
  }

  function handleMouseOut(e) {
    const target = e.target.closest("[data-tooltip]");
    if (!target) return;
    
    // If moving within the same target, ignore
    if (e.type === "mouseout" && e.relatedTarget && target.contains(e.relatedTarget)) {
      return;
    }
    
    hide();
  }

  function show(target, text) {
    if (!tooltipEl || !target) return;
    
    tooltipEl.textContent = text;
    tooltipEl.classList.add("is-visible");
    
    // Reset positioning to calculate true dimensions
    tooltipEl.style.left = "0px";
    tooltipEl.style.top = "0px";
    tooltipEl.style.transform = "none";
    
    updatePosition(target);
  }

  function hide() {
    clearTimeout(showTimeout);
    if (tooltipEl) {
      tooltipEl.classList.remove("is-visible");
    }
    currentTarget = null;
  }

  function updatePosition(target) {
    if (!tooltipEl || !target) return;
    
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    
    const offset = 8; // Distance from target
    const padding = 10; // Minimum distance from viewport edge
    
    // Default position: top centered
    let top = targetRect.top - tooltipRect.height - offset;
    let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    
    // Check top boundary (if not enough space on top, put it below)
    if (top < padding) {
      top = targetRect.bottom + offset;
      
      // If it also overflows the bottom (rare), force it inside
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
      }
    }
    
    // Check left/right boundaries
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  // Auto-init when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init, hide, updatePosition };
})();
