// 只管理安装证据；必要原生能力与适用场景由功能所属 Adapter 判定。
export function tokenRequirements(source, bindings) {
  const nativeNames=new Map(Object.entries(bindings).map(([native,project])=>[project,native]));
  const requirements=new Map();
  for (const match of source.matchAll(/var\((--mcx-[a-z0-9-]+)\s*([,)])/g)) {
    const name=nativeNames.get(match[1]) ?? match[1];
    requirements.set(name,{name,required:match[2] === ")" || requirements.get(name)?.required === true,
      ...(nativeNames.has(match[1]) ? {} : {unmapped:true})});
  }
  return [...requirements.values()];
}

export function createRendererSelfCheck(features, sessionId, theme) {
  const records = new Map(features.map(feature => [feature.id, { featureId:feature.id, tokens:feature.requiredTokens ?? [], installation:"pending", probe:null }]));
  function register(featureId, probe) {
    if (typeof probe !== "function") throw new TypeError("Self-check must be a function");
    records.get(featureId).probe = probe;
  }
  function installed(featureId) { records.get(featureId).installation = "installed"; }
  function failed(featureId) { records.get(featureId).installation = "failed"; }
  function snapshot() {
    return {
      sessionId,
      checkedAt:Date.now(),
      tokens:theme.diagnostics(),
      plugins:[...records.values()].map(record => {
        const base = { featureId:record.featureId, installation:record.installation };
        if (record.installation === "failed") return {...base,state:"failed",reason:"installation-failed",checks:[]};
        if (record.installation !== "installed" || !record.probe) return {...base,state:"unknown",reason:"self-check-pending",checks:[]};
        try {
          const result = record.probe();
          const states = ["available","not-applicable","unavailable","unknown"];
          if (!states.includes(result?.state)) throw new TypeError("Invalid self-check result");
          const scopes = result.scopes ?? [];
          const requirements=record.tokens.map(token=>typeof token === "string" ? {name:token,required:true} : token);
          const tokens = scopes.filter(scope => scope.element?.isConnected).flatMap(scope =>
            theme.checkTokens(scope.element,requirements.map(token=>token.name)).map(token => {
              const requirement=requirements.find(item=>item.name === token.name);
              return {...token,scope:scope.name,required:requirement.required,
                ...(requirement.unmapped ? {available:false,reason:"token-mapping-unavailable"} : {})};
            }));
          const missingTokens = tokens.some(token => token.required && (!token.available || (token.projectName && (!token.projectValue || token.scopeMatches === false))));
          // 不导出异常文本、原生对象、凭据或用户内容。
          return {...base,state:result.state === "available" && missingTokens ? "degraded" : result.state,
            reason:result.state === "available" && missingTokens ? "design-token-unavailable" : result.reason ?? null,tokens,
            checks:(result.checks ?? []).map(check => ({
            name:check.name,available:check.available === true,reason:check.reason ?? null,
          }))};
        } catch {
          return {...base,state:"unavailable",reason:"self-check-failed",checks:[]};
        }
      }),
    };
  }
  return {register,installed,failed,snapshot};
}
