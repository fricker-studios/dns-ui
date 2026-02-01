import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";

import App from "./App";
import { theme } from "./theme";
import { DnsStoreProvider } from "./state/DnsStore";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="bottom-right" />
      <DnsStoreProvider>
        <App />
      </DnsStoreProvider>
    </MantineProvider>
  </React.StrictMode>,
);
