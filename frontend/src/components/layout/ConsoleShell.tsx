import React, { useEffect, useMemo, useState } from "react";
import {
  AppShell,
  Box,
  Button,
  Container,
  Drawer,
  Group,
  Kbd,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconNetwork,
  IconPlus,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";

import { ZonesSidebar } from "../zones/ZonesSidebar";
import { RecordSetModal } from "../records/RecordSetModal";
import { SettingsPage } from "../settings/SettingsPage";
import { useDnsStore } from "../../state/DnsStore";

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { state, activeZone, applyPendingChanges } = useDnsStore();

  const pending = useMemo(
    () =>
      activeZone
        ? state.changes.filter(
            (c) => c.zoneId === activeZone.id && c.status === "PENDING",
          ).length
        : 0,
    [state.changes, activeZone],
  );

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Detect OS for keyboard shortcut display
  const isMac = useMemo(
    () =>
      typeof window !== "undefined" &&
      /Mac|iPhone|iPod|iPad/.test(navigator.platform),
    []
  );
  const modifierKey = isMac ? "⌘" : "Ctrl";

  // Keyboard shortcut: Cmd+R (Mac) or Ctrl+R (Windows/Linux) to create record
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "r") {
        event.preventDefault();
        setRecordModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
                <Title order={4} style={{ lineHeight: 1.1 }}>
                  DNS Console
                </Title>
                <Text size="xs" c="dimmed">
                  BIND-style zones • recordsets • delegation • exports • changes
                  {" · "}
                  <Kbd>{modifierKey}</Kbd>+<Kbd>R</Kbd> create record
                </Text>
              </Box>
            </Group>

            <Group>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setRecordModalOpen(true)}
              >
                Create record
              </Button>
              <Button
                variant="light"
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
                onClick={() => setSettingsOpen(true)}
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

      <RecordSetModal
        opened={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
      />

      <Drawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        size="xl"
        position="right"
        title={
          <Group>
            <IconSettings size={20} />
            <Text fw={600}>BIND Server Configuration</Text>
          </Group>
        }
      >
        <SettingsPage />
      </Drawer>
    </>
  );
}
