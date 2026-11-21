import {request,success,failure,validateRequest,ERROR,CLIENT_VERSION,PROTOCOL_VERSION,SUPPORTED_PROTOCOL_VERSIONS,OPERATION_CAPABILITIES} from './protocol.js';
import * as linux from './linux.js';
import {readConfig,writeConfig} from './config.js';
import {inspectSystem,buildInstallPlan} from './system.js';
import {adapterFor} from './adapters/index.js';
export {request};
export async function dispatch(req,{systemReport=inspectSystem()}={}){
 const invalid=validateRequest(req);if(invalid)return failure(req,invalid.includes('version')?ERROR.UNSUPPORTED_VERSION:ERROR.INVALID_REQUEST,invalid);
 if(!['ping','inspect','plan'].includes(req.operation)&&!systemReport.ready)return failure(req,ERROR.NOT_SUPPORTED,`Target is not ready for HomeLAN operations`,{adapter:systemReport.adapter,plan:buildInstallPlan(systemReport)});
 const required=OPERATION_CAPABILITIES[req.operation]||[];const missing=required.filter(name=>systemReport.capabilities?.[name]!==true);if(missing.length)return failure(req,ERROR.NOT_SUPPORTED,`Required capability is unavailable: ${missing.join(', ')}`,{missing,adapter:systemReport.adapter});
 try{
 let result;
 switch(req.operation){
 case 'ping': result={clientVersion:CLIENT_VERSION,protocolVersion:PROTOCOL_VERSION,supportedProtocolVersions:[...SUPPORTED_PROTOCOL_VERSIONS],adapter:systemReport.adapter??null,ready:Boolean(systemReport.ready),capabilities:systemReport.capabilities??{}};break;
 case 'inspect': result=systemReport;break;
 case 'plan': result=buildInstallPlan(systemReport);break;
 case 'status': result=adapterFor(systemReport).status();break;
 case 'diagnose': result={system:systemReport,diagnostics:adapterFor(systemReport).diagnose()};break;
 case 'locknow':result=linux.locknow(req.params.user??null);break;
 case 'newpass':result=linux.setPassword(req.params.user,req.params.password,req.params.minLength===undefined?{}:{minLength:req.params.minLength});break;
 case 'lock':result=linux.lock(req.params.user,req.params.password);break;
 case 'autologin':if(typeof req.params.enabled!=='boolean')throw new Error('enabled must be a boolean');result=linux.setAutologin(req.params.enabled,req.params.user);break;
 case 'locker.set':result=linux.setLocker(req.params.user,req.params.minutes);break;
 case 'arm.set':result=linux.setArm(req.params.user,req.params.minutes);break;
 case 'poweroff':if(req.params.confirmed!==true)return failure(req,ERROR.PRECONDITION_FAILED,'Poweroff requires explicit confirmation');result=linux.poweroff();break;
 case 'install': result=linux.installUnits();break;
 case 'update':result={accepted:true,note:'Package update is performed by the admin bootstrapper'};break;
 default:return failure(req,ERROR.UNKNOWN_OPERATION,'Unknown operation');
 }
 return success(req,result);
 }catch(e){return failure(req,ERROR.OPERATION_FAILED,e.message);}
}
export async function handleLine(line){let req;try{req=JSON.parse(line);}catch{return JSON.stringify(failure(null,ERROR.INVALID_REQUEST,'Input is not valid JSON'));}return JSON.stringify(await dispatch(req));}
export function enroll({deviceId,managedUsers=[],adminFingerprint=null}){
 if(!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(deviceId))throw new Error('deviceId must be 3-64 lowercase letters, digits, dot, underscore or dash');
 if(!Array.isArray(managedUsers)||managedUsers.some(u=>typeof u!=='string'||!/^[a-z_][a-z0-9_-]{0,31}$/.test(u)))throw new Error('Invalid managed user list');
 for(const user of managedUsers)linux.assertLocalUser(user);
 const c=readConfig();writeConfig({...c,deviceId,managedUsers:[...new Set(managedUsers)],adminFingerprint,enrolledAt:new Date().toISOString()});return readConfig();
}
