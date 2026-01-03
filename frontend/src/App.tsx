import { useMemo, useState } from "react";
import { Tabs } from "@mantine/core";
import { IconBook, IconDatabaseExport, IconGitPullRequest, IconHistory, IconServer } from "@tabler/icons-react";

import { ConsoleShell } from "./components/layout/ConsoleShell";
import { RecordsPage } from "./components/records/RecordsPage";
import { ExportsPage } from "./components/exports/ExportsPage";
import { ChangesPage } from "./components/changes/ChangesPage";
import { AuditPage } from "./components/audit/AuditPage";
import { useDnsStore } from "./state/DnsStore";

export default function App() {
  const { state, activeZone } = useDnsStore();
  const pending = useMemo(
    () => state.changes.filter((c) => c.zoneId === activeZone.id && c.status === "PENDING").length,
    [state.changes, activeZone.id]
  );

  const [tab, setTab] = useState<string | null>("records");

  return (
    <ConsoleShell>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="records" leftSection={<IconBook size={16} />}>Records</Tabs.Tab>
          <Tabs.Tab value="delegation" leftSection={<IconServer size={16} />}>Delegation</Tabs.Tab>
          <Tabs.Tab value="exports" leftSection={<IconDatabaseExport size={16} />}>Exports</Tabs.Tab>
          <Tabs.Tab value="changes" leftSection={<IconGitPullRequest size={16} />}>
            Changes {pending ? `(${pending})` : ""}
          </Tabs.Tab>
          <Tabs.Tab value="audit" leftSection={<IconHistory size={16} />}>Audit</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="records" pt="md">
          <RecordsPage />
        </Tabs.Panel>

        <Tabs.Panel value="delegation" pt="md">
          {/* Delegation lives in the shell via drawer trigger; keep this simple */}
          <RecordsPage initialFilter="NS" />
        </Tabs.Panel>

        <Tabs.Panel value="exports" pt="md">
          <ExportsPage />
        </Tabs.Panel>

        <Tabs.Panel value="changes" pt="md">
          <ChangesPage />
        </Tabs.Panel>

        <Tabs.Panel value="audit" pt="md">
          <AuditPage />
        </Tabs.Panel>
      </Tabs>
    </ConsoleShell>
  );
}
