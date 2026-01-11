import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { AuditEvent, ChangeRequest, RecordSet, Zone } from "../types/dns";
import { nowIso, uid } from "../lib/bind";
import {
  useZones,
  useRecordSets as useRecordSetsApi,
  useReplaceRecordSets,
} from "../hooks";
import {
  apiZoneToZone,
  apiRecordSetToRecordSet,
  recordSetToApiRecordSet,
} from "../lib/converters";
import { notifications } from "@mantine/notifications";

type State = {
  zones: Zone[];
  recordSets: RecordSet[];
  changes: ChangeRequest[];
  audit: AuditEvent[];
  activeZoneId: string | null;
  activeZoneName: string | null;
};

type Action =
  | { type: "zones/set"; zones: Zone[] }
  | { type: "zone/create"; zone: Zone }
  | { type: "zone/setActive"; zoneId: string; zoneName: string }
  | { type: "recordsets/set"; recordSets: RecordSet[] }
  | { type: "record/upsert"; recordSet: RecordSet }
  | { type: "record/delete"; recordSetId: string }
  | { type: "change/add"; change: ChangeRequest }
  | { type: "change/applyAll"; zoneId: string }
  | { type: "audit/add"; event: AuditEvent }
  | { type: "zone/update"; zone: Zone };

const initialState: State = {
  zones: [],
  recordSets: [],
  changes: [],
  audit: [],
  activeZoneId: null,
  activeZoneName: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "zones/set":
      return { ...state, zones: action.zones };

    case "zone/create":
      return {
        ...state,
        zones: [action.zone, ...state.zones],
        activeZoneId: action.zone.id,
        activeZoneName: action.zone.name,
      };

    case "zone/update":
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id === action.zone.id ? action.zone : z,
        ),
      };

    case "zone/setActive":
      return {
        ...state,
        activeZoneId: action.zoneId,
        activeZoneName: action.zoneName,
      };

    case "recordsets/set":
      return { ...state, recordSets: action.recordSets };

    case "record/upsert": {
      const exists = state.recordSets.some((r) => r.id === action.recordSet.id);
      const next = exists
        ? state.recordSets.map((r) =>
            r.id === action.recordSet.id ? action.recordSet : r,
          )
        : [action.recordSet, ...state.recordSets];
      return { ...state, recordSets: next };
    }

    case "record/delete":
      return {
        ...state,
        recordSets: state.recordSets.filter((r) => r.id !== action.recordSetId),
      };

    case "change/add":
      return { ...state, changes: [action.change, ...state.changes] };

    case "change/applyAll":
      return {
        ...state,
        changes: state.changes.map((c) =>
          c.zoneId === action.zoneId && c.status === "PENDING"
            ? { ...c, status: "APPLIED", appliedAt: nowIso() }
            : c,
        ),
      };

    case "audit/add":
      return { ...state, audit: [action.event, ...state.audit] };

    default:
      return state;
  }
}

type Store = {
  state: State;
  activeZone: Zone | null;
  zoneRecordSets: RecordSet[];
  loading: boolean;

  createZone: (zone: Zone) => Promise<void>;
  updateZone: (zone: Zone) => void;
  setActiveZone: (zoneId: string, zoneName: string) => void;
  refetchZones: () => void;
  refetchRecordSets: () => void;

  upsertRecordSet: (rs: RecordSet, summary: string, details: string[]) => void;
  deleteRecordSet: (
    recordSetId: string,
    summary: string,
    details: string[],
  ) => void;

  applyPendingChanges: () => Promise<void>;
};

const DnsStoreContext = createContext<Store | null>(null);

