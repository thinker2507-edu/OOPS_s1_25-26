"use strict";
const fs = require("node:fs");
const path = require("node:path");
const ts = require("../tools/vendor/typescript/typescript.cjs");
const ROOT = path.resolve(__dirname, "..");
function expandStatements(statements) {
  return statements.flatMap((statement) => {
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length > 1) {
      return statement.declarationList.declarations.map((declaration) => ts.factory.createVariableStatement(statement.modifiers, ts.factory.createVariableDeclarationList([declaration], statement.declarationList.flags)));
    }
    return [statement];
  });
}
function formatJavaScript(source, filename) {
  const kind = filename.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind);
  if (parsed.parseDiagnostics.length) {
    throw new Error("Cannot format invalid source: " + filename);
  }
  const transformed = ts.transform(parsed, [
    (context) => {
      function visit(node) {
        node = ts.visitEachChild(node, visit, context);
        if (ts.isBlock(node)) {
          return ts.factory.createBlock(expandStatements([...node.statements]), true);
        }
        if (ts.isSourceFile(node)) {
          return ts.factory.updateSourceFile(node, expandStatements([...node.statements]));
        }
        if (ts.isObjectLiteralExpression(node) && node.properties.length > 1) {
          node.properties.forEach((property) => ts.setStartsOnNewLine(property, true));
          return ts.factory.createObjectLiteralExpression([...node.properties], true);
        }
        if (ts.isArrayLiteralExpression(node) && node.elements.length > 4) {
          node.elements.forEach((element) => ts.setStartsOnNewLine(element, true));
          return ts.factory.createArrayLiteralExpression([...node.elements], true);
        }
        if (ts.isIfStatement(node)) {
          const block = (body) => ts.isBlock(body) ? body : ts.factory.createBlock([body], true);
          return ts.factory.updateIfStatement(node, node.expression, block(node.thenStatement), node.elseStatement && (ts.isIfStatement(node.elseStatement) ? node.elseStatement : block(node.elseStatement)));
        }
        return node;
      }
      return (file) => ts.visitNode(file, visit);
    },
  ]);
  let output = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
  transformed.dispose();
  {
    const jsxFile = ts.createSourceFile(filename, output, ts.ScriptTarget.Latest, true, kind);
    const breaks = new Set();
    const addBreak = (position) => {
      if (!/\n[ \t]*$/.test(output.slice(0, position)) && !/^[ \t]*\n/.test(output.slice(position))) {
        breaks.add(position);
      }
    };
    function layout(node) {
      const elements = ts.isObjectLiteralExpression(node) ? node.properties :
        ts.isObjectBindingPattern(node) && node.elements.length > 4 ? node.elements :
          ts.isArrayLiteralExpression(node) && node.elements.length > 4 ? node.elements : null;
      if (elements && elements.length > 1) {
        for (const element of elements)
          addBreak(element.getStart(jsxFile));
        addBreak(node.end - 1);
      }
      if (ts.isJsxElement(node)) {
        // Mixed text/interpolation must stay together: inserting a newline
        // can remove a meaningful JSX space ("Page {page} of {total}").
        const mixedText = node.children.some(child => ts.isJsxText(child) && (child.text.trim() || child.text && !/[\r\n]/.test(child.text))) && node.children.some(child => !ts.isJsxText(child));
        if (!mixedText) {
          addBreak(node.openingElement.end);
          addBreak(node.closingElement.getStart(jsxFile));
          for (const child of node.children) {
            if (ts.isJsxText(child) && !child.text.trim()) {
              continue;
            }
            addBreak(child.getStart(jsxFile));
            addBreak(child.end);
          }
        }
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (node.attributes.properties.length > 1) {
          for (const attribute of node.attributes.properties)
            addBreak(attribute.getStart(jsxFile));
          addBreak(node.attributes.end);
        }
      }
      ts.forEachChild(node, layout);
    }
    layout(jsxFile);
    for (const position of [...breaks].sort((a, b) => b - a)) {
      output = output.slice(0, position) + "\n" + output.slice(position);
    }
  }
  const printed = ts.createSourceFile(filename, output, ts.ScriptTarget.Latest, true, kind);
  const edits = ts.formatting.formatDocument(printed, ts.formatting.getFormatContext({
    indentSize: 2,
    tabSize: 2,
    convertTabsToSpaces: true,
    newLineCharacter: "\n",
    insertSpaceAfterCommaDelimiter: true,
    insertSpaceBeforeAndAfterBinaryOperators: true,
    insertSpaceAfterKeywordsInControlFlowStatements: true,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true
  }, { getNewLine: () => "\n" }));
  for (const edit of [...edits].sort((a, b) => b.span.start - a.span.start)) {
    output = output.slice(0, edit.span.start) + edit.newText + output.slice(edit.span.start + edit.span.length);
  }
  return output;
}
function formatCss(source) {
  let result = "";
  let indent = 0;
  let quote = "";
  let parentheses = 0;
  let comment = false;
  function newline() {
    result = result.trimEnd() + "\n" + "  ".repeat(Math.max(0, indent));
  }
  for (let i = 0;i < source.length;i++) {
    const character = source[i];
    if (comment) {
      result += character;
      if (character === "*" && source[i + 1] === "/") {
        result += source[++i];
        comment = false;
      }
    }
    else if (quote) {
      result += character;
      if (character === "\\") {
        result += source[++i] || "";
      }
      else if (character === quote) {
        quote = "";
      }
    }
    else if (character === "/" && source[i + 1] === "*") {
      result += character + source[++i];
      comment = true;
    }
    else if (character === '"' || character === "'") {
      result += character;
      quote = character;
    }
    else if (character === "(") {
      result += character;
      parentheses++;
    }
    else if (character === ")") {
      result += character;
      parentheses--;
    }
    else if (!parentheses && character === "{") {
      result = result.trimEnd() + " {";
      indent++;
      newline();
    }
    else if (!parentheses && character === "}") {
      indent--;
      newline();
      result += "}";
      newline();
    }
    else if (!parentheses && character === ";") {
      result += ";";
      newline();
    }
    else if (!/\s/.test(character) || !/[ \n]$/.test(result)) {
      result += /\s/.test(character) ? " " : character;
    }
  }
  return result.trim().replace(/^(\s*[-\w]+):([^\n{}]*)$/gm, (_, name, value) => name + ": " + value.trimStart()) + "\n";
}
function files(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : [filename];
  });
}
function main() {
  const candidates = [
    ...files(path.join(ROOT, "backend", "src")),
    ...files(path.join(ROOT, "database")),
    ...files(path.join(ROOT, "database_schema")),
    ...files(path.join(ROOT, "frontend", "src")),
    ...files(path.join(ROOT, "frontend", "styles")),
    ...files(path.join(ROOT, "scripts")),
    ...files(path.join(ROOT, "tests")),
    path.join(ROOT, "server.cjs")
  ].filter((filename) => /\.(?:cjs|jsx|js|css)$/.test(filename) && !filename.endsWith('compass-upgrade.js'));
  for (const filename of candidates) {
    const source = fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, "");
    const formatted = filename.endsWith(".css") ? formatCss(source) : formatJavaScript(source, filename);
    fs.writeFileSync(filename, formatted);
  }
  console.log("Formatted " + candidates.length + " source files.");
}
if (require.main === module) {
  main();
}
module.exports = {
  formatJavaScript,
  formatCss
};
