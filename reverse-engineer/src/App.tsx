import { PostHogProvider } from "posthog-js/react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { IPCProvider } from "./contexts/ipc-context";
import { DEV_ENV, POSTHOG_HOST, POSTHOG_KEY } from "./lib/environment";
import Editor from "./pages/Editor";
import Generator from "./pages/Generator";

function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/editor/:fileName?" element={<Editor />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/" element={<Editor />} />
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  return (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{
        api_host: POSTHOG_HOST,
        defaults: "2025-05-24",
        capture_exceptions: true,
        debug: DEV_ENV,
      }}
    >
      <IPCProvider>
        <AppRoutes />
      </IPCProvider>
    </PostHogProvider>
  );
}
