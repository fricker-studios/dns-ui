import React, { useEffect, useMemo, useState } from "react";
import {
  AppShell,
  Box,
  Burger,
  Button,
  Container,
  Drawer,
  Group,
  Kbd,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
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
  const [mobileNavOpened, { toggle: toggleMobileNav, close: closeMobileNav }] =
    useDisclosure();

  // Media query for responsive behavior
  const isMobile = useMediaQuery("(max-width: 768px)");

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
        header={{ height: isMobile ? 60 : 64 }}
        navbar={{
          width: 320,
          breakpoint: "sm",
          collapsed: { mobile: !mobileNavOpened },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Burger
                opened={mobileNavOpened}
                onClick={toggleMobileNav}
                hiddenFrom="sm"
                size="sm"
              />
              <ThemeIcon size="lg" radius="md" variant="light">
                <IconNetwork size={18} />
              </ThemeIcon>
              <Box>
                <Title order={4} style={{ lineHeight: 1.1 }}>
                  DNS Console
                </Title>
                {!isMobile && (
                  <Text size="xs" c="dimmed">
                    BIND-style zones • recordsets • delegation • exports •
                    changes
                    {" · "}
                    <Kbd>{modifierKey}</Kbd>+<Kbd>R</Kbd> create record
                  </Text>
                )}
              </Box>
            </Group>

            <Group gap="xs" wrap="nowrap">
              {!isMobile && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setRecordModalOpen(true)}
                  disabled={activeZone?.role === "secondary"}
                >
                  Create record
                </Button>
              )}
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                disabled={!activeZone || pending === 0}
                onClick={() => {
                  applyPendingChanges();
                }}
                size={isMobile ? "compact-sm" : "sm"}
              >
                {isMobile ? `(${pending})` : `Apply changes ${pending ? `(${pending})` : ""}`}
              </Button>
              {!isMobile && (
                <Button
                  variant="default"
                  leftSection={<IconSettings size={16} />}
                  onClick={() => setSettingsOpen(true)}
                  size="sm"
                >
                  Settings
                </Button>
              )}
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <ZonesSidebar onZoneSelect={isMobile ? closeMobileNav : undefined} />
        </AppShell.Navbar>

        <AppShell.Main>
          <Container size="xl">{children}</Container>
        </AppShell.Main>
      </AppShell>

      {isMobile && (
        <Group
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            gap: 8,
            zIndex: 100,
          }}
        >
          <Button
            size="lg"
            radius="xl"
            leftSection={<IconPlus size={20} />}
            onClick={() => setRecordModalOpen(true)}
            disabled={activeZone?.role === "secondary"}
          >
            Record
          </Button>
          <Button
            size="lg"
            radius="xl"
            variant="default"
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings size={20} />
          </Button>
        </Group>
      )}

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
