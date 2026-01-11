import { useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Zone, ZoneType } from "../../types/dns";
import { fqdnJoin, normalizeFqdn, nowIso, uid } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";

export function DelegationDrawer({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { activeZone, upsertRecordSet, createZone } = useDnsStore();

  const [label, setLabel] = useState("dev");
  const [ns1, setNs1] = useState("ns1.devns.example.net.");
  const [ns2, setNs2] = useState("ns2.devns.example.net.");
  const [createChild, setCreateChild] = useState(true);
  const [childType, setChildType] = useState<ZoneType>("forward");

  const childFqdn = useMemo(
    () => (activeZone ? fqdnJoin(label || "dev", activeZone.name) : ""),
    [label, activeZone],
  );

  const submit = () => {
    if (!activeZone) return;
    const targets = [normalizeFqdn(ns1), normalizeFqdn(ns2)].filter(Boolean);
    if (!label.trim())
      return notifications.show({
        color: "red",
        title: "Missing subdomain",
        message: "Enter a label (dev)",
      });
    if (targets.some((t) => !t.endsWith(".")))
      return notifications.show({
        color: "red",
        title: "NS must be FQDN",
        message: "End NS with a dot.",
      });

    upsertRecordSet(
      {
        id: uid(),
        zoneId: activeZone.id,
        name: childFqdn,
        type: "NS",
        ttl: 300,
        values: targets.map((v) => ({ id: uid(), value: v })),
        routing: { policy: "simple" },
        comment: "Delegation",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      `Delegate ${childFqdn}`,
      [`NS delegation created`, ...targets.map((t) => `+ NS ${t}`)],
    );

    if (createChild) {
      const z: Zone = {
        id: uid(),
        name: childFqdn,
        type: childType,
        comment: `Child zone for ${childFqdn}`,
        tags: ["child", "delegated"],
        createdAt: nowIso(),
        dnssecEnabled: false,
        defaultTtl: 300,
        allowTransferTo: [],
        notifyTargets: [],
        soa: {
          primaryNs: targets[0],
          adminEmail: `hostmaster.${childFqdn}`,
          refresh: 3600,
          retry: 600,
          expire: 1209600,
          minimum: 300,
        },
        nameServers: targets.map((t) => ({ hostname: t, ipv4: "" })), // IPv4 is a UI stub
      };
      createZone(z);
    }

    notifications.show({
      color: "green",
      title: "Delegation created",
      message: `NS for ${childFqdn}`,
    });
    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title="Delegate subdomain"
    >
      {!activeZone ? (
        <Text c="dimmed">No zone selected</Text>
      ) : (
        <Stack>
          <Paper withBorder p="md" radius="md">
            <Text fw={700}>Parent zone</Text>
            <Text size="sm" c="dimmed">
              {activeZone.name}
            </Text>
          </Paper>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Subdomain label"
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Child zone type"
                value={childType}
                onChange={(v) => setChildType((v as ZoneType) ?? "public")}
                data={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
                disabled={!createChild}
              />
            </Grid.Col>
          </Grid>

          <Text size="sm" c="dimmed">
            Child FQDN: {childFqdn}
          </Text>

          <Paper withBorder p="md" radius="md">
            <Text fw={700} mb="sm">
              Authoritative NS targets
            </Text>
            <TextInput
              label="NS #1"
              value={ns1}
              onChange={(e) => setNs1(e.currentTarget.value)}
            />
            <TextInput
              mt="sm"
              label="NS #2"
              value={ns2}
              onChange={(e) => setNs2(e.currentTarget.value)}
            />
          </Paper>

          <Switch
            checked={createChild}
            onChange={(e) => setCreateChild(e.currentTarget.checked)}
            label="Also create hosted zone for child"
            description="UI stub: creates a separate zone you can switch to in the sidebar."
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit}>Create delegation</Button>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}
