import { useState, useEffect } from "react";
import {
  Card,
  Group,
  Stack,
  TextInput,
  Switch,
  Button,
  Title,
  Text,
  Badge,
  ActionIcon,
  Select,
} from "@mantine/core";
import { IconPlus, IconTrash, IconReload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  useBindConfig,
  useUpdateBindConfig,
  useReloadBindConfig,
  type BindConfig,
} from "../../hooks";

export function SettingsPage() {
  const { config, loading, refetch } = useBindConfig();
  const { updateConfig: updateConfigApi, loading: updating } =
    useUpdateBindConfig();
  const { reloadConfig: reloadConfigApi, loading: reloading } =
    useReloadBindConfig();

  const [editedConfig, setEditedConfig] = useState<BindConfig | null>(null);
  const [forwarders, setForwarders] = useState<string[]>([]);
  const [newForwarder, setNewForwarder] = useState("");

  // ACL management
  const [acls, setAcls] = useState<Record<string, string[]>>({});
  const [newAclName, setNewAclName] = useState("");
  const [newAclEntry, setNewAclEntry] = useState<Record<string, string>>({});

  // Allow-query management
  const [allowQuery, setAllowQuery] = useState<string[]>([]);
  const [newAllowQuery, setNewAllowQuery] = useState("");

  // Allow-transfer management
  const [allowTransfer, setAllowTransfer] = useState<string[]>([]);
  const [newAllowTransfer, setNewAllowTransfer] = useState("");

  // Initialize state when config loads
  useEffect(() => {
    if (config) {
      setEditedConfig(config);
      setForwarders(config.forwarders || []);
      setAcls(config.acls || {});
      setAllowQuery(config.allow_query || []);
      setAllowTransfer(config.allow_transfer || []);
    }
  }, [config]);

  const handleSave = async () => {
    if (!editedConfig) return;

    const updated: BindConfig = {
      ...editedConfig,
      forwarders,
      acls,
      allow_query: allowQuery,
      allow_transfer: allowTransfer,
    };

    const result = await updateConfigApi(updated);
    if (result) {
      notifications.show({
        title: "Success",
        message: "Configuration updated and BIND reloaded successfully",
        color: "green",
      });
      refetch();
    } else {
      notifications.show({
        title: "Error",
        message: "Failed to update configuration",
        color: "red",
      });
    }
  };

  const handleAddForwarder = () => {
    if (newForwarder && !forwarders.includes(newForwarder)) {
      setForwarders([...forwarders, newForwarder]);
      setNewForwarder("");
    }
  };

  const handleAddAcl = () => {
    if (newAclName && !acls[newAclName]) {
      setAcls({ ...acls, [newAclName]: [] });
      setNewAclName("");
    }
  };

  const handleRemoveAcl = (name: string) => {
    const newAcls = { ...acls };
    delete newAcls[name];
    setAcls(newAcls);
  };

  const handleAddAclEntry = (aclName: string) => {
    const entry = newAclEntry[aclName];
    if (entry && !acls[aclName].includes(entry)) {
      setAcls({
        ...acls,
        [aclName]: [...acls[aclName], entry],
      });
      setNewAclEntry({ ...newAclEntry, [aclName]: "" });
    }
  };

  const handleRemoveAclEntry = (aclName: string, entry: string) => {
    setAcls({
      ...acls,
      [aclName]: acls[aclName].filter((e) => e !== entry),
    });
  };

  const handleAddAllowQuery = () => {
    if (newAllowQuery && !allowQuery.includes(newAllowQuery)) {
      setAllowQuery([...allowQuery, newAllowQuery]);
      setNewAllowQuery("");
    }
  };

  const handleRemoveAllowQuery = (entry: string) => {
    setAllowQuery(allowQuery.filter((e) => e !== entry));
  };

  const handleAddAllowTransfer = () => {
    if (newAllowTransfer && !allowTransfer.includes(newAllowTransfer)) {
      setAllowTransfer([...allowTransfer, newAllowTransfer]);
      setNewAllowTransfer("");
    }
  };

  const handleRemoveAllowTransfer = (entry: string) => {
    setAllowTransfer(allowTransfer.filter((e) => e !== entry));
  };
  const handleRemoveForwarder = (ip: string) => {
    setForwarders(forwarders.filter((f) => f !== ip));
  };

  const handleReload = async () => {
    const result = await reloadConfigApi();
    if (result) {
      notifications.show({
        title: "Success",
        message: "BIND configuration reloaded",
        color: "green",
      });
    } else {
      notifications.show({
        title: "Error",
        message: "Failed to reload configuration",
        color: "red",
      });
    }
  };

  const updateConfig = (updates: Partial<BindConfig>) => {
    if (editedConfig) {
      setEditedConfig({ ...editedConfig, ...updates });
    }
  };

  if (loading || !editedConfig) {
    return <Text>Loading configuration...</Text>;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button onClick={handleSave} loading={updating}>
            Save Changes
          </Button>
          <Button
            leftSection={<IconReload size={16} />}
            variant="light"
            onClick={handleReload}
            loading={reloading}
          >
            Reload Config
          </Button>
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" withBorder>
        <Stack gap="md">
          <Title order={4}>General Settings</Title>

          <TextInput
            label="Directory"
            description="BIND working directory"
            value={editedConfig.directory || ""}
            onChange={(e) => updateConfig({ directory: e.currentTarget.value })}
            disabled
          />

          <Switch
            label="Recursion"
            description="Allow recursive queries"
            checked={editedConfig.recursion}
            onChange={(e) =>
              updateConfig({ recursion: e.currentTarget.checked })
            }
          />

          <Select
            label="DNSSEC Validation"
            description="DNSSEC validation mode"
            data={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "auto", label: "Auto" },
            ]}
            value={editedConfig.dnssec_validation || ""}
            onChange={(value) =>
              updateConfig({ dnssec_validation: value || undefined })
            }
            clearable
          />
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Stack gap="md">
          <Title order={4}>Forwarders</Title>
          <Text size="sm" c="dimmed">
            DNS servers to forward queries to
          </Text>

          <Group>
            <TextInput
              placeholder="8.8.8.8"
              value={newForwarder}
              onChange={(e) => setNewForwarder(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddForwarder();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleAddForwarder}
              disabled={!newForwarder}
            >
              Add
            </Button>
          </Group>

          <Stack gap="xs">
            {forwarders.map((ip) => (
              <Group key={ip} justify="space-between">
                <Badge size="lg" variant="light">
                  {ip}
                </Badge>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => handleRemoveForwarder(ip)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            {forwarders.length === 0 && (
              <Text size="sm" c="dimmed">
                No forwarders configured
              </Text>
            )}
          </Stack>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Stack gap="md">
          <Title order={4}>Access Control Lists (ACLs)</Title>
          <Text size="sm" c="dimmed">
            Define named groups of IP addresses/networks for use in access
            control
          </Text>

          <Group>
            <TextInput
              placeholder="internal-network"
              value={newAclName}
              onChange={(e) => setNewAclName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddAcl();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleAddAcl}
              disabled={!newAclName}
            >
              Add ACL
            </Button>
          </Group>

          <Stack gap="md">
            {Object.entries(acls).map(([aclName, entries]) => (
              <Card key={aclName} withBorder padding="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>{aclName}</Text>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleRemoveAcl(aclName)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>

                  <Group>
                    <TextInput
                      placeholder="192.168.1.0/24"
                      value={newAclEntry[aclName] || ""}
                      onChange={(e) =>
                        setNewAclEntry({
                          ...newAclEntry,
                          [aclName]: e.currentTarget.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddAclEntry(aclName);
                        }
                      }}
                      style={{ flex: 1 }}
                      size="xs"
                    />
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => handleAddAclEntry(aclName)}
                      disabled={!newAclEntry[aclName]}
                    >
                      Add Entry
                    </Button>
                  </Group>

                  <Stack gap="xs">
                    {entries.map((entry) => (
                      <Group key={entry} justify="space-between">
                        <Badge size="sm" variant="light">
                          {entry}
                        </Badge>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveAclEntry(aclName, entry)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                    {entries.length === 0 && (
                      <Text size="xs" c="dimmed">
                        No entries in this ACL
                      </Text>
                    )}
                  </Stack>
                </Stack>
              </Card>
            ))}
            {Object.keys(acls).length === 0 && (
              <Text size="sm" c="dimmed">
                No ACLs defined
              </Text>
            )}
          </Stack>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Stack gap="md">
          <Title order={4}>Access Control</Title>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Allow Query
            </Text>
            <Text size="xs" c="dimmed">
              Who can query this DNS server (e.g., 'localhost', 'any', ACL
              names, IP addresses)
            </Text>
            <Group>
              <TextInput
                placeholder="localhost or internal-network"
                value={newAllowQuery}
                onChange={(e) => setNewAllowQuery(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddAllowQuery();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAddAllowQuery}
                disabled={!newAllowQuery}
              >
                Add
              </Button>
            </Group>
            <Stack gap="xs">
              {allowQuery.map((entry) => (
                <Group key={entry} justify="space-between">
                  <Badge size="lg" variant="light">
                    {entry}
                  </Badge>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveAllowQuery(entry)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
              {allowQuery.length === 0 && (
                <Text size="sm" c="dimmed">
                  No allow-query entries configured
                </Text>
              )}
            </Stack>
          </Stack>

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Allow Transfer
            </Text>
            <Text size="xs" c="dimmed">
              Who can perform zone transfers (e.g., 'none', 'localhost', ACL
              names, IP addresses)
            </Text>
            <Group>
              <TextInput
                placeholder="localhost or none"
                value={newAllowTransfer}
                onChange={(e) => setNewAllowTransfer(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddAllowTransfer();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAddAllowTransfer}
                disabled={!newAllowTransfer}
              >
                Add
              </Button>
            </Group>
            <Stack gap="xs">
              {allowTransfer.map((entry) => (
                <Group key={entry} justify="space-between">
                  <Badge size="lg" variant="light">
                    {entry}
                  </Badge>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveAllowTransfer(entry)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))}
              {allowTransfer.length === 0 && (
                <Text size="sm" c="dimmed">
                  No allow-transfer entries configured
                </Text>
              )}
            </Stack>
          </Stack>

          <TextInput
            label="Listen On"
            description="IPv4 addresses to listen on (e.g., 'any' or '127.0.0.1')"
            value={editedConfig.listen_on || ""}
            onChange={(e) => updateConfig({ listen_on: e.currentTarget.value })}
          />

          <TextInput
            label="Listen On IPv6"
            description="IPv6 addresses to listen on (e.g., 'any' or 'none')"
            value={editedConfig.listen_on_v6 || ""}
            onChange={(e) =>
              updateConfig({ listen_on_v6: e.currentTarget.value })
            }
          />
        </Stack>
      </Card>
    </Stack>
  );
}
