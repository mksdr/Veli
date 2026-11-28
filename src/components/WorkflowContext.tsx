import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface WorkflowStatus {
  busy: boolean;
  dirty: boolean;
}

export interface WorkflowContextValue {
  busy: boolean;
  dirty: boolean;
  report: (id: string, status: WorkflowStatus) => void;
  clear: (id: string) => void;
  isIdle: () => boolean;
}

const WorkflowContext = createContext<WorkflowContextValue>({ busy: false, dirty: false, report: () => {}, clear: () => {}, isIdle: () => true });
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<Record<string, WorkflowStatus>>({});
  const current = useRef(workflows);
  const report = useCallback((id: string, status: WorkflowStatus) => {
    const next = { ...current.current, [id]: status };
    current.current = next;
    setWorkflows(next);
  }, []);
  const clear = useCallback((id: string) => {
    const next = { ...current.current };
    delete next[id];
    current.current = next;
    setWorkflows(next);
  }, []);
  const isIdle = useCallback(() => Object.values(current.current).every(status => !status.busy && !status.dirty), []);
  const value = useMemo(() => ({
    busy: Object.values(workflows).some(status => status.busy),
    dirty: Object.values(workflows).some(status => status.dirty), report, clear, isIdle,
  }), [workflows, report, clear, isIdle]);
  useEffect(() => {
    if (!value.busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value.busy]);
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}
export const useWorkflow = (): WorkflowContextValue => useContext(WorkflowContext);
export function useWorkflowStatus(id: string, busy: boolean, dirty: boolean): void {
  const { report, clear } = useWorkflow();
  useLayoutEffect(() => { report(id, { busy, dirty }); }, [id, busy, dirty, report]);
  useLayoutEffect(() => () => clear(id), [id, clear]);
}
