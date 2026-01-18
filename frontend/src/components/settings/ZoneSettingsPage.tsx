import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconTrash,
} from "@tabler/icons-react";
import { useDnsStore } from "../../state/DnsStore";
import { useZoneSettings } from "../../hooks/useZoneSettings";
import type { ZoneDetail } from "../../types/zone-settings";

export function ZoneSettingsPage() {
  const { activeZone, refetchZones } = useDnsStore();
  const { getZoneDetails, updateZoneSettings, deleteZone, loading, error } =
    useZoneSettings(activeZone?.name);

  const [zoneDetails, setZoneDetails] = useState<ZoneDetail | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Form state
  const [defaultTtl, setDefaultTtl] = useState(300);
  const [soaRefresh, setSoaRefresh] = useState(3600);
  const [soaRetry, setSoaRetry] = useState(600);
  const [soaExpire, setSoaExpire] = useState(1209600);
  const [soaMinimum, setSoaMinimum] = useState(300);
  const [hasChanges, setHasChanges] = useState(false);

  // Load zone details when active zone changes
  useEffect(() => {
    if (activeZone) {
      loadZoneDetails();
    }
  }, [activeZone?.name]);

  const loadZoneDetails = async () => {
    const details = await getZoneDetails();
    if (details) {
      setZoneDetails(details);
      setDefaultTtl(details.default_ttl);
      // Only load SOA details for primary zones
      if (details.soa) {
        setSoaRefresh(details.soa.refresh);
        setSoaRetry(details.soa.retry);
        setSoaExpire(details.soa.expire);
        setSoaMinimum(details.soa.minimum);
      }
      setHasChanges(false);
    }
  };

  const handleSave = async () => {
    if (!zoneDetails) return;

    const updates = {
      default_ttl:
        defaultTtl !== zoneDetails.default_ttl ? defaultTtl : undefined,
      soa_refresh:
        zoneDetails.soa && soaRefresh !== zoneDetails.soa.refresh
          ? soaRefresh
          : undefined,
      soa_retry:
        zoneDetails.soa && soaRetry !== zoneDetails.soa.retry
          ? soaRetry
          : undefined,
      soa_expire:
        zoneDetails.soa && soaExpire !== zoneDetails.soa.expire
          ? soaExpire
          : undefined,
      soa_minimum:
        zoneDetails.soa && soaMinimum !== zoneDetails.soa.minimum
          ? soaMinimum
          : undefined,
    };

    // Remove undefined values
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(payload).length === 0) {
      notifications.show({
        color: "blue",
        title: "No changes",
        message: "No settings were modified",
      });
      return;
    }

    const result = await updateZoneSettings(payload);
    if (result) {
      notifications.show({
        color: "green",
        title: "Settings updated",
        message: `Zone ${activeZone?.name} settings saved`,
      });
      setZoneDetails(result);
      setHasChanges(false);
    } else {
      notifications.show({
        color: "red",
        title: "Update failed",
        message: error || "Failed to update zone settings",
      });
    }
  };

  const handleDelete = async () => {
    const success = await deleteZone();
    if (success) {
      notifications.show({
        color: "green",
        title: "Zone deleted",
        message: `Zone ${activeZone?.name} has been deleted`,
      });
      setDeleteModalOpen(false);
      refetchZones();
    } else {
      notifications.show({
        color: "red",
        title: "Delete failed",
        message: error || "Failed to delete zone",
      });
    }
  };

  const markChanged = () => setHasChanges(true);

  if (!activeZone) {
    return (
      <Alert color="blue" title="No zone selected">
        Select a zone from the sidebar to view its settings.
      </Alert>
    );
  }

  if (loading && !zoneDetails) {
    return (
      <Box p="xl" style={{ textAlign: "center" }}>
        <Loader size="lg" />
        <Text mt="md" c="dimmed">
          Loading zone settings...
        </Text>
      </Box>
    );
  }

  if (error && !zoneDetails) {
    return (
      <Alert color="red" title="Error loading settings">
        {error}
      </Alert>
    );
  }

  if (!zoneDetails) {
    return null;
  }

  return (
    <Stack gap="lg">
      {zoneDetails.role === "secondary" && (
        <Alert color="blue" title="Secondary Zone">
          This is a secondary zone that replicates from a primary server. SOA
          and recordset management is not available for secondary zones.
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Zone Settings</Title>
            {hasChanges && (
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSave}
                loading={loading}
              >
                Save changes
              </Button>
            )}
          </Group>

          <Divider label="Default TTL" labelPosition="left" />

          <NumberInput
            label="Default TTL (seconds)"
            description="Default Time To Live for records in this zone"
            value={defaultTtl}
            onChange={(val) => {
              setDefaultTtl(Number(val));
              markChanged();
            }}
            min={60}
            max={86400}
            step={60}
          />

          {zoneDetails.soa && (
            <>
              <Divider label="SOA Record Timers" labelPosition="left" />

              <Text size="sm" c="dimmed">
                Start of Authority (SOA) record defines zone refresh timing and
                behavior.
              </Text>

              <Group grow>
                <NumberInput
                  label="Refresh (seconds)"
                  description="How often secondary servers check for updates"
                  value={soaRefresh}
                  onChange={(val) => {
                    setSoaRefresh(Number(val));
                    markChanged();
                  }}
                  min={300}
                  max={86400}
                />
                <NumberInput
                  label="Retry (seconds)"
                  description="How long secondary waits before retrying after failed refresh"
                  value={soaRetry}
                  onChange={(val) => {
                    setSoaRetry(Number(val));
                    markChanged();
                  }}
                  min={60}
                  max={7200}
                />
              </Group>

              <Group grow>
                <NumberInput
                  label="Expire (seconds)"
                  description="How long secondary keeps data without successful refresh"
                  value={soaExpire}
                  onChange={(val) => {
                    setSoaExpire(Number(val));
                    markChanged();
                  }}
                  min={86400}
                  max={2419200}
                />
                <NumberInput
                  label="Minimum (seconds)"
                  description="Minimum TTL for negative caching"
                  value={soaMinimum}
                  onChange={(val) => {
                    setSoaMinimum(Number(val));
                    markChanged();
                  }}
                  min={60}
                  max={3600}
                />
              </Group>

              <Divider label="SOA Details (Read-only)" labelPosition="left" />

              <Group grow>
                <Box>
                  <Text size="sm" fw={500} c="dimmed">
                    Primary Nameserver
                  </Text>
                  <Text size="sm">{zoneDetails.soa.primary_ns}</Text>
                </Box>
                <Box>
                  <Text size="sm" fw={500} c="dimmed">
                    Admin Email
                  </Text>
                  <Text size="sm">{zoneDetails.soa.admin_email}</Text>
                </Box>
                <Box>
                  <Text size="sm" fw={500} c="dimmed">
                    Serial
                  </Text>
                  <Text size="sm" ff="monospace">
                    {zoneDetails.soa.serial}
                  </Text>
                </Box>
              </Group>
            </>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group>
            <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
            <Title order={3}>Danger Zone</Title>
          </Group>

          <Text size="sm" c="dimmed">
            Deleting a zone is permanent and cannot be undone. All records and
            configuration will be lost.
          </Text>

          <Group>
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} />}
              onClick={() => setDeleteModalOpen(true)}
            >
              Delete zone
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete zone"
        centered
      >
        <Stack gap="md">
          <Alert color="red" icon={<IconAlertTriangle size={16} />}>
            <Text fw={500}>Are you sure you want to delete this zone?</Text>
            <Text size="sm" mt="xs">
              Zone: <strong>{activeZone.name}</strong>
            </Text>
            <Text size="sm" mt="xs">
              This action cannot be undone. All DNS records will be permanently
              deleted.
            </Text>
          </Alert>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={loading}
              leftSection={<IconTrash size={16} />}
            >
              Delete zone
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
