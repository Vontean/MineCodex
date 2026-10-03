// 只复制自检证据；不包含账号、路径、会话内容、绑定令牌或原始错误文本。
export function diagnosticReport(state) {
  return {
    minecodexVersion:state?.version ?? null,
    codexBuild:state?.renderer?.codexBuild ?? state?.runtime?.codex?.version ?? null,
    buildSource:state?.renderer?.buildSource ?? null,
    verification:"runtime-observation-only",
    targets:(state?.renderer?.targets ?? []).map(target => ({
      targetId:target.targetId,checkedAt:target.checkedAt,reason:target.reason ?? null,
      tokens:target.tokens,capabilities:target.capabilities,
      plugins:(target.plugins ?? []).map(plugin => ({
        featureId:plugin.featureId,installation:plugin.installation,state:plugin.state,reason:plugin.reason,
        checks:plugin.checks,tokens:plugin.tokens,
      })),
    })),
    services:(state?.features ?? []).map(feature => ({featureId:feature.id,state:feature.state,failureCode:feature.failure?.code ?? null})),
  };
}
