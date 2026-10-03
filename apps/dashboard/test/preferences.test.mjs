import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source=(await readFile(new URL("../app.js",import.meta.url),"utf8")).replace(/^import .*\n/,"");
function dashboard(savedLanguage) {
  const nodes=new Map(),storage=new Map(savedLanguage ? [["minecodex-language",savedLanguage]] : []);
  const node=()=>({textContent:"",dataset:{},attributes:{},handlers:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.handlers[k]=v;},querySelector(){return this;}});
  const languages=["zh-CN","en"].map(choice=>Object.assign(node(),{dataset:{languageChoice:choice}}));
  const themes=["light","dark"].map(choice=>Object.assign(node(),{dataset:{themeChoice:choice}}));
  let reloads=0;
  const context=vm.createContext({document:{documentElement:{dataset:{}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll:selector=>selector.includes("language") ? languages : themes,addEventListener(){}},navigator:{language:"en-US"},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},location:{reload(){reloads++;}},matchMedia:()=>({matches:false,addEventListener(){}}),fetch:()=>new Promise(()=>{}),setInterval(){},setTimeout(){},clearTimeout(){}});
  vm.runInContext(source,context);
  return {context,nodes,storage,languages,reloads:()=>reloads};
}
test("dashboard restores language and keeps successful feature labels consistent",()=>{
  const app=dashboard("zh-CN");
  assert.equal(app.context.document.documentElement.lang,"zh-CN");
  assert.equal(app.languages[0].attributes["aria-pressed"],"true");
  assert.equal(vm.runInContext('featureState({state:"healthy"}).label === featureState({state:"injected"}).label',app.context),true);
  assert.equal(app.nodes.get("#diagnostics-button").textContent,"复制诊断信息");
});
test("language change persists without changing appearance or saving feature settings",()=>{
  const app=dashboard();
  app.storage.set("minecodex-appearance","dark");
  app.nodes.get(".language-toggle").handlers.click({target:{closest:()=>app.languages[0]}});
  assert.equal(app.storage.get("minecodex-language"),"zh-CN");
  assert.equal(app.storage.get("minecodex-appearance"),"dark");
  assert.equal(app.reloads(),1);
  vm.runInContext('pendingFeatureIds.add("notes")',app.context);
  app.nodes.get(".language-toggle").handlers.click({target:{closest:()=>app.languages[0]}});
  assert.equal(app.reloads(),1);
});
