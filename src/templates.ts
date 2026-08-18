import { HARVIA_LOGO } from "./assets.js";
import { STYLESHEET } from "./styles.js";

export const BRAND_FONTS = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Noto+Sans:wght@300;400;500&display=swap" rel="stylesheet">`;

/**
 * Link to the shared stylesheet served by the /styles.css route.
 *
 * The href must go through the public base, not a root-absolute path: in
 * production this worker is proxied under https://www.harvialabs.com/harvia-mcp,
 * where "/styles.css" would resolve against harvialabs.com itself and pull in
 * that site's stylesheet instead of ours. See getPublicBase in utils.ts.
 *
 * The cache buster is derived from the stylesheet itself, so editing the CSS
 * always invalidates the cached copy without anyone having to bump a number.
 */
export function stylesLink(base: string): string {
  return `<link rel="stylesheet" href="${base}/styles.css?v=${STYLESHEET.length}">`;
}

/** Sets the browser chrome to the page background instead of a light default. */
export const THEME_COLOR = `<meta name="theme-color" content="#0a0405">`;

export function setupHeader(opts?: { logoutToken?: string; base?: string }): string {
  const logoutBtn = opts?.base
    ? `<a class="btn btn-ghost btn-sm header-action" href="${opts.base}/setup">Log out</a>`
    : "";
  return `<header class="site-header">
  <span class="logo-crop"><img src="${HARVIA_LOGO}" alt="Harvia" class="logo"></span>
  <span class="header-title">MCP server setup</span>
  ${logoutBtn}
</header>
<script>addEventListener('scroll',function(){document.querySelector('.site-header').classList.toggle('is-scrolled',window.scrollY>20);},{passive:true});</script>`;
}

export function siteFooter(): string {
  return `<footer class="site-footer">
  <div class="footer-row">
    <span class="footer-logo-crop"><img src="${HARVIA_LOGO}" alt="Harvia" class="footer-logo"></span>
    <div class="footer-meta">
      <span>Created by <a href="https://www.harvialabs.com/" target="_blank" rel="noopener">Harvia Labs</a>. &copy; 2026 Harvia</span>
      <a href="https://www.harvia.com/en/privacy-notice/" target="_blank" rel="noopener">Privacy</a>
      <a href="https://www.harvia.com/en/terms-of-service/" target="_blank" rel="noopener">Terms</a>
    </div>
  </div>
</footer>`;
}
