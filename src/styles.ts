// Shared stylesheet for the HTML surfaces (setup, success, OAuth login/callback).
// Presentation only — no page behaviour depends on anything in here.
//
// Follows the Harvia Labs style guide: dark warm palette, square corners,
// Montserrat for structure, Noto Sans for reading and for every button.
//
// The legacy token names from the previous light theme are kept as aliases at
// the bottom of :root. Inline styles in the page templates — and the timestamp
// formatter in pages/success.ts, which writes `color:var(--text2)` from JS —
// still reference them, so they must keep resolving.

export const STYLESHEET = `
*{box-sizing:border-box;margin:0;padding:0}

:root{
  /* Brand */
  --harvia-red:#ED1C24;
  --deep-red:#C01718;
  --natural-white:#FEFCF3;
  --harvia-orange:#FF6000;
  --harvia-yellow:#FFC000;

  /* Surfaces */
  --bg-0:#0a0405;
  --bg-1:#120608;
  --bg-2:#1a0a0c;
  --line:rgba(255,255,255,.08);
  --line-strong:rgba(255,255,255,.16);

  /* Text */
  --text:#FEFCF3;
  --text-muted:rgba(254,252,243,.65);
  --text-dim:rgba(254,252,243,.45);

  /* Type */
  --font-display:'Montserrat',sans-serif;
  --font-body:'Noto Sans',sans-serif;

  /* Metrics */
  --container:1400px;
  --column:600px;
  --gutter:clamp(16px,3vw,32px);
  --section-pad:clamp(70px,8vw,120px);
  --radius:2px;
  --header-h:72px;

  /* Legacy aliases — see file header. Do not remove. */
  --red:var(--harvia-red);
  --text2:var(--text-muted);
  --white:var(--bg-2);
  --cream:var(--bg-1);
  --bg:rgba(255,255,255,.03);
  --warm-gray:rgba(255,255,255,.05);
  --light-gray:var(--line-strong);
  --border:var(--line);
  --near-black:#000;
}

html{scroll-padding-top:var(--header-h);}

/* The warmth zone tiles once per viewport height and fades to fully
   transparent at each tile edge, so the repeat seam is invisible. */
body{
  font-family:var(--font-body);
  font-weight:400;
  color:var(--text);
  background-color:var(--bg-0);
  background-image:radial-gradient(75% 50% at 50% 34%,
    rgba(237,28,36,.18) 0%,
    rgba(237,28,36,.07) 44%,
    rgba(237,28,36,0) 76%);
  background-repeat:repeat-y;
  background-size:100% 100dvh;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  -webkit-font-smoothing:antialiased;
}

::selection{background:var(--harvia-red);color:var(--natural-white);}

h1,h2,h3{font-family:var(--font-display);font-weight:700;color:var(--text);}
h1{font-size:clamp(1.75rem,4vw,2.6rem);line-height:1.1;letter-spacing:-.03em;}
strong{font-weight:600;color:var(--text);}
a{color:var(--harvia-red);}
a:hover{color:var(--deep-red);}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}

/* ---------------------------------------------------------------- header */

.site-header{
  position:fixed;top:0;left:0;right:0;z-index:100;
  height:var(--header-h);
  background:var(--bg-0);
  border-bottom:1px solid transparent;
  display:flex;align-items:center;
  padding-right:var(--gutter);
  transition:border-color .2s;
}
.site-header.is-scrolled{border-bottom-color:var(--line);}

/* The logo asset carries a transparent margin around the red square
   (273x273 inside a 283x283 canvas, inset 6/7/4/3). The crop box below
   scales and offsets it so the red bleeds a fraction of a pixel past every
   edge — on a dark header any transparent sliver would read as a gap. */
.logo-link{display:block;flex-shrink:0;line-height:0;}
.logo-crop{display:block;width:var(--header-h);height:var(--header-h);overflow:hidden;}
.logo{display:block;width:76px;height:76px;margin:-2.2px 0 0 -2px;}

.header-title{
  font-family:var(--font-display);font-weight:700;
  font-size:.9rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text);
  padding-left:1.25rem;
}
.header-action{margin-left:auto;}

/* ---------------------------------------------------------------- layout */

main{
  flex:1;
  width:100%;
  padding:calc(var(--header-h) + 48px) var(--gutter) 64px;
  display:flex;flex-direction:column;align-items:center;
}
.column{width:100%;max-width:var(--column);}

/* --------------------------------------------------------------- buttons */

/* Two styles only — solid red for actions, ghost for everything else.
   Noto Sans 500, sentence case, never uppercase, never Montserrat. */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:.4rem;
  font-family:var(--font-body);font-weight:500;font-size:.85rem;line-height:1;
  padding:.7rem 1.1rem;
  border:2px solid transparent;border-radius:var(--radius);
  cursor:pointer;text-decoration:none;
  transition:background-color .15s,color .15s,border-color .15s;
}
.btn-primary{background:var(--harvia-red);border-color:var(--harvia-red);color:var(--natural-white);}
.btn-primary:hover{background:var(--deep-red);border-color:var(--deep-red);color:var(--natural-white);}
.btn-ghost{background:transparent;border-color:var(--line-strong);color:var(--text);}
.btn-ghost:hover{background:var(--natural-white);border-color:var(--natural-white);color:var(--bg-0);}
.btn-sm{font-size:.78rem;padding:.5rem .8rem;}
.btn:focus-visible,.copy-btn:focus-visible,.revoke-btn:focus-visible,.forgot-btn:focus-visible{
  outline:2px solid var(--harvia-red);outline-offset:2px;
}
/* Transient "copied" state — the .ok class is toggled by copyText(). */
.btn.ok{background:transparent;border-color:var(--harvia-red);color:var(--harvia-red);}

/* ----------------------------------------------------------------- cards */

.card{
  background:var(--bg-2);
  border:1px solid var(--line);
  border-radius:var(--radius);
  width:100%;
  overflow:hidden;
}
.card-header{
  background:rgba(255,255,255,.03);
  border-bottom:1px solid var(--line);
  padding:1rem 1.5rem;
  display:flex;align-items:center;gap:.6rem;
}
.card-header h2{
  font-size:.8rem;font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;
}
.card-body{padding:1.75rem 1.5rem;}

/* ---------------------------------------------------- instruction panels */

.instruction{
  border:1px solid var(--line);
  border-radius:var(--radius);
  margin-bottom:.75rem;
  overflow:hidden;
}
.instruction summary{
  list-style:none;cursor:pointer;
  padding:.85rem 1rem;
  font-family:var(--font-display);font-weight:600;
  font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text);
  background:rgba(255,255,255,.03);
  display:flex;align-items:center;gap:.6rem;
  transition:background-color .15s;
}
.instruction summary:hover{background:rgba(255,255,255,.06);}
.instruction summary::-webkit-details-marker{display:none;}
.instruction summary::before{
  content:'▶';font-size:.55rem;color:var(--text-dim);
  transition:transform .15s;flex-shrink:0;
}
.instruction[open]>summary::before{transform:rotate(90deg);}
.instruction[open]>summary{background:rgba(255,255,255,.06);}
.instruction-body{padding:1.1rem 1rem 1.15rem;border-top:1px solid var(--line);}

/* ----------------------------------------------------------------- steps */

.steps{list-style:none;padding:0;margin:0;}
.steps li{
  display:flex;gap:.75rem;
  font-size:.85rem;color:var(--text-muted);line-height:1.55;
  padding:.3rem 0;
}
.step-row{display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.7rem;}
.step-row p{font-size:.85rem;color:var(--text-muted);line-height:1.55;}
.step-row p strong{color:var(--text);}
/* Links in instruction prose read as part of the sentence rather than as an
   accent — the red is reserved for actions. Covers the step rows and the
   closing notes below them. */
.instruction-body a{color:var(--text);text-decoration:underline;text-underline-offset:2px;}
.instruction-body a:hover{color:var(--harvia-red);}
/* Square chips, not circles — the palette is square-cornered throughout. */
.step-num,.step-dot{
  flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--font-display);font-weight:700;
  border-radius:var(--radius);
}
.step-num{width:20px;height:20px;background:var(--harvia-red);color:var(--natural-white);font-size:.68rem;margin-top:.15rem;}
.step-dot{width:19px;height:19px;background:rgba(255,255,255,.05);border:1px solid var(--line-strong);color:var(--text-muted);font-size:.66rem;margin-top:2px;}

/* ------------------------------------------------------------- code, url */

.cmd-box{
  background:#000;
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:.7rem .95rem;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:.76rem;color:var(--text);
  word-break:break-all;
  margin:.5rem 0 .7rem;
}
.url-box{
  background:#000;
  border:1px solid var(--line-strong);
  border-radius:var(--radius);
  padding:.75rem 1rem;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:.78rem;color:var(--text);
  word-break:break-all;
  margin:.7rem 0 .85rem;
}
.copy-btn{
  flex-shrink:0;
  background:transparent;
  border:1px solid var(--line-strong);border-radius:var(--radius);
  padding:.35rem .7rem;
  font-family:var(--font-body);font-weight:500;font-size:.75rem;line-height:1;
  color:var(--text);cursor:pointer;
  transition:background-color .15s,color .15s,border-color .15s;
}
.copy-btn:hover{background:var(--natural-white);border-color:var(--natural-white);color:var(--bg-0);}
.copy-btn.ok{background:transparent;border-color:var(--harvia-red);color:var(--harvia-red);}

/* ------------------------------------------------------- prose and notes */

.subtitle{font-size:.9rem;color:var(--text-muted);line-height:1.6;}
.tagline,.alt-label{
  font-family:var(--font-display);font-weight:700;
  font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-dim);
}
.hint,.more-soon{font-size:.78rem;color:var(--text-dim);line-height:1.6;}
.note,.org-note,.notice-beta{
  background:rgba(255,255,255,.04);
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:.8rem 1rem;
  font-size:.8rem;color:var(--text-muted);line-height:1.6;
}
.notice-beta ul{margin:.45rem 0 0 1.1rem;padding:0;}
.notice-beta li{margin-bottom:.25rem;}
.divider{display:flex;align-items:center;gap:1rem;width:100%;}
/* Without a label the gap would show as a break in the middle of the rule. */
.divider:empty{gap:0;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--line);}
.divider span{
  font-family:var(--font-display);font-weight:600;
  font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-dim);
}

/* ----------------------------------------------------------------- forms */

label{
  display:block;
  font-family:var(--font-body);font-weight:500;
  font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-muted);
  margin:1.25rem 0 .4rem;
}
input{
  width:100%;
  padding:.75rem .85rem;
  background:var(--bg-2);
  border:1px solid var(--line-strong);
  border-radius:var(--radius);
  /* 1rem minimum — anything smaller makes iOS Safari zoom on focus. */
  font-family:var(--font-body);font-size:1rem;
  color:var(--text);
  transition:border-color .15s;
}
input::placeholder{color:var(--text-dim);}
input:focus{outline:2px solid var(--harvia-red);outline-offset:0;border-color:var(--harvia-red);}
.error-msg{
  background:rgba(237,28,36,.1);
  border:1px solid rgba(237,28,36,.5);
  border-radius:var(--radius);
  padding:.7rem .95rem;
  font-size:.825rem;color:var(--text);
  margin-top:1rem;
}
.forgot-btn{
  display:block;
  background:none;border:none;padding:0;margin-top:.6rem;
  font-family:var(--font-body);font-size:.78rem;
  color:var(--text-dim);text-decoration:underline;cursor:pointer;
}
.forgot-btn:hover{color:var(--text);}
/* Toggled by the inline handler in setup.ts / oauth.ts — keep both states. */
.forgot-info{
  display:none;
  margin-top:.7rem;
  background:rgba(255,255,255,.04);
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:.7rem .95rem;
  font-size:.825rem;color:var(--text-muted);line-height:1.6;
}
.forgot-info.open{display:block;}

/* ------------------------------------------------------------------ tabs */

.tabs{display:flex;gap:.25rem;border-bottom:1px solid var(--line);margin-bottom:1rem;}
.tab{
  padding:.5rem .9rem;
  font-family:var(--font-body);font-weight:500;font-size:.82rem;
  color:var(--text-dim);cursor:pointer;
  border-bottom:2px solid transparent;margin-bottom:-1px;
  transition:color .15s,border-color .15s;
}
.tab:hover{color:var(--text);}
.tab.active{color:var(--text);border-bottom-color:var(--harvia-red);}
.tab-panel{display:none;}
.tab-panel.active{display:block;}

/* ----------------------------------------------------------------- table */

table{width:100%;border-collapse:collapse;}
th{
  text-align:left;
  font-family:var(--font-display);font-weight:700;
  font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-dim);
  background:rgba(255,255,255,.03);
  padding:.7rem 1rem;
  border-bottom:1px solid var(--line);
}
td{
  padding:.75rem 1rem;
  border-bottom:1px solid var(--line);
  vertical-align:middle;
  font-size:.825rem;color:var(--text);
}
tr:last-child td{border-bottom:none;}
.revoke-btn{
  background:transparent;
  border:1px solid var(--line-strong);border-radius:var(--radius);
  padding:.4rem .7rem;
  font-family:var(--font-body);font-weight:500;font-size:.75rem;line-height:1;
  color:var(--text);cursor:pointer;
  transition:background-color .15s,color .15s,border-color .15s;
}
.revoke-btn:hover{background:var(--harvia-red);border-color:var(--harvia-red);color:var(--natural-white);}
.table-footer{
  display:flex;justify-content:space-between;align-items:center;gap:1rem;
  padding:.9rem 1rem;
  border-top:1px solid var(--line);
  background:rgba(255,255,255,.03);
}

/* ---------------------------------------------------------------- footer */

.site-footer{background:var(--bg-1);border-top:1px solid var(--line);}
.footer-row{
  display:flex;align-items:center;justify-content:space-between;gap:1.25rem;
  padding:24px var(--gutter);
  max-width:var(--container);margin:0 auto;
}
.footer-logo-crop{display:block;width:40px;height:40px;overflow:hidden;flex-shrink:0;}
.footer-logo{display:block;width:42.2px;height:42.2px;margin:-1.22px 0 0 -1.11px;}
.footer-meta{
  display:flex;align-items:center;flex-wrap:wrap;gap:.4rem 1rem;
  font-size:.85rem;color:var(--text-dim);
}
.footer-meta a{color:var(--text-dim);text-decoration:none;}
.footer-meta a:hover{color:var(--text);}

/* ------------------------------------------------------------ responsive */

@media (max-width:720px){
  main{padding:calc(var(--header-h) + 32px) var(--gutter) 48px;}
  .header-title{font-size:.78rem;padding-left:.9rem;}
  .card-body{padding:1.4rem 1.15rem;}
  .card-header{padding:.9rem 1.15rem;}
  .footer-row{flex-direction:column;align-items:flex-start;gap:1rem;}
  .footer-meta{font-size:.8rem;}
  th,td{padding:.65rem .8rem;}
}

/* No blanket prefers-reduced-motion rule on purpose: a global
   transition override is what broke the Labs hero rotator on iOS, and
   everything animated here is a .15s hover fade with nothing to disable. */
`;
