import { useMemo, useState } from "react";
import { Tabs, Button, Group, Stack } from "@mantine/core";
import {
  IconBook,
  IconDatabaseExport,
  IconGitPullRequest,
  IconHistory,
  IconServer,
  IconSettings,
} from "@tabler/icons-react";

import { ConsoleShell } from "./components/layout/ConsoleShell";
import { RecordsPage } from "./components/records/RecordsPage";
import { ExportsPage } from "./components/exports/ExportsPage";
import { ChangesPage } from "./components/changes/ChangesPage";
import { AuditPage } from "./components/audit/AuditPage";
import { DelegationDrawer } from "./components/delegation/DelegationDrawer";
import { ZoneSettingsPage } from "./components/settings/ZoneSettingsPage";
import { useDnsStore } from "./state/DnsStore";

export default function App() {
  const { state, activeZone } = useDnsStore();
  const pending = useMemo(
    () =>
      state.changes.filter(
        (c) => c.zoneId === activeZone?.id && c.status === "PENDING",
      ).length,
    [state.changes, activeZone?.id],
  );

  const [tab, setTab] = useState<string | null>("records");
  const [delegationOpen, setDelegationOpen] = useState(false);

  return (
    <ConsoleShell>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="records" leftSection={<IconBook size={16} />}>
            Records
          </Tabs.Tab>
          <Tabs.Tab value="delegation" leftSection={<IconServer size={16} />}>
            Delegation
          </Tabs.Tab>
          <Tabs.Tab
            value="exports"
            leftSection={<IconDatabaseExport size={16} />}
          >
            Exports
          </Tabs.Tab>
          <Tabs.Tab
            value="changes"
            leftSection={<IconGitPullRequest size={16} />}
          >
            Changes {pending ? `(${pending})` : ""}
          </Tabs.Tab>
          <Tabs.Tab value="audit" leftSection={<IconHistory size={16} />}>
            Audit
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Settings
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="records" pt="md">
          <RecordsPage />
        </Tabs.Panel>
        <Tabs.Panel value="delegation" pt="md">
          <Stack gap="md">
            {activeZone?.role !== "secondary" && (
              <Group justify="flex-end">
                <Button
                  variant="light"
                  leftSection={<IconServer size={16} />}
                  onClick={() => setDelegationOpen(true)}
                >
                  Delegate subdomain
                </Button>
              </Group>
            )}
            {/* For secondary zones, show same status as Records page */}
            {/* For primary zones, show NS records */}
            <RecordsPage
              initialFilter={
                activeZone?.role === "secondary" ? undefined : "NS"
              }
            />
          </Stack>
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

        <Tabs.Panel value="settings" pt="md">
          <ZoneSettingsPage />
        </Tabs.Panel>
      </Tabs>

      <DelegationDrawer
        opened={delegationOpen}
        onClose={() => setDelegationOpen(false)}
      />
    </ConsoleShell>
  );
}
