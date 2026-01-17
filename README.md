# Collab Docs

Collaborative document editor built with Next.js App Router, Convex, and Clerk. It offers a Google Docs-style home screen, template-based creation, and a rich text editor powered by Tiptap.

Try out: https://collab-docs-umber.vercel.app/
![image alt](https://github.com/lghuy05/collab-docs/blob/7247f5ec71597f22da61b4aea14ca012ff25d540/home.png)
![image alt](https://github.com/lghuy05/collab-docs/blob/7247f5ec71597f22da61b4aea14ca012ff25d540/vimguide.png)
![image alt](https://github.com/lghuy05/collab-docs/blob/7247f5ec71597f22da61b4aea14ca012ff25d540/document.png)
![image alt](https://github.com/lghuy05/collab-docs/blob/fcf4bc32b666b5166f40524abc90e9fc674ba1f4/collaborative2.png)

## Demo vid
[![Watch the video](https://img.youtube.com/vi/Wjo3DDHh8Uw/maxresdefault.jpg)](https://youtu.be/Wjo3DDHh8Uw)

## Features

- Template gallery for fast document creation.
- Document list with search and pagination.
- Rich text editor with tables, tasks, images, colors, highlights, underline, font family, font size, and line-height controls.
- Vim-style editing mode (via `@prose-motions/core`).
- Clerk authentication with Convex-backed document storage.

## Tech Stack

- Next.js 15 (App Router) + React 19 RC
- Convex (database, queries, and mutations)
- Clerk (auth)
- Tiptap (editor)
- Tailwind CSS + Radix UI primitives

## Project Structure

- `src/app` Next.js routes (home and document editor)
- `convex` backend schema, queries, and mutations
- `src/components` shared UI and app components
- `src/extensions` Tiptap editor extensions
- `src/constants/template.ts` template definitions

