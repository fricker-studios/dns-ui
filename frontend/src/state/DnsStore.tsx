import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useCallback,
  useRef,
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
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

type Action =
  | { type: "zones/set"; zones: Zone[] }
  | { type: "zone/create"; zone: Zone }
  | { type: "zone/setActive"; zoneId: string; zoneName: string }
  | {
      type: "recordsets/set";
      recordSets: RecordSet[];
      pagination: State["pagination"];
    }
  | { type: "record/upsert"; recordSet: RecordSet }
  | { type: "record/delete"; recordSetId: string }
  | { type: "change/add"; change: ChangeRequest }
  | { type: "change/applyAll"; zoneId: string }
  | { type: "change/revert"; changeId: string }
  | { type: "change/revertAll"; zoneId: string }
  | { type: "audit/add"; event: AuditEvent }
  | { type: "zone/update"; zone: Zone }
  | { type: "pagination/setPage"; page: number }
  | { type: "pagination/setPageSize"; pageSize: number };

const initialState: State = {
  zones: [],
  recordSets: [],
  changes: [],
  audit: [],
  pagination: {
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
  },
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
      return {
        ...state,
        recordSets: action.recordSets,
        pagination: action.pagination,
      };

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

    case "change/revert":
      return {
        ...state,
        changes: state.changes.filter((c) => c.id !== action.changeId),
      };

    case "change/revertAll":
      return {
        ...state,
        changes: state.changes.filter(
          (c) => !(c.zoneId === action.zoneId && c.status === "PENDING"),
        ),
      };

    case "audit/add":
      return { ...state, audit: [action.event, ...state.audit] };

    case "pagination/setPage":
      return {
        ...state,
        pagination: { ...state.pagination, page: action.page },
      };

    case "pagination/setPageSize":
      return {
        ...state,
        pagination: { ...state.pagination, pageSize: action.pageSize, page: 1 },
      };

    default:
      return state;
  }
}

type Store = {
  state: State;
  activeZone: Zone | null;
  zoneRecordSets: RecordSet[];
  loading: boolean;

  revertChange: (changeId: string) => void;
  revertAllChanges: (zoneId: string) => void;
  createZone: (zone: Zone) => Promise<void>;
  updateZone: (zone: Zone) => void;
  setActiveZone: (zoneId: string, zoneName: string) => void;
  refetchZones: () => void;
  refetchRecordSets: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;

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

  // Store activeZoneId in a ref to avoid dependency issues
  const activeZoneIdRef = useRef(state.activeZoneId);
  activeZoneIdRef.current = state.activeZoneId;

  // API hooks
  const {
    zones: apiZones,
    loading: zonesLoading,
    refetch: refetchZonesApi,
  } = useZones();
  const {
    recordsets: apiRecordSets,
    pagination: apiPagination,
    loading: recordsetsLoading,
    refetch: refetchRecordSetsApi,
  } = useRecordSetsApi(
    state.activeZoneName,
    1, // Always fetch first page
    10000, // High page size to get all records for client-side filtering/pagination
  );
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
  // Extract pagination properties to avoid reference change issues
  const paginationTotal = apiPagination?.total;
  const paginationPage = apiPagination?.page;
  const paginationPageSize = apiPagination?.pageSize;
  const paginationTotalPages = apiPagination?.totalPages;

  useEffect(() => {
    const activeZoneId = activeZoneIdRef.current;
    if (activeZoneId && apiRecordSets && apiRecordSets.length >= 0) {
      const recordsets = apiRecordSets.map((rs) =>
        apiRecordSetToRecordSet(rs, activeZoneId),
      );
      dispatch({
        type: "recordsets/set",
        recordSets: recordsets,
        pagination: {
          total: paginationTotal ?? recordsets.length,
          page: paginationPage ?? 1,
          pageSize: paginationPageSize ?? 50,
          totalPages: paginationTotalPages ?? Math.ceil(recordsets.length / 50),
        },
      });
    }
  }, [
    apiRecordSets,
    paginationTotal,
    paginationPage,
    paginationPageSize,
    paginationTotalPages,
  ]);

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

  // Stable callback references to prevent infinite loops
  const setPage = useCallback((page: number) => {
    dispatch({ type: "pagination/setPage", page });
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    dispatch({ type: "pagination/setPageSize", pageSize });
  }, []);

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

      setPage,
      setPageSize,

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

      revertChange: (changeId) => {
        const change = state.changes.find((c) => c.id === changeId);
        if (change && change.status === "PENDING") {
          dispatch({ type: "change/revert", changeId });
          log(change.zoneId, "Reverted change", `Discarded: ${change.summary}`);
          notifications.show({
            color: "blue",
            title: "Change reverted",
            message: change.summary,
          });
          // Refresh recordsets to restore original state
          refetchRecordSetsApi();
        }
      },

      revertAllChanges: (zoneId) => {
        const pendingCount = state.changes.filter(
          (c) => c.zoneId === zoneId && c.status === "PENDING",
        ).length;
        if (pendingCount > 0) {
          dispatch({ type: "change/revertAll", zoneId });
          log(
            zoneId,
            "Reverted all changes",
            `Discarded ${pendingCount} changes`,
          );
          notifications.show({
            color: "blue",
            title: "All changes reverted",
            message: `${pendingCount} pending changes discarded`,
          });
          // Refresh recordsets to restore original state
          refetchRecordSetsApi();
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state,
    activeZone,
    zoneRecordSets,
    zonesLoading,
    recordsetsLoading,
    setPage,
    setPageSize,
  ]);

  return (
    <DnsStoreContext.Provider value={api}>{children}</DnsStoreContext.Provider>
  );
}

export function useDnsStore() {
  const ctx = useContext(DnsStoreContext);
  if (!ctx) throw new Error("useDnsStore must be used within DnsStoreProvider");
  return ctx;
}
