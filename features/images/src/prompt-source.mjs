import { parse } from "acorn";

// 仅解释可确定的字符串表达式，不执行会话中的 JavaScript 或历史工具。
export function tracePromptSource(source, stored, recordedOutput) {
  let program;
  try { program = parse(source, { ecmaVersion: "latest", sourceType: "module" }); }
  catch { stored.clear(); return null; }
  const locals = new Map();
  const isCall = (node, name) => node?.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === name;
  const isTool = (node, name) => node?.type === "CallExpression" && node.callee.type === "MemberExpression"
    && !node.callee.computed && node.callee.object.name === "tools" && node.callee.property.name === name;
  const statements = program.body;
  const commandVariables = statements.flatMap(statement => statement.type === "VariableDeclaration"
    ? statement.declarations.filter(d => d.id.type === "Identifier" && isTool(d.init?.argument, "exec_command")).map(d => d.id.name)
    : []);
  const echoedOutput = commandVariables.length === 1 && statements.some(statement => {
    const call = statement.expression;
    const arg = call?.arguments?.[0];
    return isCall(call, "text") && call.arguments.length === 1 && arg?.type === "MemberExpression"
      && !arg.computed && arg.object.name === commandVariables[0] && arg.property.name === "output";
  });
  let prompt = null;
  let imageCalls = 0;
  function value(node) {
    if (!node) return undefined;
    if (node.type === "Literal") return typeof node.value === "string" || typeof node.value === "number" ? node.value : undefined;
    if (node.type === "Identifier") return locals.get(node.name);
    if (node.type === "AssignmentExpression" && node.left.type === "Identifier") {
      const result = node.operator === "=" ? value(node.right) : undefined;
      locals.set(node.left.name, result);
      return result;
    }
    if (node.type === "TemplateLiteral") {
      const parts = node.expressions.map(value);
      if (parts.some(part => typeof part !== "string" && typeof part !== "number")) return undefined;
      return node.quasis.map((part, i) => part.value.cooked + (parts[i] ?? "")).join("");
    }
    if (node.type === "BinaryExpression" && node.operator === "+") {
      const left = value(node.left), right = value(node.right);
      if (![left, right].every(part => typeof part === "string" || typeof part === "number")) return undefined;
      return left + right;
    }
    if (node.type === "AwaitExpression") return value(node.argument);
    if (node.type === "MemberExpression" && !node.computed && node.property.name === "output") return value(node.object)?.output;
    if (isCall(node, "load") && node.arguments.length === 1) return stored.get(value(node.arguments[0]));
    if (isCall(node, "generatedImage") || isCall(node, "text")) {
      node.arguments.forEach(value);
      return undefined;
    }
    if (isCall(node, "store") && node.arguments.length === 2) {
      const key = value(node.arguments[0]), result = value(node.arguments[1]);
      if (typeof key === "string") {
        if (typeof result === "string") stored.set(key, result);
        else stored.delete(key);
      }
      return undefined;
    }
    if (isTool(node, "exec_command")) return echoedOutput && typeof recordedOutput === "string" ? { output: recordedOutput } : undefined;
    if (isTool(node, "image_gen__imagegen")) {
      imageCalls += 1;
      const options = node.arguments[0];
      if (options?.type === "ObjectExpression") {
        const field = options.properties.find(p => p.type === "Property" && !p.computed && (p.key.name ?? p.key.value) === "prompt");
        const resolved = value(field?.value);
        if (typeof resolved === "string") prompt = resolved;
      }
      return undefined;
    }
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed) {
      const receiver = value(node.callee.object), args = node.arguments.map(value);
      if (typeof receiver !== "string" || args.some(arg => arg === undefined)) return undefined;
      const method = node.callee.property.name;
      if (method === "indexOf" && typeof args[0] === "string" && args.length === 1) return receiver.indexOf(args[0]);
      if (["slice", "substring"].includes(method) && args.length <= 2 && args.every(Number.isInteger)) return receiver[method](...args);
      if (method === "trim" && args.length === 0) return receiver.trim();
    }
    return undefined;
  }
  for (const statement of statements) {
    if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations) {
        if (declaration.id.type === "Identifier") locals.set(declaration.id.name, value(declaration.init));
      }
    } else if (statement.type === "ExpressionStatement") value(statement.expression);
    else if (statement.type !== "EmptyStatement") {
      // 分支和循环的实际执行路径不可确定，不能沿用旧存储值。
      stored.clear();
      return null;
    }
  }
  return imageCalls === 1 ? prompt : null;
}

export function recordedCommandOutput(output) {
  if (!Array.isArray(output)) return undefined;
  const texts = output.filter(part => part.type === "input_text" && typeof part.text === "string")
    .map(part => part.text).filter(text => !/^Script (?:completed|running)\b/.test(text));
  if (texts.length !== 1 || /(?:output truncated|tokens truncated|Warning: truncated)/i.test(texts[0])) return undefined;
  return texts[0];
}
