<script setup>
import { REPO_URL as REPO } from "./lib/site.js";
import { theme, toggleTheme } from "./lib/theme.js";

const UPDATED = "October 29, 2026";
</script>

<template>
  <div class="page">
    <div class="position-absolute top-0 end-0 p-3">
      <button class="btn btn-ghost-secondary btn-sm" type="button" @click="toggleTheme"
              :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
        {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
      </button>
    </div>

    <main class="container container-narrow py-5 px-3 policy">
      <a href="./index.html" class="small">← Babygraph</a>
      <h1 class="mt-3 mb-1">Privacy policy</h1>
      <p class="text-secondary">Last updated {{ UPDATED }}</p>

      <div class="card mb-4">
        <div class="card-body">
          <h2 class="h3">Short version</h2>
          <p class="mb-0">
            Babygraph never collects, uses, or looks at your data. Your NaraBaby export and any photos you add stay
            in your browser. There are no analytics, no tracking, no ads, and no cookies. The only logging is
            ordinary server logging of which files were requested, never anything about you or your kid.
          </p>
        </div>
      </div>

      <h2 class="h3">Your data</h2>
      <ul>
        <li>When you choose or drop your export, your browser reads it and builds the charts on your device. The file is never uploaded.</li>
        <li>The parsed data is saved in this browser's local storage so the dashboard is still there next time. Photos you add to Baby Firsts are saved in this browser's IndexedDB.</li>
        <li>I never use your data for anything: not to sell, share, train, or improve anything. It never reaches me in the first place.</li>
      </ul>

      <h2 class="h3">Analytics and tracking</h2>
      <p>
        None. No analytics, no tracking pixels, no ads, no cookies, and no third-party scripts, fonts or embeds.
        Every file the page loads comes from this site, and its security policy blocks connections to anywhere else.
      </p>

      <h2 class="h3">Server logs</h2>
      <p>
        The server only sends the site's files: HTML, JavaScript and CSS. Any logging is ordinary server logging about
        those requests, like the time, IP address, which file was requested and the browser's user agent, used to keep
        the server running. It never contains your export, your photos, or anything shown on the dashboard, because
        none of that is ever sent to the server.
      </p>
      <p>
        The server config is public:
        <a :href="REPO + '/blob/main/deploy/Caddyfile.example'">deploy/Caddyfile.example</a>. It doesn't turn on access logs.
      </p>

      <h2 class="h3">What's stored in your browser</h2>
      <div class="table-responsive mb-3">
        <table class="table table-sm">
          <thead><tr><th>Name</th><th>Where</th><th>What</th></tr></thead>
          <tbody>
            <tr><td><code>nara-import</code></td><td>local storage</td><td>Your parsed export</td></tr>
            <tr><td><code>nara-photos</code></td><td>IndexedDB</td><td>Photos you added to Baby Firsts</td></tr>
            <tr><td><code>nara-theme</code></td><td>local storage</td><td>Whether you picked light or dark mode</td></tr>
          </tbody>
        </table>
      </div>

      <h2 class="h3">Deleting your data</h2>
      <p>
        "New upload" in the dashboard sidebar clears the export, and can remove your photos too. Clearing this
        site's data in your browser settings removes everything.
      </p>

      <h2 class="h3">Running your own copy</h2>
      <p>
        Babygraph is open source (<a :href="REPO">GitHub</a>), so you can read exactly what it does or host it
        yourself. If you host it, your server's logs are up to you.
      </p>

      <h2 class="h3">Changes</h2>
      <p class="mb-0">If this ever changes, this page will say so first, with a new date.</p>
    </main>
  </div>
</template>

<style scoped>
.policy { max-width: 46rem; }
.policy > h2 { margin-top: 2rem; }
.policy code { white-space: nowrap; }
.policy p, .policy li { line-height: 1.6; }
</style>
