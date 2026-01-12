import { useState } from "react";
import {
  ActionIcon,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  Paper,
  Radio,
  SegmentedControl,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { Zone, ZoneType } from "../../types/dns";
import { normalizeFqdn, nowIso, uid } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";
import { useCreateZone } from "../../hooks";
import { zoneToApiZoneCreate } from "../../lib/converters";
import type { ApiNameServer } from "../../api/types";

interface NameServerEntry {
  id: string;
  hostname: string;
  ipv4: string;
}

export function CreateZoneModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { createZone, refetchZones } = useDnsStore();
  const { createZone: createZoneApi } = useCreateZone();
  const [name, setName] = useState("");
  const [type, setType] = useState<ZoneType>("forward");
  const [role, setRole] = useState<"primary" | "secondary">("primary");
  const [tags, setTags] = useState<string[]>([]);
  const [dnssec, setDnssec] = useState(false);
  const [nameservers, setNameservers] = useState<NameServerEntry[]>([
    { id: uid(), hostname: "", ipv4: "" },
  ]);
  const [primaryNsId, setPrimaryNsId] = useState<string>("");
  const [reverseNetwork, setReverseNetwork] = useState("");
  const [reverseType, setReverseType] = useState<"ipv4" | "ipv6">("ipv4");

  const submit = async () => {
    let fqdn: string;

    if (type === "reverse") {
      // Generate reverse zone name from network
      if (!reverseNetwork.trim()) {
        notifications.show({
          color: "red",
          title: "Network required",
          message: "Enter a network address for the reverse zone",
        });
        return;
      }
      fqdn = generateReverseZoneName(reverseNetwork, reverseType);
      if (!fqdn) {
        notifications.show({
          color: "red",
          title: "Invalid network",
          message: "Enter a valid network (e.g., 192.168.1.0/24)",
        });
        return;
      }
    } else {
      fqdn = normalizeFqdn(name);
      if (!fqdn || !fqdn.includes(".")) {
        notifications.show({
          color: "red",
          title: "Invalid zone",
          message: "Use something like example.com",
        });
        return;
      }
    }

    const validNameservers = nameservers.filter(
      (ns) => ns.hostname.trim() && ns.ipv4.trim(),
    );
    
    // For secondary zones, we don't need nameservers
    if (role === "primary") {
      if (validNameservers.length === 0) {
        notifications.show({
          color: "red",
          title: "Nameservers required",
          message: "Add at least one nameserver for primary zones",
        });
        return;
      }

      // For reverse zones, validate that nameservers are FQDNs
      if (type === "reverse") {
        const invalidNs = validNameservers.find(
          (ns) => !ns.hostname.includes(".") || ns.hostname === ".",
        );
        if (invalidNs) {
          notifications.show({
            color: "red",
            title: "Invalid nameserver",
            message:
              "Reverse zones require fully qualified nameserver hostnames (e.g., ns1.example.com)",
          });
          return;
        }
      }

      const primaryNs = nameservers.find((ns) => ns.id === primaryNsId);
      if (!primaryNs || !primaryNs.hostname.trim()) {
        notifications.show({
          color: "red",
          title: "Primary NS required",
          message: "Select a primary nameserver",
        });
        return;
      }
    }

    const apiNameservers: ApiNameServer[] = validNameservers.map((ns) => ({
      hostname: ns.hostname.trim(),
      ipv4: ns.ipv4.trim(),
    }));

    const primaryNs = nameservers.find((ns) => ns.id === primaryNsId);
    
    const z: Zone = {
      id: uid(),
      name: fqdn,
      type,
      role,
      tags,
      dnssecEnabled: dnssec,
      createdAt: nowIso(),
      comment: "",
      defaultTtl: 300,
      allowTransferTo: [],
      notifyTargets: [],
      soa: {
        primaryNs: primaryNs?.hostname || "ns1.example.com.",
        adminEmail: `hostmaster.${fqdn}`,
        refresh: 3600,
        retry: 600,
        expire: 1209600,
        minimum: 300,
      },
      nameServers: apiNameservers,
    };

    console.log("Creating zone", z, apiNameservers);

    const apiPayload = zoneToApiZoneCreate(z, apiNameservers);
    apiPayload.role = role; // Add zone role
    const apiZone = await createZoneApi(apiPayload);

    if (apiZone) {
      await createZone(z);
      notifications.show({
        color: "green",
        title: "Zone created",
        message: z.name,
      });
      resetForm();
      onClose();
      refetchZones();
    }
  };

  const resetForm = () => {
    setName("");
    setTags([]);
    setDnssec(false);
    setType("forward");
    setRole("primary");
    setNameservers([{ id: uid(), hostname: "", ipv4: "" }]);
    setPrimaryNsId("");
    setReverseNetwork("");
    setReverseType("ipv4");
  };

  const generateReverseZoneName = (
    network: string,
    ipType: "ipv4" | "ipv6",
  ): string => {
    if (ipType === "ipv4") {
      // Parse IPv4 network (e.g., "192.168.1.0/24")
      const match = network.match(
        /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d+))?$/,
      );
      if (!match) return "";

      const [, oct1, oct2, oct3, _, cidr] = match;
      const prefix = cidr ? parseInt(cidr) : 24;

      // Generate reverse zone based on CIDR
      if (prefix >= 24) {
        return `${oct3}.${oct2}.${oct1}.in-addr.arpa.`;
      } else if (prefix >= 16) {
        return `${oct2}.${oct1}.in-addr.arpa.`;
      } else if (prefix >= 8) {
        return `${oct1}.in-addr.arpa.`;
      }
      return "";
    } else {
      // For IPv6, support simplified reverse zone creation
      // User can enter like "2001:db8::/32"
      notifications.show({
        color: "orange",
        title: "IPv6 reverse zones",
        message:
          "Enter the full reverse zone name (e.g., 8.b.d.0.1.0.0.2.ip6.arpa.)",
      });
      return normalizeFqdn(network);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addNameserver = () => {
    const newNs = { id: uid(), hostname: "", ipv4: "" };
    setNameservers([...nameservers, newNs]);
  };

  const removeNameserver = (id: string) => {
    if (nameservers.length <= 1) return;
    setNameservers(nameservers.filter((ns) => ns.id !== id));
    if (primaryNsId === id) {
      setPrimaryNsId(nameservers.find((ns) => ns.id !== id)?.id || "");
    }
  };

  const updateNameserver = (
    id: string,
    field: "hostname" | "ipv4",
    value: string,
  ) => {
    setNameservers(
      nameservers.map((ns) => (ns.id === id ? { ...ns, [field]: value } : ns)),
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Create hosted zone"
      size="lg"
    >
      <Stack>
        <SegmentedControl
          value={type}
          onChange={(v) => setType(v as ZoneType)}
          data={[
            { value: "forward", label: "Forward" },
            { value: "reverse", label: "Reverse" },
          ]}
        />

        <SegmentedControl
          value={role}
          onChange={(v) => setRole(v as "primary" | "secondary")}
          data={[
            { value: "primary", label: "Primary" },
            { value: "secondary", label: "Secondary" },
          ]}
        />

        {role === "secondary" && (
          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed">
              Secondary zones replicate from the primary servers configured in Settings.
              The zone will be automatically transferred from your primary DNS server.
            </Text>
          </Paper>
        )}

        {type === "reverse" ? (
          <Stack gap="sm">
            <Radio.Group
              value={reverseType}
              onChange={(v) => setReverseType(v as "ipv4" | "ipv6")}
              label="IP Version"
            >
              <Group mt="xs">
                <Radio value="ipv4" label="IPv4" />
                <Radio value="ipv6" label="IPv6" />
              </Group>
            </Radio.Group>

            <TextInput
              label={
                reverseType === "ipv4" ? "Network (CIDR)" : "Reverse zone name"
              }
              placeholder={
                reverseType === "ipv4"
                  ? "192.168.1.0/24"
                  : "8.b.d.0.1.0.0.2.ip6.arpa."
              }
              value={reverseNetwork}
              onChange={(e) => setReverseNetwork(e.currentTarget.value)}
              description={
                reverseType === "ipv4"
                  ? "Enter the network in CIDR notation. Zone will be created as X.Y.Z.in-addr.arpa"
                  : "Enter the full IPv6 reverse zone name"
              }
            />
            {reverseType === "ipv4" && reverseNetwork && (
              <Text size="sm" c="dimmed">
                Zone will be:{" "}
                <strong>
                  {generateReverseZoneName(reverseNetwork, "ipv4") ||
                    "(invalid)"}
                </strong>
              </Text>
            )}
          </Stack>
        ) : (
          <TextInput
            label="Zone name"
            placeholder="example.com"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        )}

        {role === "primary" && (
          <>
            <Divider label="Nameservers" labelPosition="left" />

            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Define the authoritative nameservers for this zone. Each NS will
                  have an A record created.
                </Text>

            {nameservers.map((ns, index) => (
              <Paper key={ns.id} withBorder p="sm" radius="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Radio
                      label="Primary"
                      checked={primaryNsId === ns.id}
                      onChange={() => setPrimaryNsId(ns.id)}
                      disabled={!ns.hostname.trim()}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => removeNameserver(ns.id)}
                      disabled={nameservers.length <= 1}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>

                  <Grid>
                    <Grid.Col span={7}>
                      <TextInput
                        label={`NS ${index + 1} Hostname`}
                        placeholder={
                          type === "reverse" ? "ns1.example.com" : "ns1"
                        }
                        value={ns.hostname}
                        onChange={(e) =>
                          updateNameserver(
                            ns.id,
                            "hostname",
                            e.currentTarget.value,
                          )
                        }
                        description={
                          type === "reverse"
                            ? "Must be a fully qualified domain name"
                            : undefined
                        }
                      />
                    </Grid.Col>
                    <Grid.Col span={5}>
                      <TextInput
                        label="IPv4 Address"
                        placeholder="203.0.113.1"
                        value={ns.ipv4}
                        onChange={(e) =>
                          updateNameserver(ns.id, "ipv4", e.currentTarget.value)
                        }
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>
            ))}

            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={addNameserver}
            >
              Add nameserver
            </Button>
          </Stack>
        </Paper>
          </>
        )}

        <TagsInput
          label="Tags"
          placeholder="Add tags"
          value={tags}
          onChange={setTags}
          data={[
            "prod",
            "dev",
            "lab",
            "public",
            "private",
            "dnssec",
            "internal",
            "external",
          ].map((x) => ({ value: x, label: x }))}
        />
        {role === "primary" && (
          <Switch
            checked={dnssec}
            onChange={(e) => setDnssec(e.currentTarget.checked)}
            label="Enable DNSSEC (UI stub)"
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
