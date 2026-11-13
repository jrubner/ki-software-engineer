<h1 align="center">Modern Angular Workshop</h1>

<p align="center">
  <img alt="workshops-de-logo-blue" src="docs/logo-workshops-de.png" width="120">
  <br>
  <em>The best way to start embracing AI for your all-day development tasks</em>
  <br>
</p>

<p align="center">
  <a href="https://workshops.de/seminare-schulungen-kurse/angular-ai-agent-driven-development" target="_blank"><strong>workshops.de</strong></a>
  <br>
</p>

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current application structure, dependencies, data flow, and known limitations.

## Local Development

The application targets Angular 21 and runs without Zone.js. Application forms
use the experimental Angular 21 Signal Forms API. Use Node 22.23.4+ (22.x) or
24.22.1+ (24.x) with TypeScript 5.9.x. WebdriverIO 10 sets the stricter Node
minimum for the test toolchain.

`npm test -- --watch=false` runs the unit suite through Angular's Vitest builder
in headless Chrome using WebdriverIO (1920 × 1080 viewport). Install Chrome;
WebdriverIO resolves its matching driver on first use, which requires network
access. The suite includes real-browser CSS and CDK assertions. It does not run
the separate Playwright application acceptance suite. Spies are restored between
tests and automatic failure screenshots are disabled in `vitest-base.config.ts`.

Run `node --test .github/scripts/*.test.cjs` for automation guards,
`npm run ng -- build --configuration development` for the development build,
and `npm run build` for production. The production build downloads Google Fonts.
On Windows use `npm.cmd` where PowerShell script execution is restricted.

| Command       | Description                                      |
| ------------- | ------------------------------------------------ |
| `npm install` | Installs the packages to develop the Angular app |
| `npm start`   | Starts the Angular app                           |

## The API

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `npx bookmonkey-api` | Installs and starts the HTTP API "Bookmonkey API" |

The API provides fake data that you can use in your Angular application.

> [!NOTE]
> The API starts at http://localhost:4730.
> When you open this page, you’ll find documentation for all endpoints. 🚀

## VS Code

If you are using [VS Code](https://code.visualstudio.com/) as you editor of choice, you might see a popup after opening this repository.
We added a few plugin recommendations to simplify writing code during the workshop:

1. Angular Language Service - Adds better syntax-highlighting & automatic refactorings
1. Prettier - Formats your code automatically in the same way across your project.