export function DnsStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // API hooks
  const {
    zones: apiZones,
    loading: zonesLoading,
    refetch: refetchZonesApi,
  } = useZones();
  const {
    recordsets: apiRecordSets,
    loading: recordsetsLoading,
    refetch: refetchRecordSetsApi,
  } = useRecordSetsApi(state.activeZoneName);
  const { replaceRecordSets } = useReplaceRecordSets();

  // Sync API zones to state
  useEffect(() => {
    if (apiZones && apiZones.length > 0) {
      const zones = apiZones.map(apiZoneToZone);
      dispatch({ type: "zones/set", zones });

      // Set first zone as active if none selected
      if (!state.activeZoneId && zones.length > 0) {
        dispatch({
          type: "zone/setActive",
          zoneId: zones[0].id,
          zoneName: zones[0].name,
        });
      }
    }
  }, [apiZones]);

  // Sync API recordsets to state
  useEffect(() => {
    if (state.activeZoneId && apiRecordSets && apiRecordSets.length >= 0) {
      const recordsets = apiRecordSets.map((rs) =>
        apiRecordSetToRecordSet(rs, state.activeZoneId!),
      );
      dispatch({ type: "recordsets/set", recordSets: recordsets });
    }
  }, [apiRecordSets, state.activeZoneId]);

  const activeZone = useMemo(() => {
    const z = state.zones.find((x) => x.id === state.activeZoneId);
    return z ?? null;
  }, [state.zones, state.activeZoneId]);

  const zoneRecordSets = useMemo(
    () =>
      activeZone
        ? state.recordSets.filter((r) => r.zoneId === activeZone.id)
        : [],
    [state.recordSets, activeZone],
  );

  const api: Store = useMemo(() => {
    const log = (zoneId: string, action: string, detail: string) => {
      dispatch({
        type: "audit/add",
        event: {
          id: uid(),
          zoneId,
          at: nowIso(),
          actor: "user",
          action,
          detail,
        },
      });
    };

    const addChange = (zoneId: string, summary: string, details: string[]) => {
      dispatch({
        type: "change/add",
        change: {
          id: uid(),
          zoneId,
          status: "PENDING",
          summary,
          submittedAt: nowIso(),
          details,
        },
      });
    };

    return {
      state,
      activeZone,
      zoneRecordSets,
      loading: zonesLoading || recordsetsLoading,

      createZone: async (zone) => {
        dispatch({ type: "zone/create", zone });
        log(zone.id, "Created zone", `${zone.type} zone ${zone.name}`);
        // Refresh zones from API
        refetchZonesApi();
      },

      updateZone: (zone) => dispatch({ type: "zone/update", zone }),

      setActiveZone: (zoneId, zoneName) =>
        dispatch({ type: "zone/setActive", zoneId, zoneName }),

      refetchZones: refetchZonesApi,
      refetchRecordSets: refetchRecordSetsApi,

      upsertRecordSet: (rs, summary, details) => {
        dispatch({ type: "record/upsert", recordSet: rs });
        addChange(rs.zoneId, summary, details);
        log(rs.zoneId, "Upserted record", `${rs.type} ${rs.name}`);
      },

      deleteRecordSet: (recordSetId, summary, details) => {
        const rs = state.recordSets.find((r) => r.id === recordSetId);
        dispatch({ type: "record/delete", recordSetId });
        if (rs) {
          addChange(rs.zoneId, summary, details);
          log(rs.zoneId, "Deleted record", `${rs.type} ${rs.name}`);
        }
      },

      applyPendingChanges: async () => {
        if (!activeZone || !state.activeZoneName) {
          notifications.show({
            color: "red",
            title: "Error",
            message: "No active zone",
          });
          return;
        }

        try {
          // Convert frontend recordsets to API format and send to backend
          const apiRecordSets = state.recordSets
            .filter((rs) => rs.zoneId === activeZone.id)
            .map(recordSetToApiRecordSet);

          const success = await replaceRecordSets(
            state.activeZoneName,
            apiRecordSets,
          );

          if (success) {
            dispatch({ type: "change/applyAll", zoneId: activeZone.id });
            log(
              activeZone.id,
              "Applied changes",
              "Wrote zone file and ran rndc reload",
            );
            notifications.show({
              color: "green",
              title: "Changes applied",
              message: "Zone file updated and BIND reloaded",
            });
            // Refresh recordsets from API
            refetchRecordSetsApi();
          }
        } catch (err) {
          notifications.show({
            color: "red",
            title: "Error applying changes",
            message: String(err),
          });
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, activeZone, zoneRecordSets, zonesLoading, recordsetsLoading]);

  return (
    <DnsStoreContext.Provider value={api}>{children}</DnsStoreContext.Provider>
  );
}

export function useDnsStore() {
  const ctx = useContext(DnsStoreContext);
  if (!ctx) throw new Error("useDnsStore must be used within DnsStoreProvider");
  return ctx;
}
