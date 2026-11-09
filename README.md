# Kasper Tulonen - personal site

An Eleventy-powered personal site published with GitHub Pages at
[`https://tulonek45.github.io`](https://tulonek45.github.io).

## Local development

Requirements: Node.js 20 or newer.

```sh
npm ci
npm start
```

`npm start` refreshes the public GitHub project list and serves the site locally.
To build the production output without starting a server, run `npm run build`.
The generated site is written to `_site/`.

The site content lives in `src/`: edit the Markdown pages for the About,
Projects, Interests, and CV sections. The shared layout and stylesheet are in
`src/_includes/` and `src/assets/`.

## Development and deployment

Use feature branches and open pull requests targeting `main`:

```sh
git switch -c feature/describe-your-change
# make and test your changes
git push -u origin feature/describe-your-change
```

The **Validate site** workflow runs tests and builds pull requests to `main`.
Merge the pull request after its checks pass.
The deployment workflow tests, refreshes the public GitHub project list,
persists a changed snapshot to `main`, and deploys the site to GitHub Pages
when `main` is updated. It also runs every Monday at 09:00 UTC and can be
started manually from the Actions tab.
