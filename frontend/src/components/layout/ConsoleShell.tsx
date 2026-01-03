import React, { useMemo, useState } from "react";
import {
  AppShell,
  Box,
  Button,
  Container,
  Group,
  Kbd,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconNetwork, IconPlus, IconRefresh, IconServer, IconSettings } from "@tabler/icons-react";

import { ZonesSidebar } from "../zones/ZonesSidebar";
import { RecordSetModal } from "../records/RecordSetModal";
import { DelegationDrawer } from "../delegation/DelegationDrawer";
import { useDnsStore } from "../../state/DnsStore";

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { state, activeZone, applyPendingChanges } = useDnsStore();

  const pending = useMemo(
    () => activeZone ? state.changes.filter((c) => c.zoneId === activeZone.id && c.status === "PENDING").length : 0,
    [state.changes, activeZone]
  );

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);

  return (
    <>
      <AppShell
        padding="md"
        header={{ height: 64 }}
        navbar={{ width: 320, breakpoint: "sm" }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="md">
              <ThemeIcon size="lg" radius="md" variant="light">
                <IconNetwork size={18} />
              </ThemeIcon>
              <Box>
                <Title order={4} style={{ lineHeight: 1.1 }}>DNS Console</Title>
                <Text size="xs" c="dimmed">
                  BIND-style zones • recordsets • delegation • exports • changes
                  {" · "}
                  <Kbd>⌘</Kbd>+<Kbd>N</Kbd> create record
                </Text>
              </Box>
            </Group>

            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setRecordModalOpen(true)}>
                Create record
              </Button>
              <Button variant="light" leftSection={<IconServer size={16} />} onClick={() => setDelegationOpen(true)}>
                Delegate subdomain
              </Button>
              <Button
                variant={pending ? "filled" : "default"}
                leftSection={<IconRefresh size={16} />}
                disabled={!activeZone || pending === 0}
                onClick={() => {
                  applyPendingChanges();
                }}
              >
                Apply changes {pending ? `(${pending})` : ""}
              </Button>
              <Button
                variant="default"
                leftSection={<IconSettings size={16} />}
                onClick={() =>
                  notifications.show({
                    title: "Zone settings",
                    message: "Settings panel can be added here (SOA, ACLs, DNSSEC).",
                  })
                }
              >
                Settings
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <ZonesSidebar />
        </AppShell.Navbar>

        <AppShell.Main>
          <Container size="xl">{children}</Container>
        </AppShell.Main>
      </AppShell>

      <RecordSetModal opened={recordModalOpen} onClose={() => setRecordModalOpen(false)} />
      <DelegationDrawer opened={delegationOpen} onClose={() => setDelegationOpen(false)} />
    </>
  );
}
