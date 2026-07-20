# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

- 이 프로젝트는 기존 Google Apps Script(Sheets+Calendar) 기반으로 운영되던 "특별실 예약 시스템"을 Firebase 기반으로 재구축하는 프로젝트다.
- 대상 특별실: 미래창작공방, 에듀테크 교육실
- 1차 개발 범위: 로그인/인증 기능 제외. 모든 데이터는 고정된 테스트 유저(ownerId: "test-user") 소유로 가정하고 저장한다.
- 핵심 기능: 예약 신청(장소/날짜/시작~종료시간), 교사명으로 내 예약 조회, 예약 취소.
- 데이터는 Firestore의 `reservations` 컬렉션에 저장하며, 필드는 `ownerId`, `teacherName`, `room`, `date`(YYYY-MM-DD), `startTime`/`endTime`(HH:mm), `createdAt`, `status`로 구성한다.
- 동일 장소·동일 날짜·겹치는 시간대 예약은 금지되어야 하며, 동시성 처리를 위해 Firestore 트랜잭션(`runTransaction`)을 사용한다.

## Commands

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — run ESLint over the project

There is no test runner configured in this project.

## Architecture

This is a stock Vite + React (JS, not TS) single-page app, still very close to the `create-vite` starter template.

- `src/main.jsx` — entry point; mounts `<App />` into `#root` inside `React.StrictMode`.
- `src/App.jsx` — currently the only component; all UI lives here as a single file.
- `src/App.css` / `src/index.css` — plain CSS (not CSS Modules). `index.css` defines the color/typography design tokens as CSS custom properties on `:root`, including a `prefers-color-scheme: dark` override block. `App.css` holds component-level styles and uses native CSS nesting (`&:hover`, `&.foo { ... }`).
- `public/icons.svg` — SVG sprite sheet; icons are referenced elsewhere via `<use href="/icons.svg#icon-id">` rather than importing individual icon files.
- `index.html` — Vite's HTML entry; loads `src/main.jsx` as a module.

Tailwind CSS v4 is wired up via the `@tailwindcss/vite` plugin (registered in `vite.config.js`) and `@import 'tailwindcss';` at the top of `src/index.css`. Existing styling still uses plain CSS custom properties defined in `index.css`; new UI can use Tailwind utility classes alongside them.

ESLint config (`eslint.config.js`) is flat-config style, scoped to `**/*.{js,jsx}`, and extends `@eslint/js` recommended rules plus `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` (Vite-tuned).
