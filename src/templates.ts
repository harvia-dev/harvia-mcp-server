import { HARVIA_LOGO } from "./assets.js";

export const BRAND_FONTS = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Noto+Sans:wght@300;400;500&display=swap" rel="stylesheet">`;

export const BRAND_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --red:#ED1C24;--deep-red:#C01718;--near-black:#1A0000;
    --text:#505045;--text2:#727266;--warm-gray:#EAE8E0;
    --light-gray:#D9D6C8;--white:#fff;--cream:#FEFCF3;
    --bg:#F5F3EE;--border:rgba(80,80,69,0.15);
  }
  body{font-family:'Noto Sans',sans-serif;background:var(--cream);color:var(--text);min-height:100vh;display:flex;flex-direction:column;}
  h1,h2,h3{font-family:'Montserrat',sans-serif;font-weight:700;}
`;

export function setupHeader(opts?: { logoutToken?: string; base?: string }): string {
  const logoutBtn = opts?.base
    ? `<div style="display:flex;align-items:center;padding:0 1.5rem;margin-left:auto;">
        <a href="${opts.base}/setup" style="background:none;border:1px solid var(--border);border-radius:5px;padding:.35rem .8rem;font-family:'Montserrat',sans-serif;font-weight:600;font-size:.75rem;color:var(--text2);cursor:pointer;text-decoration:none;">Log out</a>
      </div>`
    : "";
  return `<header style="background:var(--light-gray);border-bottom:1px solid var(--border);padding:0;display:flex;align-items:stretch;height:80px;">
  <div style="width:80px;height:80px;overflow:hidden;flex-shrink:0;">
    <img src="${HARVIA_LOGO}" alt="Harvia" style="width:88px;height:88px;margin:-4px;display:block;">
  </div>
  <div style="display:flex;align-items:center;padding:0 1.5rem;">
    <span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:1rem;color:var(--text);letter-spacing:.02em;">MCP server setup</span>
  </div>
  ${logoutBtn}
</header>`;
}
