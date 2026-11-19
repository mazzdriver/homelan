import * as linux from '../linux.js';
import {inspectSystem,buildInstallPlan} from '../system.js';

export function adapterFor(report=inspectSystem()) {
  if(report.adapter==='linux-systemd') return {id:'linux-systemd',supported:report.supported,inspect:()=>report,plan:()=>buildInstallPlan(report),status:()=>linux.status(),diagnose:()=>linux.diagnose()};
  if(report.adapter==='windows-pending') return {id:'windows-pending',supported:false,inspect:()=>report,plan:()=>buildInstallPlan(report)};
  return {id:'unsupported',supported:false,inspect:()=>report,plan:()=>buildInstallPlan(report)};
}
