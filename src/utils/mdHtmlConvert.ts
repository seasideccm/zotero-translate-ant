import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark, { all } from "rehype-remark";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { defaultHandlers } from "hast-util-to-mdast";
import { toHtml } from "hast-util-to-html";
import { toText } from "hast-util-to-text";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { h } from "hastscript";
import { Root as HRoot, RootContent } from "hast";
import { Root as MRoot } from "mdast";
import { Nodes } from "hast-util-to-text/lib";

export { md2html, html2md };

async function md2html(md: string) {
  const remark = md2remark(md);
  const rehype = await remark2rehype(remark);
  const html = rehype2note(rehype as HRoot);
  return html;
}

async function html2md(html: string) {
  const rehype = note2rehype(html);
  const remark = await rehype2remark(rehype as HRoot);
  if (!remark) {
    return "Parsing Error: HTML2MD";
  }
  const md = remark2md(remark as MRoot);
  return md;
}

function remark2md(remark: MRoot) {
  return String(
    unified()
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkStringify, {
        handlers: {
          pre: (node: { value: string }) => {
            return "```\n" + node.value + "\n```";
          },
          u: (node: { value: string }) => {
            return "<u>" + node.value + "</u>";
          },
          sub: (node: { value: string }) => {
            return "<sub>" + node.value + "</sub>";
          },
          sup: (node: { value: string }) => {
            return "<sup>" + node.value + "</sup>";
          },
          styleTable: (node: { value: any }) => {
            return node.value;
          },
          wrapper: (node: { value: string }) => {
            return "\n<!-- " + node.value + " -->\n";
          },
          wrapperleft: (node: { value: string }) => {
            return "<!-- " + node.value + " -->\n";
          },
          wrapperright: (node: { value: string }) => {
            return "\n<!-- " + node.value + " -->";
          },
          zhighlight: (node: { value: string }) => {
            return node.value.replace(/(^<zhighlight>|<\/zhighlight>$)/g, "");
          },
          zcitation: (node: { value: string }) => {
            return node.value.replace(/(^<zcitation>|<\/zcitation>$)/g, "");
          },
          znotelink: (node: { value: string }) => {
            return node.value.replace(/(^<znotelink>|<\/znotelink>$)/g, "");
          },
          zimage: (node: { value: string }) => {
            return node.value.replace(/(^<zimage>|<\/zimage>$)/g, "");
          },
        },
      } as any)
      .stringify(remark as any),
  );
}

async function rehype2remark(rehype: HRoot) {
  return await unified()
    .use(rehypeRemark, {
      handlers: {
        span: (h, node) => {
          if (
            node.properties?.style?.includes("text-decoration: line-through")
          ) {
            return h(node, "delete", all(h, node));
          } else if (node.properties?.style?.includes("background-color")) {
            return h(node, "html", toHtml(node));
          } else if (node.properties?.style?.includes("color")) {
            return h(node, "html", toHtml(node));
          } else if (node.properties?.className?.includes("math")) {
            return h(node, "inlineMath", toText(node).slice(1, -1));
          } else {
            return h(node, "paragraph", all(h, node));
          }
        },
        pre: (h, node) => {
          if (node.properties?.className?.includes("math")) {
            return h(node, "math", toText(node).slice(2, -2));
          } else {
            return h(node, "code", toText(node));
          }
        },
        u: (h, node) => {
          return h(node, "u", toText(node));
        },
        sub: (h, node) => {
          return h(node, "sub", toText(node));
        },
        sup: (h, node) => {
          return h(node, "sup", toText(node));
        },
        table: (h, node) => {
          let hasStyle = false;
          visit(
            node,
            (_n) =>
              _n.type === "element" &&
              ["tr", "td", "th"].includes((_n as any).tagName),
            (node) => {
              if (node.properties.style) {
                hasStyle = true;
              }
            },
          );
          // if (0 && hasStyle) {
          //   return h(node, "styleTable", toHtml(node));
          // } else {
          return defaultHandlers.table(h, node);
          // }
        },
        wrapper: (h, node) => {
          return h(node, "wrapper", toText(node));
        },
        wrapperleft: (h, node) => {
          return h(node, "wrapperleft", toText(node));
        },
        wrapperright: (h, node) => {
          return h(node, "wrapperright", toText(node));
        },
        zhighlight: (h, node) => {
          return h(node, "zhighlight", toHtml(node));
        },
        zcitation: (h, node) => {
          return h(node, "zcitation", toHtml(node));
        },
        znotelink: (h, node) => {
          return h(node, "znotelink", toHtml(node));
        },
        zimage: (h, node) => {
          return h(node, "zimage", toHtml(node));
        },
      },
    })
    .run(rehype as any);
}

