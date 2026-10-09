import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
const WorkflowContext = createContext({ busy: false, dirty: false, report: () => {}, clear: () => {} });
export function WorkflowProvider({ children }) {
  const [workflows, setWorkflows] = useState({});
  const report = useCallback((id, status) => {
    setWorkflows(current => ({ ...current, [id]: status }));
  }, []);
  const clear = useCallback(id => {
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
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value.busy]);
  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}
export const useWorkflow = () => useContext(WorkflowContext);
export function useWorkflowStatus(id, busy, dirty) {
  const { report, clear } = useWorkflow();
  useEffect(() => { report(id, { busy, dirty }); }, [id, busy, dirty, report]);
  useEffect(() => () => clear(id), [id, clear]);
}
