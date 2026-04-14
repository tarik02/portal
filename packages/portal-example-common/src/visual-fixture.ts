export const PORTAL_EXAMPLE_VISUAL_FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Portal Visual Fixture</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Helvetica Neue", Arial, sans-serif;
        --bg: #f4efe5;
        --ink: #1d2c3d;
        --muted: #5e6d79;
        --card: rgba(255, 255, 255, 0.78);
        --line: rgba(29, 44, 61, 0.12);
        --accent: #bb5a3c;
        --accent-soft: rgba(187, 90, 60, 0.18);
        --sage: #7f9487;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(187, 90, 60, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(127, 148, 135, 0.22), transparent 32%),
          linear-gradient(180deg, #f7f1e8 0%, var(--bg) 100%);
        color: var(--ink);
      }

      main {
        width: 1280px;
        min-height: 800px;
        padding: 56px;
      }

      .frame {
        display: grid;
        grid-template-columns: 1.4fr 0.86fr;
        gap: 28px;
        align-items: stretch;
      }

      .hero {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 32px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.58));
        box-shadow: 0 24px 80px rgba(29, 44, 61, 0.10);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 22px 0 14px;
        max-width: 10ch;
        font-size: 64px;
        line-height: 0.94;
        letter-spacing: -0.05em;
      }

      .lede {
        margin: 0;
        max-width: 34rem;
        color: var(--muted);
        font-size: 20px;
        line-height: 1.55;
      }

      .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 28px;
      }

      .feature {
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.70);
      }

      .feature strong {
        display: block;
        font-size: 15px;
        letter-spacing: -0.02em;
      }

      .feature span {
        display: block;
        margin-top: 8px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.45;
      }

      .dashboard {
        display: grid;
        gap: 18px;
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 22px;
        background: var(--card);
        box-shadow: 0 18px 54px rgba(29, 44, 61, 0.08);
      }

      .panel h2 {
        margin: 0 0 18px;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .stat {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 12px 0;
        border-top: 1px solid var(--line);
      }

      .stat:first-of-type {
        border-top: 0;
        padding-top: 0;
      }

      .stat-label {
        font-size: 15px;
        color: var(--muted);
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.04em;
      }

      .timeline {
        display: grid;
        gap: 14px;
      }

      .timeline-item {
        display: grid;
        grid-template-columns: 76px 1fr;
        gap: 14px;
        align-items: start;
      }

      .timeline-time {
        font-size: 13px;
        font-weight: 700;
        color: var(--accent);
      }

      .timeline-copy {
        color: var(--ink);
        font-size: 14px;
        line-height: 1.45;
      }

      .hero::after {
        content: "";
        position: absolute;
        right: -44px;
        bottom: -52px;
        width: 210px;
        height: 210px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(127, 148, 135, 0.28) 0%, rgba(127, 148, 135, 0.06) 60%, transparent 72%);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="frame">
        <article class="hero">
          <div class="eyebrow">stable fixture</div>
          <h1>Visual contract for portal streaming</h1>
          <p class="lede">
            This page is served locally to keep screenshot baselines deterministic while still exercising the full
            remote-browser pipeline.
          </p>
          <div class="feature-grid">
            <div class="feature">
              <strong>Single source</strong>
              <span>Rendered by both backend variants from the same route.</span>
            </div>
            <div class="feature">
              <strong>Fixed sizing</strong>
              <span>Designed for the 1280×800 remote viewport used in E2E runs.</span>
            </div>
            <div class="feature">
              <strong>No drift</strong>
              <span>No timers, random content, external fonts, or network requests.</span>
            </div>
          </div>
        </article>

        <aside class="dashboard">
          <section class="panel">
            <h2>Session snapshot</h2>
            <div class="stat">
              <span class="stat-label">stream quality</span>
              <span class="stat-value">80%</span>
            </div>
            <div class="stat">
              <span class="stat-label">viewport</span>
              <span class="stat-value">1280×800</span>
            </div>
            <div class="stat">
              <span class="stat-label">backend matrix</span>
              <span class="stat-value">2 paths</span>
            </div>
          </section>

          <section class="panel">
            <h2>Checks</h2>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-time">01</div>
                <div class="timeline-copy">Portal client auto-connects to the embedded websocket endpoint.</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-time">02</div>
                <div class="timeline-copy">A navigation command opens this local visual fixture inside the remote browser.</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-time">03</div>
                <div class="timeline-copy">The streamed frame is compared against committed Linux baselines.</div>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  </body>
</html>
`;
