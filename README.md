# Beak Design

A canvas-based design tool with AI-powered assistance, supporting both cloud and local AI agents. 

# Getting Started

## Prerequisites

- Node.js and pnpm
- Rust (for Tauri desktop app) - [Install Rust](https://www.rust-lang.org/tools/install)
- System dependencies:
  - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools

## Running the Application

### Web Version (Browser)

To run as a web application:

```bash
pnpm install
pnpm dev
```

### Desktop Version (Tauri)

To run as a desktop application with native file system access:

```bash
pnpm install
pnpm tauri:dev
```

The first build may take several minutes as Rust dependencies compile.

# AI Agent Setup

Beak Design supports multiple AI agents for design assistance:

## Cloud Agent (Anthropic Claude)

1. Get API key from [Anthropic Console](https://console.anthropic.com)
2. Create `.env` file: `ANTHROPIC_API_KEY=your_key_here`
3. Cloud agent will be available automatically

## Local Ollama Agent

1. Install Ollama: https://ollama.com
2. Start server: `ollama serve`
3. Install model: `ollama pull llama3.2`
4. Ollama agent will auto-detect

## CLI Tools

1. Install CLI tool (codex, geminicli, claudecode)
2. Ensure tool is in PATH
3. Configure via Agent Settings dialog

See [docs/09-quick-start-guide.md](./docs/09-quick-start-guide.md) for detailed setup instructions.

# Building For Production

### Web Version

To build the web application:

```bash
pnpm build
```

### Desktop Version (Tauri)

To build the desktop application:

```bash
pnpm tauri:build
```

The built application will be in `src-tauri/target/release/` (or `target/debug/` for debug builds).

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.


## Linting & Formatting


This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
pnpm lint
pnpm format
pnpm check
```


# Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) folder:

- **[Quick Start Guide](./docs/09-quick-start-guide.md)** - Get started with AI agents
- **[Architecture Overview](./docs/00-architecture-overview.md)** - System architecture
- **[Agent Integration](./docs/01-agent-integration.md)** - AI chat system
- **[Local Agent Integration](./docs/08-local-agent-integration.md)** - Local agent setup
- **[MCP Tools](./docs/02-mcp-tools.md)** - Tool system
- **[Canvas System](./docs/03-canvas-system.md)** - Rendering system
- And more...

See [docs/README.md](./docs/README.md) for full documentation index.

# TanStack Chat Application

A design tool application built with TanStack Start, TanStack Store, and AI agents (Cloud + Local).

## Environment Configuration

### For Cloud Agent (Optional)

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Note**: `ANTHROPIC_API_KEY` is optional. You can use local agents (Ollama, CLI, MCP) without it.

See [docs/09-quick-start-guide.md](./docs/09-quick-start-guide.md) for agent setup instructions.

## ✨ Features

### AI Capabilities
- 🤖 Powered by Claude 3.5 Sonnet 
- 📝 Rich markdown formatting with syntax highlighting
- 🎯 Customizable system prompts for tailored AI behavior
- 🔄 Real-time message updates and streaming responses (coming soon)

### User Experience
- 🎨 Modern UI with Tailwind CSS and Lucide icons
- 🔍 Conversation management and history
- 🔐 Secure API key management
- 📋 Markdown rendering with code highlighting

### Technical Features
- 📦 Centralized state management with TanStack Store
- 🔌 Extensible architecture for multiple AI providers
- 🛠️ TypeScript for type safety

## Architecture

### Tech Stack
- **Frontend Framework**: TanStack Start
- **Routing**: TanStack Router
- **State Management**: TanStack Store
- **Styling**: Tailwind CSS
- **AI Integration**: Anthropic's Claude API

## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpm dlx shadcn@latest add button
```


## T3Env

- You can use T3Env to add type safety to your environment variables.
- Add Environment variables to the `src/env.mjs` file.
- Use the environment variables in your code.

### Usage

```ts
import { env } from "@/env";

console.log(env.VITE_APP_TITLE);
```






## Routing
This project uses [TanStack Router](https://tanstack.com/router). The initial setup is a file based router. Which means that the routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add another a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you use the `<Outlet />` component.

Here is an example layout that includes a header:

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
```

The `<TanStackRouterDevtools />` component is not required so you can remove it if you don't want it in your layout.

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).


## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  loader: async () => {
    const response = await fetch("https://swapi.dev/api/people");
    return response.json() as Promise<{
      results: {
        name: string;
      }[];
    }>;
  },
  component: () => {
    const data = peopleRoute.useLoaderData();
    return (
      <ul>
        {data.results.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    );
  },
});
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

### React-Query

React-Query is an excellent addition or alternative to route loading and integrating it into you application is a breeze.

First add your dependencies:

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

Next we'll need to create a query client and provider. We recommend putting those in `main.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ...

const queryClient = new QueryClient();

// ...

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

You can also add TanStack Query Devtools to the root route (optional).

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools />
    </>
  ),
});
```

Now you can use `useQuery` to fetch your data.

```tsx
import { useQuery } from "@tanstack/react-query";

import "./App.css";

function App() {
  const { data } = useQuery({
    queryKey: ["people"],
    queryFn: () =>
      fetch("https://swapi.dev/api/people")
        .then((res) => res.json())
        .then((data) => data.results as { name: string }[]),
    initialData: [],
  });

  return (
    <div>
      <ul>
        {data.map((person) => (
          <li key={person.name}>{person.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

You can find out everything you need to know on how to use React-Query in the [React-Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).

## State Management

Another common requirement for React applications is state management. There are many options for state management in React. TanStack Store provides a great starting point for your project.

First you need to add TanStack Store as a dependency:

```bash
pnpm add @tanstack/store
```

Now let's create a simple counter in the `src/App.tsx` file as a demonstration.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

function App() {
  const count = useStore(countStore);
  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
    </div>
  );
}

export default App;
```

One of the many nice features of TanStack Store is the ability to derive state from other state. That derived state will update when the base state updates.

Let's check this out by doubling the count using derived state.

```tsx
import { useStore } from "@tanstack/react-store";
import { Store, Derived } from "@tanstack/store";
import "./App.css";

const countStore = new Store(0);

const doubledStore = new Derived({
  fn: () => countStore.state * 2,
  deps: [countStore],
});
doubledStore.mount();

function App() {
  const count = useStore(countStore);
  const doubledCount = useStore(doubledStore);

  return (
    <div>
      <button onClick={() => countStore.setState((n) => n + 1)}>
        Increment - {count}
      </button>
      <div>Doubled - {doubledCount}</div>
    </div>
  );
}

export default App;
```

We use the `Derived` class to create a new store that is derived from another store. The `Derived` class has a `mount` method that will start the derived store updating.

Once we've created the derived store we can use it in the `App` component just like we would any other store using the `useStore` hook.

You can find out everything you need to know on how to use TanStack Store in the [TanStack Store documentation](https://tanstack.com/store/latest).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).