function note2rehype(str: string) {
  const rehype = unified()
    .use(remarkGfm)
    .use(remarkMath)
    .use(rehypeParse, { fragment: true })
    .parse(str);

  // Make sure <br> is inline break. Remove \n before/after <br>
  const removeBlank = (node: any, parentNode: any, offset: number) => {
    const idx = parentNode.children.indexOf(node);
    const target = parentNode.children[idx + offset];
    if (
      target &&
      target.type === "text" &&
      !target.value.replace(/[\r\n]/g, "")
    ) {
      (parentNode.children as any[]).splice(idx + offset, 1);
    }
  };
  visitParents(
    rehype,
    (_n: any) => _n.type === "element" && _n.tagName === "br",
    (_n: any, ancestors) => {
      if (ancestors.length) {
        const parentNode = ancestors[ancestors.length - 1];
        removeBlank(_n, parentNode, -1);
        removeBlank(_n, parentNode, 1);
      }
    },
  );

  // Make sure <span> and <img> wrapped by <p>
  visitParents(
    rehype,
    (_n: any) =>
      _n.type === "element" && (_n.tagName === "span" || _n.tagName === "img"),
    (_n: any, ancestors) => {
      if (ancestors.length) {
        const parentNode = ancestors[ancestors.length - 1];
        if (parentNode === rehype) {
          const newChild = h("span");
          replace(newChild, _n);
          const p = h("p", [newChild]);
          replace(_n, p);
        }
      }
    },
  );

  // Make sure empty <p> under root node is removed
  visitParents(
    rehype,
    (_n: any) => _n.type === "element" && _n.tagName === "p",
    (_n: any, ancestors) => {
      if (ancestors.length) {
        const parentNode = ancestors[ancestors.length - 1];
        if (parentNode === rehype && !_n.children.length && !toText(_n)) {
          parentNode.children.splice(parentNode.children.indexOf(_n), 1);
        }
      }
    },
  );
  return rehype;
}

function md2remark(str: string) {
  // Parse Obsidian-style image ![[xxx.png]]
  // Encode spaces in link, otherwise it cannot be parsed to image node
  str = str
    .replace(/!\[\[(.*)\]\]/g, (s: string) => `![](${s.slice(3, -2)})`)
    .replace(
      /!\[.*\]\((.*)\)/g,
      (s: string) =>
        `![](${encodeURIComponent(s.match(/\(.*\)/g)![0].slice(1, -1))})`,
    );
  const remark = unified()
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkParse)
    .parse(str);
  return remark;
}

async function remark2rehype(remark: any) {
  return await unified()
    .use(remarkRehype, {
      allowDangerousHtml: true,
    })
    .run(remark);
}

