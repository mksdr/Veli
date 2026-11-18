import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface WorkflowStatus {
  busy: boolean;
  dirty: boolean;
}

export interface WorkflowContextValue {
  busy: boolean;
  dirty: boolean;
  report: (id: string, status: WorkflowStatus) => void;
  clear: (id: string) => void;
}

const WorkflowContext = createContext<WorkflowContextValue>({ busy: false, dirty: false, report: () => {}, clear: () => {} });
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<Record<string, WorkflowStatus>>({});
  const report = useCallback((id: string, status: WorkflowStatus) => {
    setWorkflows(current => ({ ...current, [id]: status }));
  }, []);
  const clear = useCallback((id: string) => {
    setWorkflows(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  const value = useMemo(() => ({
    busy: Object.values(workflows).some(status => status.busy),
    dirty: Object.values(workflows).some(status => status.dirty), report, clear,
  }), [workflows, report, clear]);
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
  useEffect(() => { report(id, { busy, dirty }); }, [id, busy, dirty, report]);
  useEffect(() => () => clear(id), [id, clear]);
}
