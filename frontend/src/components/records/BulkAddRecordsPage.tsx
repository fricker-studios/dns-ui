import { useState, useMemo } from "react";
import {
  Button,
  Card,
  Flex,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  ActionIcon,
  Divider,
  Badge,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconArrowLeft,
} from "@tabler/icons-react";
import type { RecordType, RecordValue } from "../../types/dns";
import {
  fqdnJoin,
  normalizeFqdn,
  uid,
  validateRecordInput,
} from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";

const recordTypeOptions: { value: RecordType; label: string }[] = [
  { value: "A", label: "A — IPv4" },
  { value: "AAAA", label: "AAAA — IPv6" },
  { value: "CNAME", label: "CNAME — Alias" },
  { value: "MX", label: "MX — Mail exchanger" },
  { value: "TXT", label: "TXT — Text" },
  { value: "SRV", label: "SRV — Service" },
  { value: "NS", label: "NS — Name server" },
  { value: "PTR", label: "PTR — Reverse pointer" },
  { value: "CAA", label: "CAA — CA authorization" },
];

interface RecordSetDraft {
  id: string;
  type: RecordType;
  label: string;
  ttl: number | "";
  comment: string;
  values: RecordValue[];
}

export function BulkAddRecordsPage({ onClose }: { onClose: () => void }) {
  const { activeZone, upsertRecordSet } = useDnsStore();

  const [recordSets, setRecordSets] = useState<RecordSetDraft[]>([
    {
      id: uid(),
      type: "A",
      label: "@",
      ttl: "",
      comment: "",
      values: [{ id: uid(), value: "" }],
    },
  ]);

  const addRecordSet = () => {
    setRecordSets((prev) => [
      ...prev,
      {
        id: uid(),
        type: "A",
        label: "@",
        ttl: "",
        comment: "",
        values: [{ id: uid(), value: "" }],
      },
    ]);
  };

  const removeRecordSet = (id: string) => {
    setRecordSets((prev) => prev.filter((rs) => rs.id !== id));
  };

  const updateRecordSet = (id: string, updates: Partial<RecordSetDraft>) => {
    setRecordSets((prev) =>
      prev.map((rs) => (rs.id === id ? { ...rs, ...updates } : rs)),
    );
  };

  const addValue = (recordSetId: string) => {
    setRecordSets((prev) =>
      prev.map((rs) =>
        rs.id === recordSetId
          ? { ...rs, values: [...rs.values, { id: uid(), value: "" }] }
          : rs,
      ),
    );
  };

  const removeValue = (recordSetId: string, valueId: string) => {
    setRecordSets((prev) =>
      prev.map((rs) =>
        rs.id === recordSetId
          ? { ...rs, values: rs.values.filter((v) => v.id !== valueId) }
          : rs,
      ),
    );
  };

  const updateValue = (
    recordSetId: string,
    valueId: string,
    updates: Partial<RecordValue>,
  ) => {
    setRecordSets((prev) =>
      prev.map((rs) =>
        rs.id === recordSetId
          ? {
              ...rs,
              values: rs.values.map((v) =>
                v.id === valueId ? { ...v, ...updates } : v,
              ),
            }
          : rs,
      ),
    );
  };

  const validationErrors = useMemo(() => {
    if (!activeZone) return [];
    const errors: { recordSetId: string; message: string }[] = [];

    recordSets.forEach((rs) => {
      const fqdn = fqdnJoin(rs.label || "@", activeZone.name);
      const normalizedValues = rs.values.map((v) => {
        let val = String(v.value ?? "").trim();
        if (["CNAME", "NS", "PTR", "MX", "SRV"].includes(rs.type))
          val = normalizeFqdn(val);
        return { ...v, value: val };
      });

      const errs = validateRecordInput({
        type: rs.type,
        name: fqdn,
        values: normalizedValues,
      });

      if (errs.length) {
        errors.push({
          recordSetId: rs.id,
          message: `${rs.type} ${rs.label}: ${errs[0]}`,
        });
      }
    });

    return errors;
  }, [recordSets, activeZone]);

  const save = async () => {
    if (!activeZone) return;

    if (validationErrors.length > 0) {
      notifications.show({
        color: "red",
        title: "Validation Errors",
        message: validationErrors[0].message,
      });
      return;
    }

    // Convert to RecordSet format and stage each one
    const recordsToAdd = recordSets.map((rs) => {
      const fqdn = fqdnJoin(rs.label || "@", activeZone.name);
      const normalizedValues = rs.values.map((v) => {
        let val = String(v.value ?? "").trim();
        if (["CNAME", "NS", "PTR", "MX", "SRV"].includes(rs.type))
          val = normalizeFqdn(val);
        return { ...v, value: val, id: v.id || uid() };
      });

      return {
        id: uid(),
        zoneId: activeZone.id,
        name: fqdn,
        type: rs.type,
        ttl: rs.ttl === "" ? undefined : Number(rs.ttl),
        values: normalizedValues,
        comment: rs.comment.trim() || undefined,
        routing: { policy: "simple" as const },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    // Stage each recordset as a pending change
    recordsToAdd.forEach((rs) => {
      upsertRecordSet(rs, `Add ${rs.type} ${rs.name}`, [
        `Added recordset`,
        ...rs.values.map((v) => `• ${v.value}`),
      ]);
    });

    notifications.show({
      color: "green",
      title: "Records Staged",
      message: `${recordSets.length} recordset${recordSets.length > 1 ? "s" : ""} staged. Click "Apply Changes" to commit.`,
    });
    onClose();
  };

  // Render early return check AFTER all hooks have been called
  if (!activeZone) {
    return (
      <Card withBorder radius="md" p="lg">
        <Text c="dimmed">No zone selected</Text>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <Stack gap={2}>
            <Group>
              <ActionIcon variant="subtle" onClick={onClose}>
                <IconArrowLeft size={20} />
              </ActionIcon>
              <Text fw={800} size="xl">
                Bulk Add Records
              </Text>
            </Group>
            <Text size="sm" c="dimmed" component="span">
              Zone: <Badge variant="light">{activeZone.name}</Badge>
            </Text>
          </Stack>

          <Group>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={save}
              disabled={recordSets.length === 0 || validationErrors.length > 0}
            >
              Stage {recordSets.length} Record{recordSets.length > 1 ? "s" : ""}
            </Button>
          </Group>
        </Group>

        {validationErrors.length > 0 && (
          <Alert color="red" title="Validation Errors">
            <Stack gap="xs">
              {validationErrors.map((err) => (
                <Text key={err.recordSetId} size="sm">
                  • {err.message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Stack gap="md">
          {recordSets.map((rs, idx) => (
            <Paper key={rs.id} withBorder p="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600} size="sm" c="dimmed">
                    Record #{idx + 1}
                  </Text>
                  {recordSets.length > 1 && (
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => removeRecordSet(rs.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>

                <Grid>
                  <Grid.Col span={{ base: 12 }} m={0} p={0}>
                    <Flex justify="flex-start" align="flex-end" direction="row">
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <TextInput
                          label="Name (label)"
                          value={rs.label}
                          onChange={(e) =>
                            updateRecordSet(rs.id, {
                              label: e.currentTarget.value,
                            })
                          }
                          description={`FQDN: ${fqdnJoin(rs.label || "@", activeZone.name)}`}
                          placeholder="@, www, api, _sip._tcp"
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 6 }}>
                        <Select
                          label="Type"
                          data={recordTypeOptions}
                          value={rs.type}
                          onChange={(v) => {
                            const newType = (v as RecordType) ?? "A";
                            updateRecordSet(rs.id, {
                              type: newType,
                              // Limit to single value for CNAME
                              values:
                                newType === "CNAME" && rs.values.length > 1
                                  ? [rs.values[0]]
                                  : rs.values,
                            });
                          }}
                        />
                      </Grid.Col>
                    </Flex>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      label="TTL (seconds)"
                      value={rs.ttl}
                      onChange={(v) =>
                        updateRecordSet(rs.id, { ttl: v as number | "" })
                      }
                      placeholder={`${activeZone?.defaultTtl ?? 300}`}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 8 }}>
                    <Textarea
                      label="Comment"
                      value={rs.comment}
                      onChange={(e) =>
                        updateRecordSet(rs.id, {
                          comment: e.currentTarget.value,
                        })
                      }
                    />
                  </Grid.Col>
                </Grid>

                <Divider label="Values" labelPosition="left" />

                <Stack gap="xs">
                  {rs.values.map((v, vIdx) => (
                    <Group key={v.id} align="end" justify="start">
                      <TextInput
                        flex={1}
                        miw={100}
                        label={`Value #${vIdx + 1}`}
                        value={v.value}
                        onChange={(e) =>
                          updateValue(rs.id, v.id, {
                            value: e.currentTarget.value,
                          })
                        }
                        placeholder={
                          rs.type === "A"
                            ? "203.0.113.10"
                            : rs.type === "AAAA"
                              ? "2001:db8::10"
                              : rs.type === "TXT"
                                ? "v=spf1 include:_spf.google.com ~all"
                                : rs.type === "CAA"
                                  ? '0 issue "letsencrypt.org"'
                                  : "target.example.com."
                        }
                      />

                      {rs.type === "MX" && (
                        <NumberInput
                          label="Priority"
                          value={v.priority ?? 10}
                          onChange={(val) =>
                            updateValue(rs.id, v.id, {
                              priority: Number(val ?? 10),
                            })
                          }
                        />
                      )}

                      {rs.type === "SRV" && (
                        <>
                          <NumberInput
                            label="Priority"
                            w={100}
                            value={v.priority ?? 10}
                            onChange={(val) =>
                              updateValue(rs.id, v.id, {
                                priority: Number(val ?? 10),
                              })
                            }
                          />
                          <NumberInput
                            label="Weight"
                            w={100}
                            value={v.weight ?? 5}
                            onChange={(val) =>
                              updateValue(rs.id, v.id, {
                                weight: Number(val ?? 5),
                              })
                            }
                          />
                          <NumberInput
                            label="Port"
                            w={100}
                            value={v.port ?? 443}
                            onChange={(val) =>
                              updateValue(rs.id, v.id, {
                                port: Number(val ?? 443),
                              })
                            }
                            min={0}
                            max={65535}
                          />
                        </>
                      )}

                      {rs.type !== "CNAME" && rs.values.length > 1 && (
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeValue(rs.id, v.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  ))}

                  {rs.type !== "CNAME" && (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => addValue(rs.id)}
                    >
                      Add value
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}

          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={addRecordSet}
          >
            Add another record
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