function rehype2note(rehype: HRoot) {
  // Del node
  visit(
    rehype,
    (node: any) => node.type === "element" && (node as any).tagName === "del",
    (node: any) => {
      node.tagName = "span";
      node.properties.style = "text-decoration: line-through";
    },
  );

  // Code node
  visitParents(
    rehype,
    (node: any) => node.type === "element" && (node as any).tagName === "code",
    (node: any, ancestors) => {
      const parent = ancestors.length
        ? ancestors[ancestors.length - 1]
        : undefined;
      if (parent?.type == "element" && parent?.tagName === "pre") {
        node.value = toText(node);
        node.type = "text";
      }
    },
  );

  // Table node with style
  visit(
    rehype,
    (node: any) => node.type === "element" && (node as any).tagName === "table",
    (node: any) => {
      let hasStyle = false;
      visit(
        node,
        (_n: any) =>
          _n.type === "element" &&
          ["tr", "td", "th"].includes((_n as any).tagName),
        (node: any) => {
          if (node.properties.style) {
            hasStyle = true;
          }
        },
      );
      if (hasStyle) {
        node.value = toHtml(node).replace(/[\r\n]/g, "");
        node.children = [];
        node.type = "raw";
      }
    },
  );

  // Convert thead to tbody
  visit(
    rehype,
    (node: any) => node.type === "element" && (node as any).tagName === "thead",
    (node: any) => {
      node.value = toHtml(node).slice(7, -8);
      node.children = [];
      node.type = "raw";
    },
  );

  // Wrap lines in list with <p> (for diff)
  visitParents(rehype, "text", (node: any, ancestors) => {
    const parent = ancestors.length
      ? ancestors[ancestors.length - 1]
      : undefined;
    if (
      node.value.replace(/[\r\n]/g, "") &&
      parent?.type == "element" &&
      ["li", "td"].includes(parent?.tagName)
    ) {
      node.type = "element";
      node.tagName = "p";
      node.children = [
        { type: "text", value: node.value.replace(/[\r\n]/g, "") },
      ];
      node.value = undefined;
    }
  });

  // No empty breakline text node in list (for diff)
  visit(
    rehype,
    (node: any) =>
      node.type === "element" &&
      ((node as any).tagName === "li" || (node as any).tagName === "td"),
    (node: any) => {
      node.children = node.children.filter(
        (_n: { type: string; value: string }) =>
          _n.type === "element" ||
          (_n.type === "text" && _n.value.replace(/[\r\n]/g, "")),
      );
    },
  );

  // Math node
  visit(
    rehype,
    (node: any) =>
      node.type === "element" &&
      ((node as any).properties?.className?.includes("math-inline") ||
        (node as any).properties?.className?.includes("math-display")),
    (node: any) => {
      if (node.properties.className.includes("math-inline")) {
        node.children = [
          { type: "text", value: "$" },
          ...node.children,
          { type: "text", value: "$" },
        ];
      } else if (node.properties.className.includes("math-display")) {
        node.children = [
          { type: "text", value: "$$" },
          ...node.children,
          { type: "text", value: "$$" },
        ];
        node.tagName = "pre";
      }
      node.properties.className = "math";
    },
  );

  // Ignore link rel attribute, which exists in note
  visit(
    rehype,
    (node: any) => node.type === "element" && (node as any).tagName === "a",
    (node: any) => {
      node.properties.rel = undefined;
    },
  );

  // Ignore empty lines, as they are not parsed to md
  const tempChildren: RootContent[] = [];
  const isEmptyNode = (_n: Nodes) =>
    (_n.type === "text" && !_n.value.trim()) ||
    (_n.type === "element" &&
      _n.tagName === "p" &&
      !_n.children.length &&
      !toText(_n).trim());
  for (const child of rehype.children) {
    if (
      tempChildren.length &&
      isEmptyNode(tempChildren[tempChildren.length - 1] as Nodes) &&
      isEmptyNode(child as Nodes)
    ) {
      continue;
    }
    tempChildren.push(child);
  }

  rehype.children = tempChildren;

  return unified()
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .stringify(rehype as any);
}
function replace(targetNode: any, sourceNode: any) {
  targetNode.type = sourceNode.type;
  targetNode.tagName = sourceNode.tagName;
  targetNode.properties = sourceNode.properties;
  targetNode.value = sourceNode.value;
  targetNode.children = sourceNode.children;
}
