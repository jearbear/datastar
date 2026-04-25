// src/engine/consts.ts
var lol = /🖕JS_DS🚀/.source;
var DSP = lol.slice(0, 5);
var DSS = lol.slice(4);
var DATASTAR_FETCH_EVENT = "datastar-fetch";
var DATASTAR_PROP_CHANGE_EVENT = "datastar-prop-change";
var DATASTAR_READY_EVENT = "datastar-ready";
var DATASTAR_SCOPE_CHILDREN_EVENT = "datastar-scope-children";
var DATASTAR_SIGNAL_PATCH_EVENT = "datastar-signal-patch";

// src/utils/polyfills.ts
var hasOwn = (
  // @ts-expect-error
  Object.hasOwn ?? Object.prototype.hasOwnProperty.call
);

// src/utils/paths.ts
var isPojo = (obj) => obj !== null && typeof obj === "object" && (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
var isEmpty = (obj) => {
  for (const prop in obj) {
    if (hasOwn(obj, prop)) {
      return false;
    }
  }
  return true;
};
var updateLeaves = (obj, fn) => {
  for (const key in obj) {
    const val = obj[key];
    if (isPojo(val) || Array.isArray(val)) {
      updateLeaves(val, fn);
    } else {
      obj[key] = fn(val);
    }
  }
};
var pathToObj = (paths) => {
  const result = {};
  for (const [path, value] of paths) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const obj = keys.reduce((acc, key) => acc[key] ??= {}, result);
    obj[lastKey] = value;
  }
  return result;
};

// src/engine/signals.ts
var currentPatch = [];
var queuedEffects = [];
var batchDepth = 0;
var notifyIndex = 0;
var queuedEffectsLength = 0;
var prevSub;
var activeSub;
var version = 0;
var beginBatch = () => {
  batchDepth++;
};
var endBatch = () => {
  if (!--batchDepth) {
    flush();
    dispatch();
  }
};
var startPeeking = (sub) => {
  prevSub = activeSub;
  activeSub = sub;
};
var stopPeeking = () => {
  activeSub = prevSub;
  prevSub = void 0;
};
var signal = (initialValue) => {
  return signalOper.bind(0, {
    previousValue: initialValue,
    value_: initialValue,
    flags_: 1
  });
};
var computedSymbol = /* @__PURE__ */ Symbol("computed");
var computed = (getter) => {
  const c = computedOper.bind(0, {
    flags_: 17,
    getter
  });
  c[computedSymbol] = 1;
  return c;
};
var effect = (fn) => {
  const e = {
    fn_: fn,
    flags_: 2
  };
  if (activeSub) {
    link(e, activeSub);
  }
  startPeeking(e);
  beginBatch();
  try {
    e.fn_();
  } finally {
    endBatch();
    stopPeeking();
  }
  return effectOper.bind(0, e);
};
var flush = () => {
  while (notifyIndex < queuedEffectsLength) {
    const effect2 = queuedEffects[notifyIndex];
    queuedEffects[notifyIndex++] = void 0;
    run(effect2, effect2.flags_ &= ~64 /* Queued */);
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
};
var update = (signal2) => {
  if ("getter" in signal2) {
    return updateComputed(signal2);
  }
  return updateSignal(signal2, signal2.value_);
};
var updateComputed = (c) => {
  startPeeking(c);
  startTracking(c);
  try {
    const oldValue = c.value_;
    return oldValue !== (c.value_ = c.getter(oldValue));
  } finally {
    stopPeeking();
    endTracking(c);
  }
};
var updateSignal = (s, value) => {
  s.flags_ = 1;
  return s.previousValue !== (s.previousValue = value);
};
var notify = (e) => {
  const flags = e.flags_;
  if (!(flags & 64 /* Queued */)) {
    e.flags_ = flags | 64 /* Queued */;
    const subs = e.subs_;
    if (subs) {
      notify(subs.sub_);
    } else {
      queuedEffects[queuedEffectsLength++] = e;
    }
  }
};
var run = (e, flags) => {
  if (flags & 16 || flags & 32 && checkDirty(e.deps_, e)) {
    startPeeking(e);
    startTracking(e);
    beginBatch();
    try {
      e.fn_();
    } finally {
      endBatch();
      stopPeeking();
      endTracking(e);
    }
    return;
  }
  if (flags & 32) {
    e.flags_ = flags & ~32;
  }
  let link2 = e.deps_;
  while (link2) {
    const dep = link2.dep_;
    const depFlags = dep.flags_;
    if (depFlags & 64 /* Queued */) {
      run(dep, dep.flags_ = depFlags & ~64 /* Queued */);
    }
    link2 = link2.nextDep_;
  }
};
var signalOper = (s, ...value) => {
  if (value.length) {
    if (s.value_ !== (s.value_ = value[0])) {
      s.flags_ = 17;
      const subs = s.subs_;
      if (subs) {
        propagate(subs);
        if (!batchDepth) {
          flush();
        }
      }
      return true;
    }
    return false;
  }
  const currentValue = s.value_;
  if (s.flags_ & 16) {
    if (updateSignal(s, currentValue)) {
      const subs_ = s.subs_;
      if (subs_) {
        shallowPropagate(subs_);
      }
    }
  }
  if (activeSub) {
    link(s, activeSub);
  }
  return currentValue;
};
var computedOper = (c) => {
  const flags = c.flags_;
  if (flags & 16 || flags & 32 && checkDirty(c.deps_, c)) {
    if (updateComputed(c)) {
      const subs = c.subs_;
      if (subs) {
        shallowPropagate(subs);
      }
    }
  } else if (flags & 32) {
    c.flags_ = flags & ~32;
  }
  if (activeSub) {
    link(c, activeSub);
  }
  return c.value_;
};
var effectOper = (e) => {
  let dep = e.deps_;
  while (dep) {
    dep = unlink(dep, e);
  }
  const sub = e.subs_;
  if (sub) {
    unlink(sub);
  }
  e.flags_ = 0;
};
var link = (dep, sub) => {
  const prevDep = sub.depsTail_;
  if (prevDep && prevDep.dep_ === dep) {
    return;
  }
  const nextDep = prevDep ? prevDep.nextDep_ : sub.deps_;
  if (nextDep && nextDep.dep_ === dep) {
    nextDep.version_ = version;
    sub.depsTail_ = nextDep;
    return;
  }
  const prevSub2 = dep.subsTail_;
  if (prevSub2 && prevSub2.version_ === version && prevSub2.sub_ === sub) {
    return;
  }
  const newLink = sub.depsTail_ = dep.subsTail_ = {
    version_: version,
    dep_: dep,
    sub_: sub,
    prevDep_: prevDep,
    nextDep_: nextDep,
    prevSub_: prevSub2
  };
  if (nextDep) {
    nextDep.prevDep_ = newLink;
  }
  if (prevDep) {
    prevDep.nextDep_ = newLink;
  } else {
    sub.deps_ = newLink;
  }
  if (prevSub2) {
    prevSub2.nextSub_ = newLink;
  } else {
    dep.subs_ = newLink;
  }
};
var unlink = (link2, sub = link2.sub_) => {
  const dep_ = link2.dep_;
  const prevDep_ = link2.prevDep_;
  const nextDep_ = link2.nextDep_;
  const nextSub_ = link2.nextSub_;
  const prevSub_ = link2.prevSub_;
  if (nextDep_) {
    nextDep_.prevDep_ = prevDep_;
  } else {
    sub.depsTail_ = prevDep_;
  }
  if (prevDep_) {
    prevDep_.nextDep_ = nextDep_;
  } else {
    sub.deps_ = nextDep_;
  }
  if (nextSub_) {
    nextSub_.prevSub_ = prevSub_;
  } else {
    dep_.subsTail_ = prevSub_;
  }
  if (prevSub_) {
    prevSub_.nextSub_ = nextSub_;
  } else if (!(dep_.subs_ = nextSub_)) {
    if ("getter" in dep_) {
      let toRemove = dep_.deps_;
      if (toRemove) {
        dep_.flags_ = 17;
        do {
          toRemove = unlink(toRemove, dep_);
        } while (toRemove);
      }
    } else if (!("previousValue" in dep_)) {
      effectOper(dep_);
    }
  }
  return nextDep_;
};
var propagate = (link2) => {
  let next = link2.nextSub_;
  let stack;
  top: while (true) {
    const sub = link2.sub_;
    let flags = sub.flags_;
    if (!(flags & 60)) {
      sub.flags_ = flags | 32;
    } else if (!(flags & 12)) {
      flags = 0;
    } else if (!(flags & 4)) {
      sub.flags_ = flags & ~8 | 32;
    } else if (!(flags & 48) && isValidLink(link2, sub)) {
      sub.flags_ = flags | 40;
      flags &= 1;
    } else {
      flags = 0;
    }
    if (flags & 2) {
      notify(sub);
    }
    if (flags & 1) {
      const subSubs = sub.subs_;
      if (subSubs) {
        const nextSub = (link2 = subSubs).nextSub_;
        if (nextSub) {
          stack = { value_: next, prev_: stack };
          next = nextSub;
        }
        continue;
      }
    }
    if (link2 = next) {
      next = link2.nextSub_;
      continue;
    }
    while (stack) {
      link2 = stack.value_;
      stack = stack.prev_;
      if (link2) {
        next = link2.nextSub_;
        continue top;
      }
    }
    break;
  }
};
var startTracking = (sub) => {
  version++;
  sub.depsTail_ = void 0;
  sub.flags_ = sub.flags_ & ~56 | 4;
};
var endTracking = (sub) => {
  const depsTail_ = sub.depsTail_;
  let toRemove = depsTail_ ? depsTail_.nextDep_ : sub.deps_;
  while (toRemove) {
    toRemove = unlink(toRemove, sub);
  }
  sub.flags_ &= ~4;
};
var checkDirty = (link2, sub) => {
  let stack;
  let checkDepth = 0;
  let dirty = false;
  top: while (true) {
    const dep = link2.dep_;
    const flags = dep.flags_;
    if (sub.flags_ & 16) {
      dirty = true;
    } else if ((flags & 17) === 17) {
      if (update(dep)) {
        const subs = dep.subs_;
        if (subs.nextSub_) {
          shallowPropagate(subs);
        }
        dirty = true;
      }
    } else if ((flags & 33) === 33) {
      if (link2.nextSub_ || link2.prevSub_) {
        stack = { value_: link2, prev_: stack };
      }
      link2 = dep.deps_;
      sub = dep;
      ++checkDepth;
      continue;
    }
    if (!dirty) {
      const nextDep = link2.nextDep_;
      if (nextDep) {
        link2 = nextDep;
        continue;
      }
    }
    while (checkDepth--) {
      const firstSub = sub.subs_;
      const hasMultipleSubs = firstSub.nextSub_;
      if (hasMultipleSubs) {
        link2 = stack.value_;
        stack = stack.prev_;
      } else {
        link2 = firstSub;
      }
      if (dirty) {
        if (update(sub)) {
          if (hasMultipleSubs) {
            shallowPropagate(firstSub);
          }
          sub = link2.sub_;
          continue;
        }
        dirty = false;
      } else {
        sub.flags_ &= ~32;
      }
      sub = link2.sub_;
      if (link2.nextDep_) {
        link2 = link2.nextDep_;
        continue top;
      }
    }
    return dirty;
  }
};
var shallowPropagate = (link2) => {
  do {
    const sub = link2.sub_;
    const flags = sub.flags_;
    if ((flags & 48) === 32) {
      sub.flags_ = flags | 16;
      if (flags & 2) {
        notify(sub);
      }
    }
  } while (link2 = link2.nextSub_);
};
var isValidLink = (checkLink, sub) => {
  let link2 = sub.depsTail_;
  while (link2) {
    if (link2 === checkLink) {
      return true;
    }
    link2 = link2.prevDep_;
  }
  return false;
};
var getPath = (path) => {
  let result = root;
  const split = path.split(".");
  for (const path2 of split) {
    if (result == null || !hasOwn(result, path2)) {
      return;
    }
    result = result[path2];
  }
  return result;
};
var deep = (value, prefix = "") => {
  const isArr = Array.isArray(value);
  if (isArr || isPojo(value)) {
    const deepObj = isArr ? [] : {};
    for (const key in value) {
      deepObj[key] = signal(
        deep(value[key], `${prefix + key}.`)
      );
    }
    const keys = signal(0);
    return new Proxy(deepObj, {
      get(_, prop) {
        if (!(prop === "toJSON" && !hasOwn(deepObj, prop))) {
          if (isArr && prop in Array.prototype) {
            keys();
            return deepObj[prop];
          }
          if (typeof prop === "symbol") {
            return deepObj[prop];
          }
          if (!hasOwn(deepObj, prop) || deepObj[prop]() == null) {
            deepObj[prop] = signal("");
            dispatch(prefix + prop, "");
            keys(keys() + 1);
          }
          return deepObj[prop]();
        }
      },
      set(_, prop, newValue) {
        const path = prefix + prop;
        if (isArr && prop === "length") {
          const diff = deepObj[prop] - newValue;
          deepObj[prop] = newValue;
          if (diff > 0) {
            const patch = {};
            for (let i = newValue; i < deepObj[prop]; i++) {
              patch[i] = null;
            }
            dispatch(prefix.slice(0, -1), patch);
            keys(keys() + 1);
          }
        } else if (hasOwn(deepObj, prop)) {
          if (newValue == null) {
            delete deepObj[prop];
          } else if (hasOwn(newValue, computedSymbol)) {
            deepObj[prop] = newValue;
            dispatch(path, "");
          } else {
            const currentValue = deepObj[prop]();
            const pathStr = `${path}.`;
            if (isPojo(currentValue) && isPojo(newValue)) {
              for (const key in currentValue) {
                if (!hasOwn(newValue, key)) {
                  delete currentValue[key];
                  dispatch(pathStr + key, null);
                }
              }
              for (const key in newValue) {
                const nextVal = newValue[key];
                if (currentValue[key] !== nextVal) {
                  currentValue[key] = nextVal;
                }
              }
            } else if (deepObj[prop](deep(newValue, pathStr))) {
              dispatch(path, newValue);
            }
          }
        } else if (newValue != null) {
          if (hasOwn(newValue, computedSymbol)) {
            deepObj[prop] = newValue;
            dispatch(path, "");
          } else {
            deepObj[prop] = signal(deep(newValue, `${path}.`));
            dispatch(path, newValue);
          }
          keys(keys() + 1);
        }
        return true;
      },
      deleteProperty(_, prop) {
        delete deepObj[prop];
        keys(keys() + 1);
        return true;
      },
      ownKeys() {
        keys();
        return Reflect.ownKeys(deepObj);
      },
      has(_, prop) {
        keys();
        return prop in deepObj;
      }
    });
  }
  return value;
};
var dispatch = (path, value) => {
  if (path !== void 0 && value !== void 0) {
    currentPatch.push([path, value]);
  }
  if (!batchDepth && currentPatch.length) {
    const detail = pathToObj(currentPatch);
    currentPatch.length = 0;
    document.dispatchEvent(
      new CustomEvent(DATASTAR_SIGNAL_PATCH_EVENT, {
        detail
      })
    );
  }
};
var mergePatch = (patch, { ifMissing } = {}) => {
  beginBatch();
  for (const key in patch) {
    if (patch[key] == null) {
      if (!ifMissing) {
        delete root[key];
      }
    } else {
      mergeInner(patch[key], key, root, "", ifMissing);
    }
  }
  endBatch();
};
var mergePaths = (paths, options) => mergePatch(pathToObj(paths), options);
var mergeInner = (patch, target, targetParent, prefix, ifMissing) => {
  if (isPojo(patch)) {
    if (!(hasOwn(targetParent, target) && (isPojo(targetParent[target]) || Array.isArray(targetParent[target])))) {
      targetParent[target] = {};
    }
    for (const key in patch) {
      if (patch[key] == null) {
        if (!ifMissing) {
          delete targetParent[target][key];
        }
      } else {
        mergeInner(
          patch[key],
          key,
          targetParent[target],
          `${prefix + target}.`,
          ifMissing
        );
      }
    }
  } else if (!(ifMissing && hasOwn(targetParent, target))) {
    targetParent[target] = patch;
  }
};
var toRegExp = (val) => typeof val === "string" ? RegExp(val.replace(/^\/|\/$/g, "")) : val;
var filtered = ({ include = /.*/, exclude = /(?!)/ } = {}, obj = root) => {
  const includeRe = toRegExp(include);
  const excludeRe = toRegExp(exclude);
  const paths = [];
  const stack = [[obj, ""]];
  while (stack.length) {
    const [node, prefix] = stack.pop();
    for (const key in node) {
      const path = prefix + key;
      if (isPojo(node[key])) {
        stack.push([node[key], `${path}.`]);
      } else if (includeRe.test(path) && !excludeRe.test(path)) {
        paths.push([path, getPath(path)]);
      }
    }
  }
  return pathToObj(paths);
};
var root = deep({});

// src/utils/dom.ts
var isHTMLOrSVG = (el) => el instanceof HTMLElement || el instanceof SVGElement || el instanceof MathMLElement;

// src/utils/text.ts
var kebab = (str) => str.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([a-z])([0-9]+)/gi, "$1-$2").replace(/([0-9]+)([a-z])/gi, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
var camel = (str) => kebab(str).replace(/-./g, (x) => x[1].toUpperCase());
var snake = (str) => kebab(str).replace(/-/g, "_");
var RE_FUNCTION_LITERAL = /^(?:(?:async\s+)?function\b|(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/;
var jsStrToObject = (raw, options = {}) => {
  const { reviveFunctionStrings = false } = options;
  try {
    if (!reviveFunctionStrings) return JSON.parse(raw);
    return JSON.parse(raw, (_k, value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (!RE_FUNCTION_LITERAL.test(trimmed)) return value;
      try {
        const revived = Function(`return (${trimmed})`)();
        return typeof revived === "function" ? revived : value;
      } catch {
        return value;
      }
    });
  } catch {
    return Function(`return (${raw})`)();
  }
};
var caseFns = {
  camel: (str) => str.replace(/-[a-z]/g, (x) => x[1].toUpperCase()),
  snake: (str) => str.replace(/-/g, "_"),
  pascal: (str) => str[0].toUpperCase() + caseFns.camel(str.slice(1))
};
var modifyCasing = (str, mods, defaultCase = "camel") => {
  for (const c of mods.get("case") || [defaultCase]) {
    str = caseFns[c]?.(str) || str;
  }
  return str;
};
var aliasify = (name) => null ? `data-${null}-${name}` : `data-${name}`;
var unaliasify = (name) => {
  if (true) return name;
  if (!name.startsWith(`${null}-`)) return null;
  return name.slice(null.length + 1);
};

// src/engine/engine.ts
var url = "https://data-star.dev/errors";
var error = (ctx, reason, metadata = {}) => {
  Object.assign(metadata, ctx);
  const e = new Error();
  const r = snake(reason);
  const q = new URLSearchParams({
    metadata: JSON.stringify(metadata)
  }).toString();
  const c = JSON.stringify(metadata, null, 2);
  e.message = `${reason}
More info: ${url}/${r}?${q}
Context: ${c}`;
  return e;
};
var actionPlugins = /* @__PURE__ */ new Map();
var attributePlugins = /* @__PURE__ */ new Map();
var watcherPlugins = /* @__PURE__ */ new Map();
var actions = new Proxy(
  {},
  {
    get: (_, prop) => actionPlugins.get(prop)?.apply,
    has: (_, prop) => actionPlugins.has(prop),
    ownKeys: () => Reflect.ownKeys(actionPlugins),
    set: () => false,
    deleteProperty: () => false
  }
);
var removals = /* @__PURE__ */ new Map();
var queuedAttributes = [];
var queuedAttributeNames = /* @__PURE__ */ new Set();
var observedRoots = /* @__PURE__ */ new Set();
var datastarReadyDispatched = false;
var attribute = (plugin) => {
  queuedAttributes.push(plugin);
  if (queuedAttributes.length === 1) {
    setTimeout(() => {
      for (const attribute2 of queuedAttributes) {
        queuedAttributeNames.add(attribute2.name);
        attributePlugins.set(attribute2.name, attribute2);
      }
      queuedAttributes.length = 0;
      const roots = observedRoots.size ? [...observedRoots] : [document.documentElement];
      for (const root2 of roots) {
        applyQueued(root2, !observedRoots.has(root2));
      }
      queuedAttributeNames.clear();
    });
  }
};
var action = (plugin) => {
  actionPlugins.set(plugin.name, plugin);
};
document.addEventListener(DATASTAR_FETCH_EVENT, ((evt) => {
  const plugin = watcherPlugins.get(evt.detail.type);
  if (plugin) {
    plugin.apply(
      {
        error: error.bind(0, {
          plugin: { type: "watcher", name: plugin.name },
          element: {
            id: evt.target.id,
            tag: evt.target.tagName
          }
        })
      },
      evt.detail.argsRaw
    );
  }
}));
var watcher = (plugin) => {
  watcherPlugins.set(plugin.name, plugin);
};
var cleanupEls = (els) => {
  for (const el of els) {
    const elCleanups = removals.get(el);
    if (elCleanups && removals.delete(el)) {
      for (const attrCleanups of elCleanups.values()) {
        for (const cleanup of attrCleanups.values()) {
          cleanup();
        }
      }
    }
  }
};
var aliasedIgnore = aliasify("ignore");
var aliasedIgnoreAttr = `[${aliasedIgnore}]`;
var shouldIgnore = (el) => el.hasAttribute(`${aliasedIgnore}__self`) || !!el.closest(aliasedIgnoreAttr);
var applyEls = (els, onlyNew) => {
  for (const el of els) {
    if (!shouldIgnore(el)) {
      const appliedKeys = /* @__PURE__ */ new Set();
      for (const key in el.dataset) {
        const attrKey = key.replace(/[A-Z]/g, "-$&").toLowerCase();
        appliedKeys.add(attrKey);
        applyAttributePlugin(el, attrKey, el.dataset[key], onlyNew);
      }
      for (const attr of Array.from(el.attributes)) {
        if (!attr.name.startsWith("data-")) continue;
        const attrKey = attr.name.slice(5);
        if (appliedKeys.has(attrKey)) continue;
        applyAttributePlugin(el, attrKey, attr.value, onlyNew);
      }
    }
  }
};
var observe = (mutations) => {
  for (const {
    target,
    type,
    attributeName,
    addedNodes,
    removedNodes
  } of mutations) {
    if (type === "childList") {
      for (const node of removedNodes) {
        if (isHTMLOrSVG(node)) {
          cleanupEls([node]);
          cleanupEls(node.querySelectorAll("*"));
        }
      }
      for (const node of addedNodes) {
        if (isHTMLOrSVG(node)) {
          applyEls([node]);
          applyEls(node.querySelectorAll("*"));
        }
      }
    } else if (type === "attributes" && attributeName.startsWith("data-") && isHTMLOrSVG(target) && !shouldIgnore(target)) {
      const rawAttrKey = attributeName.slice(5);
      const key = unaliasify(rawAttrKey);
      if (!key) continue;
      const value = target.getAttribute(attributeName);
      if (value === null) {
        const elCleanups = removals.get(target);
        if (elCleanups) {
          const attrCleanups = elCleanups.get(key);
          if (attrCleanups) {
            for (const cleanup of attrCleanups.values()) {
              cleanup();
            }
            elCleanups.delete(key);
          }
        }
      } else {
        applyAttributePlugin(target, rawAttrKey, value);
      }
    }
  }
};
var mutationObserver = new MutationObserver(observe);
var parseAttributeKey = (rawKey) => {
  const [namePart, ...rawModifiers] = rawKey.split("__");
  const [pluginName, key] = namePart.split(/:(.+)/);
  const mods = /* @__PURE__ */ new Map();
  for (const rawMod of rawModifiers) {
    const [label, ...mod] = rawMod.split(".");
    mods.set(label, new Set(mod));
  }
  return { pluginName, key, mods };
};
var isDocumentObserverActive = () => observedRoots.has(document.documentElement);
var dispatchDatastarReady = () => {
  if (datastarReadyDispatched || !isDocumentObserverActive()) return;
  datastarReadyDispatched = true;
  document.dispatchEvent(new Event(DATASTAR_READY_EVENT));
};
var applyQueued = (root2 = document.documentElement, observeRoot = true) => {
  if (isHTMLOrSVG(root2)) {
    applyEls([root2], true);
  }
  applyEls(root2.querySelectorAll("*"), true);
  if (observeRoot) {
    mutationObserver.observe(root2, {
      subtree: true,
      childList: true,
      attributes: true
    });
    observedRoots.add(root2);
    dispatchDatastarReady();
  }
};
var applyAttributePlugin = (el, attrKey, value, onlyNew) => {
  const rawKey = unaliasify(attrKey);
  if (!rawKey) return;
  const { pluginName, key, mods } = parseAttributeKey(rawKey);
  const plugin = attributePlugins.get(pluginName);
  const shouldApply = (!onlyNew || queuedAttributeNames.has(pluginName)) && !!plugin;
  if (shouldApply) {
    const ctx = {
      el,
      rawKey,
      mods,
      error: error.bind(0, {
        plugin: { type: "attribute", name: plugin.name },
        element: { id: el.id, tag: el.tagName },
        expression: { rawKey, key, value }
      }),
      key,
      value,
      loadedPluginNames: {
        actions: new Set(actionPlugins.keys()),
        attributes: new Set(attributePlugins.keys())
      },
      rx: void 0
    };
    const keyReq = plugin.requirement && (typeof plugin.requirement === "string" ? plugin.requirement : plugin.requirement.key) || "allowed";
    const valueReq = plugin.requirement && (typeof plugin.requirement === "string" ? plugin.requirement : plugin.requirement.value) || "allowed";
    const keyProvided = key !== void 0 && key !== null && key !== "";
    const valueProvided = value !== void 0 && value !== null && value !== "";
    if (keyProvided) {
      if (keyReq === "denied") {
        throw ctx.error("KeyNotAllowed");
      }
    } else if (keyReq === "must") {
      throw ctx.error("KeyRequired");
    }
    if (valueProvided) {
      if (valueReq === "denied") {
        throw ctx.error("ValueNotAllowed");
      }
    } else if (valueReq === "must") {
      throw ctx.error("ValueRequired");
    }
    if (keyReq === "exclusive" || valueReq === "exclusive") {
      if (keyProvided && valueProvided) {
        throw ctx.error("KeyAndValueProvided");
      }
      if (!keyProvided && !valueProvided) {
        throw ctx.error("KeyOrValueRequired");
      }
    }
    const cleanups = /* @__PURE__ */ new Map();
    if (valueProvided) {
      let cachedRx;
      ctx.rx = (...args) => {
        if (!cachedRx) {
          cachedRx = genRx(value, {
            returnsValue: plugin.returnsValue,
            argNames: plugin.argNames,
            cleanups
          });
        }
        return cachedRx(el, ...args);
      };
    }
    const cleanup = plugin.apply(ctx);
    if (cleanup) {
      cleanups.set("attribute", cleanup);
    }
    let elCleanups = removals.get(el);
    if (elCleanups) {
      const attrCleanups = elCleanups.get(rawKey);
      if (attrCleanups) {
        for (const oldCleanup of attrCleanups.values()) {
          oldCleanup();
        }
      }
    } else {
      elCleanups = /* @__PURE__ */ new Map();
      removals.set(el, elCleanups);
    }
    elCleanups.set(rawKey, cleanups);
  }
};
var genRx = (value, {
  returnsValue = false,
  argNames = [],
  cleanups = /* @__PURE__ */ new Map()
} = {}) => {
  let expr = "";
  if (returnsValue) {
    const statementRe = /(\/(\\\/|[^/])*\/|"(\\"|[^"])*"|'(\\'|[^'])*'|`(\\`|[^`])*`|\(\s*((function)\s*\(\s*\)|(\(\s*\))\s*=>)\s*(?:\{[\s\S]*?\}|[^;){]*)\s*\)\s*\(\s*\)|[^;])+/gm;
    const statements = value.trim().match(statementRe);
    if (statements) {
      const lastIdx = statements.length - 1;
      const last = statements[lastIdx].trim();
      if (!last.startsWith("return")) {
        statements[lastIdx] = `return (${last});`;
      }
      expr = statements.join(";\n");
    }
  } else {
    expr = value.trim();
  }
  const escaped = /* @__PURE__ */ new Map();
  const escapeRe = RegExp(`(?:${DSP})(.*?)(?:${DSS})`, "gm");
  let counter = 0;
  for (const match of expr.matchAll(escapeRe)) {
    const k = match[1];
    const v = `__escaped${counter++}`;
    escaped.set(v, k);
    expr = expr.replace(DSP + k + DSS, v);
  }
  expr = expr.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\$]|\$(?!\{))*`)|\$\{([^{}]*)\}|\$([a-zA-Z_\d]\w*(?:[.-]\w+)*)/g,
    (match, quoted, interpolationExpr, signalName) => {
      if (quoted) return match;
      if (interpolationExpr !== void 0) {
        return `\${${interpolationExpr.replace(
          /\$([a-zA-Z_\d]\w*(?:[.-]\w+)*)/g,
          (_, innerSignalName) => innerSignalName.split(".").reduce((acc, part) => `${acc}['${part}']`, "$")
        )}}`;
      }
      return signalName.split(".").reduce((acc, part) => `${acc}['${part}']`, "$");
    }
  );
  expr = expr.replaceAll(/@([A-Za-z_$][\w$]*)\(/g, '__action("$1",evt,');
  for (const [k, v] of escaped) {
    expr = expr.replace(k, v);
  }
  try {
    const fn = Function("el", "$", "__action", "evt", ...argNames, expr);
    return (el, ...args) => {
      const action2 = (name, evt, ...args2) => {
        const err = error.bind(0, {
          plugin: { type: "action", name },
          element: { id: el.id, tag: el.tagName },
          expression: {
            fnContent: expr,
            value
          }
        });
        const fn2 = actions[name];
        if (fn2) {
          return fn2(
            {
              el,
              evt,
              error: err,
              cleanups
            },
            ...args2
          );
        }
        throw err("UndefinedAction");
      };
      try {
        return fn(el, root, action2, void 0, ...args);
      } catch (e) {
        console.error(e);
        throw error(
          {
            element: { id: el.id, tag: el.tagName },
            expression: {
              fnContent: expr,
              value
            },
            error: e.message
          },
          "ExecuteExpression"
        );
      }
    };
  } catch (e) {
    console.error(e);
    throw error(
      {
        expression: {
          fnContent: expr,
          value
        },
        error: e.message
      },
      "GenerateExpression"
    );
  }
};

// src/plugins/actions/peek.ts
action({
  name: "peek",
  apply(_, fn) {
    startPeeking();
    try {
      return fn();
    } finally {
      stopPeeking();
    }
  }
});

// src/plugins/actions/setAll.ts
action({
  name: "setAll",
  apply(_, value, filter) {
    startPeeking();
    const masked = filtered(filter);
    updateLeaves(masked, () => value);
    mergePatch(masked);
    stopPeeking();
  }
});

// src/plugins/actions/toggleAll.ts
action({
  name: "toggleAll",
  apply(_, filter) {
    startPeeking();
    const masked = filtered(filter);
    updateLeaves(masked, (oldValue) => !oldValue);
    mergePatch(masked);
    stopPeeking();
  }
});

// src/plugins/actions/fetch.ts
var abortControllers = /* @__PURE__ */ new WeakMap();
var methodSupportsRequestBody = (method) => !["GET", "DELETE"].includes(method);
var createHttpMethod = (name, method, openWhenHiddenDefault = true) => action({
  name,
  apply: async ({ el, evt, error: error2, cleanups }, url2, {
    selector,
    headers: userHeaders,
    contentType = "json",
    filterSignals: { include = /.*/, exclude = /(^|\.)_/ } = {},
    openWhenHidden = openWhenHiddenDefault,
    payload,
    requestCancellation = "auto",
    retry = "auto",
    retryInterval = 1e3,
    retryScaler = 2,
    retryMaxWait = 3e4,
    retryMaxCount = 10
  } = {}) => {
    const controller = requestCancellation instanceof AbortController ? requestCancellation : new AbortController();
    if (requestCancellation === "auto" || requestCancellation === "cleanup") {
      abortControllers.get(el)?.abort();
      abortControllers.set(el, controller);
    }
    if (requestCancellation === "cleanup") {
      cleanups.get(`@${name}`)?.();
      cleanups.set(`@${name}`, async () => {
        controller.abort();
        await Promise.resolve();
      });
    }
    let cleanupFn = () => {
    };
    try {
      if (!url2?.length) {
        throw error2("FetchNoUrlProvided", { action });
      }
      const initialHeaders = {
        Accept: "text/event-stream, text/html, application/json",
        "Datastar-Request": true
      };
      if (contentType === "json" && methodSupportsRequestBody(method)) {
        initialHeaders["Content-Type"] = "application/json";
      }
      const headers = Object.assign({}, initialHeaders, userHeaders);
      const req = {
        input: "",
        method,
        headers,
        openWhenHidden,
        retry,
        retryInterval,
        retryScaler,
        retryMaxWait,
        retryMaxCount,
        signal: controller.signal,
        onopen: async (response) => {
          if (response.status >= 400)
            dispatchFetch(ERROR, el, { status: response.status.toString() });
        },
        onmessage: (evt2) => {
          if (!evt2.event.startsWith("datastar")) return;
          const type = evt2.event;
          const argsRawLines = {};
          for (const line of evt2.data.split("\n")) {
            const i = line.indexOf(" ");
            const k = line.slice(0, i);
            const v = line.slice(i + 1);
            (argsRawLines[k] ||= []).push(v);
          }
          const argsRaw = Object.fromEntries(
            Object.entries(argsRawLines).map(([k, v]) => [k, v.join("\n")])
          );
          dispatchFetch(type, el, argsRaw);
        },
        onerror: (error3) => {
          if (isWrongContent(error3)) {
            throw error3("FetchExpectedTextEventStream", { url: url2 });
          }
          if (error3) {
            console.error(error3.message);
            dispatchFetch(RETRYING, el, { message: error3.message });
          }
        }
      };
      const buildFetchEventSourceInit = () => {
        const urlInstance = new URL(url2, document.baseURI);
        const queryParams = new URLSearchParams(urlInstance.search);
        if (contentType === "json") {
          startPeeking();
          const requestPayload = payload !== void 0 ? payload : filtered({ include, exclude });
          stopPeeking();
          const body = JSON.stringify(requestPayload);
          if (methodSupportsRequestBody(method)) {
            req.body = body;
          } else {
            queryParams.set("datastar", body);
          }
        } else if (contentType === "form") {
          const formEl = selector ? document.querySelector(selector) : el.closest("form");
          if (!formEl) {
            throw error2("FetchFormNotFound", { action, selector });
          }
          if (!formEl.noValidate && !formEl.checkValidity()) {
            formEl.reportValidity();
            return;
          }
          const formData = new FormData(formEl);
          let submitter = el;
          if (el === formEl && evt instanceof SubmitEvent) {
            submitter = evt.submitter;
          } else {
            const preventDefault = (evt2) => evt2.preventDefault();
            formEl.addEventListener("submit", preventDefault);
            cleanupFn = () => {
              formEl.removeEventListener("submit", preventDefault);
            };
          }
          if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement && submitter.type === "submit") {
            const name2 = submitter.getAttribute("name");
            if (name2) formData.append(name2, submitter.value);
          }
          const multipart = formEl.getAttribute("enctype") === "multipart/form-data";
          if (!multipart) {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
          }
          const formParams = new URLSearchParams(formData);
          if (methodSupportsRequestBody(method)) {
            if (multipart) {
              req.body = formData;
            } else {
              req.body = formParams;
            }
          } else {
            for (const [key, value] of formParams) {
              queryParams.append(key, value);
            }
          }
        } else {
          throw error2("FetchInvalidContentType", { action, contentType });
        }
        urlInstance.search = queryParams.toString();
        req.input = urlInstance.toString();
        return req;
      };
      dispatchFetch(STARTED, el, {});
      try {
        await fetchEventSource(el, buildFetchEventSourceInit);
      } catch (e) {
        if (!isWrongContent(e)) {
          throw error2("FetchFailed", { method, url: url2, error: e.message });
        }
      }
    } finally {
      dispatchFetch(FINISHED, el, {});
      cleanupFn();
      cleanups.delete(`@${name}`);
    }
  }
});
createHttpMethod("get", "GET", false);
createHttpMethod("patch", "PATCH");
createHttpMethod("post", "POST");
createHttpMethod("put", "PUT");
createHttpMethod("delete", "DELETE");
var STARTED = "started";
var FINISHED = "finished";
var ERROR = "error";
var RETRYING = "retrying";
var RETRIES_FAILED = "retries-failed";
var dispatchFetch = (type, el, argsRaw) => document.dispatchEvent(
  new CustomEvent(DATASTAR_FETCH_EVENT, {
    detail: { type, el, argsRaw }
  })
);
var isWrongContent = (err) => `${err}`.includes("text/event-stream");
var getBytes = async (stream, onChunk) => {
  const reader = stream.getReader();
  let result = await reader.read();
  while (!result.done) {
    onChunk(result.value);
    result = await reader.read();
  }
};
var getLines = (onLine) => {
  let buffer;
  let position;
  let fieldLength;
  let discardTrailingNewline = false;
  return (arr) => {
    if (!buffer) {
      buffer = arr;
      position = 0;
      fieldLength = -1;
    } else {
      buffer = concat(buffer, arr);
    }
    const bufLength = buffer.length;
    let lineStart = 0;
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === 10) lineStart = ++position;
        discardTrailingNewline = false;
      }
      let lineEnd = -1;
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case 58:
            if (fieldLength === -1) {
              fieldLength = position - lineStart;
            }
            break;
          // @ts-expect-error:7029 \r case below should fallthrough to \n:
          // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional fallthrough for CR to LF
          case 13:
            discardTrailingNewline = true;
          case 10:
            lineEnd = position;
            break;
        }
      }
      if (lineEnd === -1) break;
      onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
      lineStart = position;
      fieldLength = -1;
    }
    if (lineStart === bufLength)
      buffer = void 0;
    else if (lineStart) {
      buffer = buffer.subarray(lineStart);
      position -= lineStart;
    }
  };
};
var getMessages = (onId, onRetry, onMessage) => {
  let message = newMessage();
  const decoder = new TextDecoder();
  return (line, fieldLength) => {
    if (!line.length) {
      onMessage?.(message);
      message = newMessage();
    } else if (fieldLength > 0) {
      const field = decoder.decode(line.subarray(0, fieldLength));
      const valueOffset = fieldLength + (line[fieldLength + 1] === 32 ? 2 : 1);
      const value = decoder.decode(line.subarray(valueOffset));
      switch (field) {
        case "data":
          message.data = message.data ? `${message.data}
${value}` : value;
          break;
        case "event":
          message.event = value;
          break;
        case "id":
          onId(message.id = value);
          break;
        case "retry": {
          const retry = +value;
          if (!Number.isNaN(retry)) {
            onRetry(message.retry = retry);
          }
          break;
        }
      }
    }
  };
};
var concat = (a, b) => {
  const res = new Uint8Array(a.length + b.length);
  res.set(a);
  res.set(b, a.length);
  return res;
};
var newMessage = () => ({
  // data, event, and id must be initialized to empty strings:
  // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
  // retry should be initialized to undefined so we return a consistent shape
  // to the js engine all the time: https://mathiasbynens.be/notes/shapes-ics#takeaways
  data: "",
  event: "",
  id: "",
  retry: void 0
});
var fetchEventSource = (el, buildFetchEventSourceInit) => {
  return new Promise((resolve, reject) => {
    const fetchInit = buildFetchEventSourceInit();
    if (!fetchInit) {
      return;
    }
    let {
      input,
      signal: inputSignal,
      headers: inputHeaders,
      onopen: inputOnOpen,
      onmessage,
      onclose,
      onerror,
      openWhenHidden,
      fetch: inputFetch,
      retry = "auto",
      retryInterval = 1e3,
      retryScaler = 2,
      retryMaxWait = 3e4,
      retryMaxCount = 10,
      responseOverrides,
      ...rest
    } = fetchInit;
    const headers = {
      ...inputHeaders
    };
    let curRequestController;
    const onVisibilityChange = () => {
      curRequestController.abort();
      if (!document.hidden) {
        const currentFetchInit = buildFetchEventSourceInit();
        if (!currentFetchInit) return;
        input = currentFetchInit.input;
        rest.body = currentFetchInit.body;
        create();
      }
    };
    if (!openWhenHidden) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    let retryTimer;
    const dispose = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(retryTimer);
      curRequestController.abort();
    };
    inputSignal?.addEventListener("abort", () => {
      dispose();
      resolve();
    });
    const fetch = inputFetch || window.fetch;
    const onopen = inputOnOpen || (() => {
    });
    let retries = 0;
    let baseRetryInterval = retryInterval;
    const create = async () => {
      curRequestController = new AbortController();
      const curRequestSignal = curRequestController.signal;
      try {
        const response = await fetch(input, {
          ...rest,
          headers,
          signal: curRequestSignal
        });
        await onopen(response);
        const dispatchNonSSE = async (dispatchType, response2, name, responseOverrides2, ...argNames) => {
          const argsRaw = {
            [name]: await response2.text()
          };
          for (const n of argNames) {
            let v = response2.headers.get(`datastar-${kebab(n)}`);
            if (responseOverrides2) {
              const o = responseOverrides2[n];
              if (o) v = typeof o === "string" ? o : JSON.stringify(o);
            }
            if (v) argsRaw[n] = v;
          }
          dispatchFetch(dispatchType, el, argsRaw);
          dispose();
          resolve();
        };
        const status = response.status;
        const isNoContentStatus = status === 204;
        const isRedirectStatus = status >= 300 && status < 400;
        const isErrorStatus = status >= 400 && status < 600;
        if (status !== 200) {
          onclose?.();
          if (retry !== "never" && !isNoContentStatus && !isRedirectStatus && (retry === "always" || retry === "error" && isErrorStatus)) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(create, retryInterval);
            return;
          }
          dispose();
          resolve();
          return;
        }
        retries = 0;
        retryInterval = baseRetryInterval;
        const ct = response.headers.get("Content-Type");
        if (ct?.includes("text/html")) {
          return await dispatchNonSSE(
            "datastar-patch-elements",
            response,
            "elements",
            responseOverrides,
            "selector",
            "mode",
            "namespace",
            "useViewTransition"
          );
        }
        if (ct?.includes("application/json")) {
          return await dispatchNonSSE(
            "datastar-patch-signals",
            response,
            "signals",
            responseOverrides,
            "onlyIfMissing"
          );
        }
        if (ct?.includes("text/javascript")) {
          const script = document.createElement("script");
          const scriptAttributesHeader = response.headers.get(
            "datastar-script-attributes"
          );
          if (scriptAttributesHeader) {
            for (const [name, value] of Object.entries(
              JSON.parse(scriptAttributesHeader)
            )) {
              script.setAttribute(name, value);
            }
          }
          script.textContent = await response.text();
          document.head.appendChild(script);
          dispose();
          return;
        }
        await getBytes(
          response.body,
          getLines(
            getMessages(
              (id) => {
                if (id) {
                  headers["last-event-id"] = id;
                } else {
                  delete headers["last-event-id"];
                }
              },
              (retry2) => {
                baseRetryInterval = retryInterval = retry2;
              },
              onmessage
            )
          )
        );
        onclose?.();
        if (retry === "always" && !isRedirectStatus) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(create, retryInterval);
          return;
        }
        dispose();
        resolve();
      } catch (err) {
        if (!curRequestSignal.aborted) {
          try {
            const interval = onerror?.(err) || retryInterval;
            clearTimeout(retryTimer);
            retryTimer = setTimeout(create, interval);
            retryInterval = Math.min(
              retryInterval * retryScaler,
              retryMaxWait
            );
            if (++retries >= retryMaxCount) {
              dispatchFetch(RETRIES_FAILED, el, {});
              dispose();
              reject("Max retries reached.");
            } else {
              console.error(
                `Datastar failed to reach ${input.toString()} retrying in ${interval}ms.`
              );
            }
          } catch (innerErr) {
            dispose();
            reject(innerErr);
          }
        }
      }
    };
    create();
  });
};

// src/plugins/attributes/attr.ts
attribute({
  name: "attr",
  requirement: { value: "must" },
  returnsValue: true,
  apply({ el, key, rx }) {
    const syncAttr = (key2, val) => {
      if (val === "" || val === true) {
        el.setAttribute(key2, "");
      } else if (val === false || val == null) {
        el.removeAttribute(key2);
      } else if (typeof val === "string") {
        el.setAttribute(key2, val);
      } else if (typeof val === "function") {
        el.setAttribute(key2, val.toString());
      } else {
        el.setAttribute(
          key2,
          JSON.stringify(
            val,
            (_k, v) => typeof v === "function" ? v.toString() : v
          )
        );
      }
    };
    const update2 = key ? () => {
      observer.disconnect();
      const val = rx();
      syncAttr(key, val);
      observer.observe(el, {
        attributeFilter: [key]
      });
    } : () => {
      observer.disconnect();
      const obj = rx();
      const attributeFilter = Object.keys(obj);
      for (const key2 of attributeFilter) {
        syncAttr(key2, obj[key2]);
      }
      observer.observe(el, {
        attributeFilter
      });
    };
    const observer = new MutationObserver(update2);
    const cleanup = effect(update2);
    return () => {
      observer.disconnect();
      cleanup();
    };
  }
});

// src/plugins/attributes/bind.ts
var propAdapter = (prop, ...events) => ({
  get: (el) => el[prop],
  set: (el, value) => {
    el[prop] = value;
  },
  events
});
var attrAdapter = (attr, ...events) => ({
  get: (el) => el.getAttribute(attr),
  set: (el, value) => {
    el.setAttribute(attr, `${value}`);
  },
  events
});
var valueAdapter = (treatUndefinedAsString = false, ...events) => ({
  get: (el, type) => type === "string" || treatUndefinedAsString && type === "undefined" ? el.value : +el.value,
  set: (el, value) => {
    el.value = `${value}`;
  },
  events
});
var dataURIRegex = /^data:(?<mime>[^;]+);base64,(?<contents>.*)$/;
var empty = /* @__PURE__ */ Symbol("empty");
var aliasedBind = aliasify("bind");
var boundPath = (el, key, value, signalName, adapter, initialValue) => {
  if (initialValue === void 0 && el instanceof HTMLInputElement && el.type === "radio") {
    const signalNameKebab2 = key ? key : value;
    const checked = [
      ...document.querySelectorAll(
        `[${aliasedBind}\\:${CSS.escape(signalNameKebab2)}],[${aliasedBind}="${CSS.escape(signalNameKebab2)}"]`
      )
    ].find(
      (input) => input instanceof HTMLInputElement && input.checked
    );
    if (checked) {
      mergePaths([[signalName, checked.value]], { ifMissing: true });
    }
  }
  if (!Array.isArray(initialValue) || el instanceof HTMLSelectElement && el.multiple) {
    mergePaths([[signalName, adapter.get(el, typeof initialValue)]], {
      ifMissing: true
    });
    return signalName;
  }
  const signalNameKebab = key ? key : value;
  const inputs = document.querySelectorAll(
    `[${aliasedBind}\\:${CSS.escape(signalNameKebab)}],[${aliasedBind}="${CSS.escape(signalNameKebab)}"]`
  );
  const paths = [];
  let i = 0;
  for (const input of inputs) {
    paths.push([
      `${signalName}.${i}`,
      adapter.get(
        input,
        typeof (hasOwn(initialValue, i) ? initialValue[i] : void 0)
      )
    ]);
    if (el === input) {
      break;
    }
    i++;
  }
  mergePaths(paths, { ifMissing: true });
  return `${signalName}.${i}`;
};
attribute({
  name: "bind",
  requirement: "exclusive",
  apply({ el, key, mods, value, error: error2 }) {
    const signalName = key != null ? modifyCasing(key, mods) : value;
    const props = mods.get("prop");
    const events = mods.get("event");
    let adapter = null;
    if (el instanceof HTMLInputElement) {
      switch (el.type) {
        case "range":
        case "number":
          adapter = valueAdapter(false, "input");
          break;
        case "checkbox":
          adapter = {
            get: (el2, type) => {
              if (el2.value !== "on") {
                return type === "boolean" ? el2.checked : el2.checked ? el2.value : "";
              }
              return type === "string" ? el2.checked ? el2.value : "" : el2.checked;
            },
            set: (el2, value2) => {
              el2.checked = typeof value2 === "string" ? value2 === el2.value : value2;
            },
            events: ["change"]
          };
          break;
        case "radio":
          if (!el.getAttribute("name")?.length) {
            el.setAttribute("name", signalName);
          }
          adapter = {
            get: (el2, type) => el2.checked ? type === "number" ? +el2.value : el2.value : empty,
            set: (el2, value2) => {
              el2.checked = value2 === (typeof value2 === "number" ? +el2.value : el2.value);
            },
            events: ["change"]
          };
          break;
        case "file": {
          const syncSignal2 = () => {
            const files = [...el.files || []];
            const signalFiles = [];
            Promise.all(
              files.map(
                (f) => new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result !== "string") {
                      throw error2("InvalidFileResultType", {
                        resultType: typeof reader.result
                      });
                    }
                    const match = reader.result.match(dataURIRegex);
                    if (!match?.groups) {
                      throw error2("InvalidDataUri", {
                        result: reader.result
                      });
                    }
                    signalFiles.push({
                      name: f.name,
                      contents: match.groups.contents,
                      mime: match.groups.mime
                    });
                  };
                  reader.onloadend = () => resolve();
                  reader.readAsDataURL(f);
                })
              )
            ).then(() => {
              mergePaths([[signalName, signalFiles]]);
            });
          };
          el.addEventListener("change", syncSignal2);
          return () => {
            el.removeEventListener("change", syncSignal2);
          };
        }
        default:
          adapter = valueAdapter(true, "input");
      }
    } else if (el instanceof HTMLSelectElement && el.multiple) {
      const typeMap = /* @__PURE__ */ new Map();
      adapter = {
        get: (el2) => [...el2.selectedOptions].map((option) => {
          const type = typeMap.get(option.value);
          return type === "string" || type == null ? option.value : +option.value;
        }),
        set: (el2, value2) => {
          for (const option of el2.options) {
            if (value2.includes(option.value)) {
              typeMap.set(option.value, "string");
              option.selected = true;
            } else if (value2.includes(+option.value)) {
              typeMap.set(option.value, "number");
              option.selected = true;
            } else {
              option.selected = false;
            }
          }
        },
        events: ["change"]
      };
    } else if (el instanceof HTMLSelectElement) {
      adapter = valueAdapter(true, "change");
    } else if (el instanceof HTMLTextAreaElement) {
      adapter = propAdapter("value", "input");
    } else if (el instanceof HTMLElement && el.tagName.includes("-")) {
      adapter = "value" in el ? propAdapter("value", "input", "change") : attrAdapter("value", "input", "change");
    } else if (el instanceof HTMLElement && "value" in el) {
      adapter = propAdapter("value", "change");
    } else {
      adapter = attrAdapter("value", "change");
    }
    if (!adapter) {
      throw error2("InvalidBindAdapter");
    }
    const firstProp = props && [...props][0];
    if (props && !firstProp) throw error2("BindPropNameMissing");
    if (firstProp) {
      const prop = camel(firstProp);
      adapter = propAdapter(prop, ...events ? [...events] : adapter.events);
    } else if (events) {
      adapter.events = [...events];
    }
    const initialValue = getPath(signalName);
    const path = boundPath(el, key, value, signalName, adapter, initialValue);
    const syncSignal = () => {
      const signalValue = getPath(path);
      if (signalValue != null) {
        const value2 = adapter.get(el, typeof signalValue);
        if (value2 !== empty) {
          mergePaths([[path, value2]]);
        }
      }
    };
    for (const eventName of adapter.events) {
      el.addEventListener(eventName, syncSignal);
    }
    el.addEventListener(DATASTAR_PROP_CHANGE_EVENT, syncSignal);
    const cleanup = effect(() => {
      adapter.set(el, getPath(path));
    });
    return () => {
      cleanup();
      for (const eventName of adapter.events) {
        el.removeEventListener(eventName, syncSignal);
      }
      el.removeEventListener(DATASTAR_PROP_CHANGE_EVENT, syncSignal);
    };
  }
});

// src/plugins/attributes/class.ts
attribute({
  name: "class",
  requirement: {
    value: "must"
  },
  returnsValue: true,
  apply({ key, el, mods, rx }) {
    key &&= modifyCasing(key, mods, "kebab");
    let classes;
    const callback = () => {
      observer.disconnect();
      classes = key ? { [key]: rx() } : rx();
      for (const k in classes) {
        const classNames = k.split(/\s+/).filter((cn) => cn.length > 0);
        if (classes[k]) {
          for (const name of classNames) {
            if (!el.classList.contains(name)) {
              el.classList.add(name);
            }
          }
        } else {
          for (const name of classNames) {
            if (el.classList.contains(name)) {
              el.classList.remove(name);
            }
          }
        }
      }
      observer.observe(el, { attributeFilter: ["class"] });
    };
    const observer = new MutationObserver(callback);
    const cleanup = effect(callback);
    return () => {
      observer.disconnect();
      cleanup();
      for (const k in classes) {
        const classNames = k.split(/\s+/).filter((cn) => cn.length > 0);
        for (const name of classNames) {
          el.classList.remove(name);
        }
      }
    };
  }
});

// src/plugins/attributes/computed.ts
attribute({
  name: "computed",
  requirement: {
    value: "must"
  },
  returnsValue: true,
  apply({ key, mods, rx, error: error2 }) {
    if (key) {
      mergePaths([[modifyCasing(key, mods), computed(rx)]]);
    } else {
      const patch = Object.assign({}, rx());
      updateLeaves(patch, (old) => {
        if (typeof old === "function") {
          return computed(old);
        } else {
          throw error2("ComputedExpectedFunction");
        }
      });
      mergePatch(patch);
    }
  }
});

// src/plugins/attributes/effect.ts
attribute({
  name: "effect",
  requirement: {
    key: "denied",
    value: "must"
  },
  apply: ({ rx }) => effect(rx)
});

// src/plugins/attributes/indicator.ts
attribute({
  name: "indicator",
  requirement: "exclusive",
  apply({ el, key, mods, value }) {
    const signalName = key != null ? modifyCasing(key, mods) : value;
    let activeFetches = 0;
    mergePaths([[signalName, false]]);
    const watcher2 = ((event) => {
      const { type, el: elt } = event.detail;
      if (elt !== el) {
        return;
      }
      switch (type) {
        case STARTED:
          activeFetches++;
          mergePaths([[signalName, true]]);
          break;
        case FINISHED:
          activeFetches = Math.max(0, activeFetches - 1);
          mergePaths([[signalName, activeFetches > 0]]);
          break;
      }
    });
    document.addEventListener(DATASTAR_FETCH_EVENT, watcher2);
    return () => {
      activeFetches = 0;
      mergePaths([[signalName, false]]);
      document.removeEventListener(DATASTAR_FETCH_EVENT, watcher2);
    };
  }
});

// src/utils/tags.ts
var tagToMs = (args) => {
  if (!args || args.size <= 0) return 0;
  for (const arg of args) {
    if (arg.endsWith("ms")) {
      return +arg.replace("ms", "");
    }
    if (arg.endsWith("s")) {
      return +arg.replace("s", "") * 1e3;
    }
    try {
      return Number.parseFloat(arg);
    } catch (_) {
    }
  }
  return 0;
};
var tagHas = (tags, tag, defaultValue = false) => {
  if (!tags) return defaultValue;
  return tags.has(tag.toLowerCase());
};
var tagFirst = (tags, defaultValue = "") => {
  if (tags && tags.size > 0) {
    for (const tag of tags) {
      return tag;
    }
  }
  return defaultValue;
};

// src/utils/timing.ts
var delay = (callback, wait) => {
  return (...args) => {
    setTimeout(() => {
      callback(...args);
    }, wait);
  };
};
var throttle = (callback, wait, leading = true, trailing = false, debounce = false) => {
  let lastArgs = null;
  let timer = 0;
  return (...args) => {
    if (leading && !timer) {
      callback(...args);
      lastArgs = null;
    } else {
      lastArgs = args;
    }
    if (!timer || debounce) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        if (trailing && lastArgs !== null) {
          callback(...lastArgs);
        }
        lastArgs = null;
        timer = 0;
      }, wait);
    }
  };
};
var modifyTiming = (callback, mods) => {
  const delayArgs = mods.get("delay");
  if (delayArgs) {
    const wait = tagToMs(delayArgs);
    callback = delay(callback, wait);
  }
  const debounceArgs = mods.get("debounce");
  if (debounceArgs) {
    const wait = tagToMs(debounceArgs);
    const leading = tagHas(debounceArgs, "leading", false);
    const trailing = !tagHas(debounceArgs, "notrailing", false);
    callback = throttle(callback, wait, leading, trailing, true);
  }
  const throttleArgs = mods.get("throttle");
  if (throttleArgs) {
    const wait = tagToMs(throttleArgs);
    const leading = !tagHas(throttleArgs, "noleading", false);
    const trailing = tagHas(throttleArgs, "trailing", false);
    callback = throttle(callback, wait, leading, trailing);
  }
  return callback;
};

// src/utils/view-transitions.ts
var supportsViewTransitions = !!document.startViewTransition;
var modifyViewTransition = (callback, mods) => {
  if (mods.has("viewtransition") && supportsViewTransitions) {
    const cb = callback;
    callback = (...args) => document.startViewTransition(() => cb(...args));
  }
  return callback;
};

// src/plugins/attributes/init.ts
attribute({
  name: "init",
  requirement: {
    key: "denied",
    value: "must"
  },
  apply({ rx, mods }) {
    let callback = () => {
      beginBatch();
      rx();
      endBatch();
    };
    callback = modifyViewTransition(callback, mods);
    let wait = 0;
    const delayArgs = mods.get("delay");
    if (delayArgs) {
      wait = tagToMs(delayArgs);
      if (wait > 0) {
        callback = delay(callback, wait);
      }
    }
    callback();
  }
});

// src/plugins/attributes/jsonSignals.ts
attribute({
  name: "json-signals",
  requirement: {
    key: "denied"
  },
  apply({ el, value, mods }) {
    const spaces = mods.has("terse") ? 0 : 2;
    let filters = {};
    if (value) {
      filters = jsStrToObject(value);
    }
    const callback = () => {
      observer.disconnect();
      el.textContent = JSON.stringify(filtered(filters), null, spaces);
      observer.observe(el, {
        childList: true,
        characterData: true,
        subtree: true
      });
    };
    const observer = new MutationObserver(callback);
    const cleanup = effect(callback);
    return () => {
      observer.disconnect();
      cleanup();
    };
  }
});

// src/plugins/attributes/on.ts
attribute({
  name: "on",
  requirement: "must",
  argNames: ["evt"],
  apply({ el, key, mods, rx }) {
    let target = el;
    if (mods.has("window")) {
      target = window;
    } else if (mods.has("document")) {
      target = document;
    }
    let callback = (evt) => {
      beginBatch();
      rx(evt);
      endBatch();
    };
    callback = modifyViewTransition(callback, mods);
    callback = modifyTiming(callback, mods);
    const eventName = modifyCasing(key, mods, "kebab");
    const evtListOpts = {
      capture: mods.has("capture"),
      passive: mods.has("passive"),
      once: mods.has("once")
    };
    if (mods.has("outside")) {
      target = document;
      const cb = callback;
      callback = (evt) => {
        if (!el.contains(evt?.target)) {
          cb(evt);
        }
      };
    }
    if (eventName === DATASTAR_FETCH_EVENT || eventName === DATASTAR_SIGNAL_PATCH_EVENT) {
      target = document;
    }
    const listener = (evt) => {
      if (evt) {
        if (mods.has("prevent")) evt.preventDefault();
        if (mods.has("stop")) evt.stopPropagation();
        if (el instanceof HTMLFormElement && eventName === "submit") evt.preventDefault();
      }
      callback(evt);
    };
    target.addEventListener(eventName, listener, evtListOpts);
    return () => {
      target.removeEventListener(eventName, listener, evtListOpts);
    };
  }
});

// src/utils/math.ts
var clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

// src/plugins/attributes/onIntersect.ts
var once = /* @__PURE__ */ new WeakSet();
attribute({
  name: "on-intersect",
  requirement: {
    key: "denied",
    value: "must"
  },
  apply({ el, mods, rx }) {
    let callback = () => {
      beginBatch();
      rx();
      endBatch();
    };
    callback = modifyViewTransition(callback, mods);
    callback = modifyTiming(callback, mods);
    const options = { threshold: 0 };
    if (mods.has("full")) {
      options.threshold = 1;
    } else if (mods.has("half")) {
      options.threshold = 0.5;
    } else {
      const threshold = mods.get("threshold");
      if (threshold) {
        options.threshold = clamp(Number(tagFirst(threshold)), 0, 100) / 100;
      }
    }
    const exit = mods.has("exit");
    let observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting !== exit) {
            callback();
            if (observer && once.has(el)) {
              observer.disconnect();
            }
          }
        }
      },
      options
    );
    observer.observe(el);
    if (mods.has("once")) {
      once.add(el);
    }
    return () => {
      if (!mods.has("once")) {
        once.delete(el);
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  }
});

// src/plugins/attributes/onInterval.ts
attribute({
  name: "on-interval",
  requirement: {
    key: "denied",
    value: "must"
  },
  apply({ mods, rx }) {
    let callback = () => {
      beginBatch();
      rx();
      endBatch();
    };
    callback = modifyViewTransition(callback, mods);
    let duration = 1e3;
    const durationArgs = mods.get("duration");
    if (durationArgs) {
      duration = tagToMs(durationArgs);
      const leading = tagHas(durationArgs, "leading", false);
      if (leading) {
        callback();
      }
    }
    const intervalId = setInterval(callback, duration);
    return () => {
      clearInterval(intervalId);
    };
  }
});

// src/plugins/attributes/onSignalPatch.ts
attribute({
  name: "on-signal-patch",
  requirement: {
    value: "must"
  },
  argNames: ["patch"],
  returnsValue: true,
  apply({ el, key, mods, rx, error: error2 }) {
    if (!!key && key !== "filter") {
      throw error2("KeyNotAllowed");
    }
    const filterAttr = aliasify(`${this.name}-filter`);
    const filtersRaw = el.getAttribute(filterAttr);
    let filters = {};
    if (filtersRaw) {
      filters = jsStrToObject(filtersRaw);
    }
    let running = false;
    const callback = modifyTiming(
      (evt) => {
        if (running) return;
        const watched = filtered(filters, evt.detail);
        if (!isEmpty(watched)) {
          running = true;
          beginBatch();
          try {
            rx(watched);
          } finally {
            endBatch();
            running = false;
          }
        }
      },
      mods
    );
    document.addEventListener(DATASTAR_SIGNAL_PATCH_EVENT, callback);
    return () => {
      document.removeEventListener(DATASTAR_SIGNAL_PATCH_EVENT, callback);
    };
  }
});

// src/plugins/attributes/ref.ts
attribute({
  name: "ref",
  requirement: "exclusive",
  apply({ el, key, mods, value }) {
    const signalName = key != null ? modifyCasing(key, mods) : value;
    mergePaths([[signalName, el]]);
  }
});

// src/plugins/attributes/show.ts
var NONE = "none";
var DISPLAY = "display";
attribute({
  name: "show",
  requirement: {
    key: "denied",
    value: "must"
  },
  returnsValue: true,
  apply({ el, rx }) {
    const update2 = () => {
      observer.disconnect();
      const shouldShow = rx();
      if (shouldShow) {
        if (el.style.display === NONE) el.style.removeProperty(DISPLAY);
      } else {
        el.style.setProperty(DISPLAY, NONE);
      }
      observer.observe(el, { attributeFilter: ["style"] });
    };
    const observer = new MutationObserver(update2);
    const cleanup = effect(update2);
    return () => {
      observer.disconnect();
      cleanup();
    };
  }
});

// src/plugins/attributes/signals.ts
attribute({
  name: "signals",
  returnsValue: true,
  apply({ key, mods, rx }) {
    const ifMissing = mods.has("ifmissing");
    if (key) {
      key = modifyCasing(key, mods);
      const value = rx?.();
      mergePaths([[key, value]], { ifMissing });
    } else {
      const patch = Object.assign({}, rx?.());
      mergePatch(patch, { ifMissing });
    }
  }
});

// src/plugins/attributes/style.ts
attribute({
  name: "style",
  requirement: {
    value: "must"
  },
  returnsValue: true,
  apply({ key, el, rx }) {
    const { style } = el;
    const initialStyles = /* @__PURE__ */ new Map();
    const apply = (prop, value) => {
      const initial = initialStyles.get(prop);
      if (!value && value !== 0) {
        initial !== void 0 && (initial ? style.setProperty(prop, initial) : style.removeProperty(prop));
      } else {
        initial === void 0 && initialStyles.set(prop, style.getPropertyValue(prop));
        style.setProperty(prop, String(value));
      }
    };
    const update2 = () => {
      observer.disconnect();
      if (key) {
        apply(key, rx());
      } else {
        const styles = rx();
        for (const [prop, initial] of initialStyles) {
          prop in styles || (initial ? style.setProperty(prop, initial) : style.removeProperty(prop));
        }
        for (const prop in styles) {
          apply(kebab(prop), styles[prop]);
        }
      }
      observer.observe(el, { attributeFilter: ["style"] });
    };
    const observer = new MutationObserver(update2);
    const cleanup = effect(update2);
    return () => {
      observer.disconnect();
      cleanup();
      for (const [prop, initial] of initialStyles) {
        initial ? style.setProperty(prop, initial) : style.removeProperty(prop);
      }
    };
  }
});

// src/plugins/attributes/text.ts
attribute({
  name: "text",
  requirement: {
    key: "denied",
    value: "must"
  },
  returnsValue: true,
  apply({ el, rx }) {
    const update2 = () => {
      observer.disconnect();
      el.textContent = `${rx()}`;
      observer.observe(el, {
        childList: true,
        characterData: true,
        subtree: true
      });
    };
    const observer = new MutationObserver(update2);
    const cleanup = effect(update2);
    return () => {
      observer.disconnect();
      cleanup();
    };
  }
});

// src/plugins/watchers/patchElements.ts
var isValidType = (arr, value) => arr.includes(value);
var PATCH_MODES = [
  "remove",
  "outer",
  "inner",
  "replace",
  "prepend",
  "append",
  "before",
  "after"
];
var NAMESPACES = ["html", "svg", "mathml"];
watcher({
  name: "datastar-patch-elements",
  apply(ctx, args) {
    const selector = typeof args.selector === "string" ? args.selector : "";
    const mode = typeof args.mode === "string" ? args.mode : "outer";
    const namespace = typeof args.namespace === "string" ? args.namespace : "html";
    const useViewTransitionRaw = typeof args.useViewTransition === "string" ? args.useViewTransition : "";
    const elements = args.elements;
    if (!isValidType(PATCH_MODES, mode)) {
      throw ctx.error("PatchElementsInvalidMode", { mode });
    }
    if (!selector && mode !== "outer" && mode !== "replace") {
      throw ctx.error("PatchElementsExpectedSelector");
    }
    if (!isValidType(NAMESPACES, namespace)) {
      throw ctx.error("PatchElementsInvalidNamespace", { namespace });
    }
    const args2 = {
      selector,
      mode,
      namespace,
      useViewTransition: useViewTransitionRaw.trim() === "true",
      elements
    };
    if (supportsViewTransitions && args2.useViewTransition) {
      document.startViewTransition(() => onPatchElements(ctx, args2));
    } else {
      onPatchElements(ctx, args2);
    }
  }
});
var onPatchElements = ({ error: error2 }, { selector, mode, namespace, elements }) => {
  let newContent = document.createDocumentFragment();
  const consume = typeof elements !== "string" && !!elements;
  if (typeof elements === "string") {
    const elementsWithSvgsRemoved = elements.replace(
      /<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,
      ""
    );
    const hasHtml = /<\/html>/.test(elementsWithSvgsRemoved);
    const hasHead = /<\/head>/.test(elementsWithSvgsRemoved);
    const hasBody = /<\/body>/.test(elementsWithSvgsRemoved);
    const wrapperTag = namespace === "svg" ? "svg" : namespace === "mathml" ? "math" : "";
    const wrappedEls = wrapperTag ? `<${wrapperTag}>${elements}</${wrapperTag}>` : elements;
    const newDocument = new DOMParser().parseFromString(
      hasHtml || hasHead || hasBody ? elements : `<body><template>${wrappedEls}</template></body>`,
      "text/html"
    );
    if (hasHtml) {
      newContent.appendChild(newDocument.documentElement);
    } else if (hasHead && hasBody) {
      newContent.appendChild(newDocument.head);
      newContent.appendChild(newDocument.body);
    } else if (hasHead) {
      newContent.appendChild(newDocument.head);
    } else if (hasBody) {
      newContent.appendChild(newDocument.body);
    } else if (wrapperTag) {
      const wrapperEl = newDocument.querySelector("template").content.querySelector(wrapperTag);
      for (const child of wrapperEl.childNodes) {
        newContent.appendChild(child);
      }
    } else {
      newContent = newDocument.querySelector("template").content;
    }
  } else if (elements) {
    if (elements instanceof DocumentFragment) {
      newContent = elements;
    } else if (elements instanceof Element) {
      newContent.appendChild(elements);
    }
  }
  if (!selector && (mode === "outer" || mode === "replace")) {
    const children = Array.from(newContent.children);
    for (const child of children) {
      let target;
      if (child instanceof HTMLHtmlElement) {
        target = document.documentElement;
      } else if (child instanceof HTMLBodyElement) {
        target = document.body;
      } else if (child instanceof HTMLHeadElement) {
        target = document.head;
      } else {
        target = document.getElementById(child.id);
        if (!target) {
          console.warn(error2("PatchElementsNoTargetsFound"), {
            element: { id: child.id }
          });
          continue;
        }
      }
      applyToTargets(mode, child, [target], consume);
    }
  } else {
    const targets = document.querySelectorAll(selector);
    if (!targets.length) {
      console.warn(error2("PatchElementsNoTargetsFound"), { selector });
      return;
    }
    const targetList = consume && mode !== "remove" ? [targets[0]] : targets;
    applyToTargets(mode, newContent, targetList, consume);
  }
};
var scripts = /* @__PURE__ */ new WeakSet();
for (const script of document.querySelectorAll("script")) {
  scripts.add(script);
}
var execute = (target) => {
  const elScripts = target instanceof HTMLScriptElement ? [target] : target.querySelectorAll("script");
  for (const old of elScripts) {
    if (!scripts.has(old)) {
      const script = document.createElement("script");
      for (const { name, value } of old.attributes) {
        script.setAttribute(name, value);
      }
      script.text = old.text;
      old.replaceWith(script);
      scripts.add(script);
    }
  }
};
var applyPatchMode = (targets, element, action2, consume) => {
  let used = false;
  for (const target of targets) {
    if (consume && used) {
      break;
    }
    const nextNode = consume ? element : element.cloneNode(true);
    execute(nextNode);
    target[action2](nextNode);
    used = true;
  }
};
var applyToTargets = (mode, element, targets, consume) => {
  switch (mode) {
    case "remove":
      for (const target of targets) {
        target.remove();
      }
      break;
    case "outer":
    case "inner":
      {
        let used = false;
        for (const target of targets) {
          if (consume && used) {
            break;
          }
          const nextNode = consume ? element : element.cloneNode(true);
          morph(target, nextNode, mode);
          execute(target);
          const scopeHost = target.closest("[data-scope-children]");
          if (scopeHost) {
            scopeHost.dispatchEvent(
              new CustomEvent(DATASTAR_SCOPE_CHILDREN_EVENT, {
                bubbles: false
              })
            );
          }
          used = true;
        }
      }
      break;
    case "replace":
      applyPatchMode(targets, element, "replaceWith", consume);
      break;
    case "prepend":
    case "append":
    case "before":
    case "after":
      applyPatchMode(targets, element, mode, consume);
  }
};
var ctxIdMap = /* @__PURE__ */ new Map();
var ctxPersistentIds = /* @__PURE__ */ new Set();
var oldIdTagNameMap = /* @__PURE__ */ new Map();
var duplicateIds = /* @__PURE__ */ new Set();
var ctxPantry = document.createElement("div");
ctxPantry.hidden = true;
var aliasedIgnoreMorph = aliasify("ignore-morph");
var aliasedIgnoreMorphAttr = `[${aliasedIgnoreMorph}]`;
var morph = (oldElt, newContent, mode = "outer") => {
  if (isHTMLOrSVG(oldElt) && isHTMLOrSVG(newContent) && oldElt.hasAttribute(aliasedIgnoreMorph) && newContent.hasAttribute(aliasedIgnoreMorph) || oldElt.parentElement?.closest(aliasedIgnoreMorphAttr)) {
    return;
  }
  const normalizedElt = document.createElement("div");
  normalizedElt.append(newContent);
  document.body.insertAdjacentElement("afterend", ctxPantry);
  const oldIdElements = oldElt.querySelectorAll("[id]");
  for (const { id, tagName } of oldIdElements) {
    if (oldIdTagNameMap.has(id)) {
      duplicateIds.add(id);
    } else {
      oldIdTagNameMap.set(id, tagName);
    }
  }
  if (oldElt instanceof Element && oldElt.id) {
    if (oldIdTagNameMap.has(oldElt.id)) {
      duplicateIds.add(oldElt.id);
    } else {
      oldIdTagNameMap.set(oldElt.id, oldElt.tagName);
    }
  }
  ctxPersistentIds.clear();
  const newIdElements = normalizedElt.querySelectorAll("[id]");
  for (const { id, tagName } of newIdElements) {
    if (ctxPersistentIds.has(id)) {
      duplicateIds.add(id);
    } else if (oldIdTagNameMap.get(id) === tagName) {
      ctxPersistentIds.add(id);
    }
  }
  for (const id of duplicateIds) {
    ctxPersistentIds.delete(id);
  }
  oldIdTagNameMap.clear();
  duplicateIds.clear();
  ctxIdMap.clear();
  const parent = mode === "outer" ? oldElt.parentElement : oldElt;
  populateIdMapWithTree(parent, oldIdElements);
  populateIdMapWithTree(normalizedElt, newIdElements);
  morphChildren(
    parent,
    normalizedElt,
    mode === "outer" ? oldElt : null,
    oldElt.nextSibling
  );
  ctxPantry.remove();
};
var morphChildren = (oldParent, newParent, insertionPoint = null, endPoint = null) => {
  if (oldParent instanceof HTMLTemplateElement && newParent instanceof HTMLTemplateElement) {
    oldParent = oldParent.content;
    newParent = newParent.content;
  }
  insertionPoint ??= oldParent.firstChild;
  for (const newChild of newParent.childNodes) {
    if (insertionPoint && insertionPoint !== endPoint) {
      const bestMatch = findBestMatch(newChild, insertionPoint, endPoint);
      if (bestMatch) {
        if (bestMatch !== insertionPoint) {
          let cursor = insertionPoint;
          while (cursor && cursor !== bestMatch) {
            const tempNode = cursor;
            cursor = cursor.nextSibling;
            removeNode(tempNode);
          }
        }
        morphNode(bestMatch, newChild);
        insertionPoint = bestMatch.nextSibling;
        continue;
      }
    }
    if (newChild instanceof Element && ctxPersistentIds.has(newChild.id)) {
      const movedChild = document.getElementById(newChild.id);
      let current = movedChild;
      while (current = current.parentNode) {
        const idSet = ctxIdMap.get(current);
        if (idSet) {
          idSet.delete(newChild.id);
          if (!idSet.size) {
            ctxIdMap.delete(current);
          }
        }
      }
      moveBefore(oldParent, movedChild, insertionPoint);
      morphNode(movedChild, newChild);
      insertionPoint = movedChild.nextSibling;
      continue;
    }
    if (ctxIdMap.has(newChild)) {
      const namespaceURI = newChild.namespaceURI;
      const tagName = newChild.tagName;
      const newEmptyChild = namespaceURI && namespaceURI !== "http://www.w3.org/1999/xhtml" ? document.createElementNS(namespaceURI, tagName) : document.createElement(tagName);
      oldParent.insertBefore(newEmptyChild, insertionPoint);
      morphNode(newEmptyChild, newChild);
      insertionPoint = newEmptyChild.nextSibling;
    } else {
      const newClonedChild = document.importNode(newChild, true);
      oldParent.insertBefore(newClonedChild, insertionPoint);
      insertionPoint = newClonedChild.nextSibling;
    }
  }
  while (insertionPoint && insertionPoint !== endPoint) {
    const tempNode = insertionPoint;
    insertionPoint = insertionPoint.nextSibling;
    removeNode(tempNode);
  }
};
var findBestMatch = (node, startPoint, endPoint) => {
  let bestMatch = null;
  let nextSibling = node.nextSibling;
  let siblingSoftMatchCount = 0;
  let displaceMatchCount = 0;
  const nodeMatchCount = ctxIdMap.get(node)?.size || 0;
  let cursor = startPoint;
  while (cursor && cursor !== endPoint) {
    if (isSoftMatch(cursor, node)) {
      let isIdSetMatch = false;
      const oldSet = ctxIdMap.get(cursor);
      const newSet = ctxIdMap.get(node);
      if (newSet && oldSet) {
        for (const id of oldSet) {
          if (newSet.has(id)) {
            isIdSetMatch = true;
            break;
          }
        }
      }
      if (isIdSetMatch) {
        return cursor;
      }
      if (!bestMatch && !ctxIdMap.has(cursor)) {
        if (!nodeMatchCount) {
          return cursor;
        }
        bestMatch = cursor;
      }
    }
    displaceMatchCount += ctxIdMap.get(cursor)?.size || 0;
    if (displaceMatchCount > nodeMatchCount) {
      break;
    }
    if (bestMatch === null && nextSibling && isSoftMatch(cursor, nextSibling)) {
      siblingSoftMatchCount++;
      nextSibling = nextSibling.nextSibling;
      if (siblingSoftMatchCount >= 2) {
        bestMatch = void 0;
      }
    }
    cursor = cursor.nextSibling;
  }
  return bestMatch || null;
};
var isSoftMatch = (oldNode, newNode) => oldNode.nodeType === newNode.nodeType && oldNode.tagName === newNode.tagName && // If oldElt has an `id` with possible state and it doesn’t match newElt.id then avoid morphing.
// We'll still match an anonymous node with an IDed newElt, though, because if it got this far,
// its not persistent, and new nodes can't have any hidden state.
(!oldNode.id || oldNode.id === newNode.id);
var removeNode = (node) => {
  ctxIdMap.has(node) ? (
    // skip callbacks and move to pantry
    moveBefore(ctxPantry, node, null)
  ) : (
    // remove for realsies
    node.parentNode?.removeChild(node)
  );
};
var moveBefore = (parentNode, node, after) => {
  if ("moveBefore" in parentNode) {
    const moveableParent = parentNode;
    moveableParent.moveBefore(node, after);
    return;
  }
  parentNode.insertBefore(node, after);
};
var aliasedPreserveAttr = aliasify("preserve-attr");
var morphNode = (oldNode, newNode) => {
  const type = newNode.nodeType;
  if (type === 1) {
    const oldElt = oldNode;
    const newElt = newNode;
    const shouldScopeChildren = oldElt.hasAttribute("data-scope-children");
    if (oldElt.hasAttribute(aliasedIgnoreMorph) && newElt.hasAttribute(aliasedIgnoreMorph)) {
      return oldNode;
    }
    const preserveAttrs = (newNode.getAttribute(aliasedPreserveAttr) ?? "").split(" ");
    if (oldElt === document.activeElement) {
      preserveAttrs.push("value");
    }
    const updateElementProp = (oldElt2, newElt2, name) => {
      const newEltHasAttr = newElt2.hasAttribute(name);
      if (oldElt2.hasAttribute(name) !== newEltHasAttr && !preserveAttrs.includes(name)) {
        oldElt2[name] = newEltHasAttr;
        return true;
      }
      return false;
    };
    let shouldDispatchPropChangeEvent = false;
    if (oldElt instanceof HTMLInputElement && newElt instanceof HTMLInputElement && newElt.type !== "file") {
      const newValue = newElt.getAttribute("value");
      if (oldElt.getAttribute("value") !== newValue && !preserveAttrs.includes("value")) {
        oldElt.value = newValue ?? "";
        shouldDispatchPropChangeEvent = true;
      }
      shouldDispatchPropChangeEvent = updateElementProp(oldElt, newElt, "checked") || shouldDispatchPropChangeEvent;
      updateElementProp(oldElt, newElt, "disabled");
    } else if (oldElt instanceof HTMLTextAreaElement && newElt instanceof HTMLTextAreaElement) {
      const newValue = newElt.value;
      if (oldElt.defaultValue !== newValue) {
        oldElt.value = newValue;
        shouldDispatchPropChangeEvent = true;
      }
    } else if (oldElt instanceof HTMLOptionElement && newElt instanceof HTMLOptionElement) {
      shouldDispatchPropChangeEvent = updateElementProp(oldElt, newElt, "selected") || shouldDispatchPropChangeEvent;
    }
    for (const { name, value } of newElt.attributes) {
      if (oldElt.getAttribute(name) !== value && !preserveAttrs.includes(name)) {
        oldElt.setAttribute(name, value);
      }
    }
    for (const { name } of Array.from(oldElt.attributes)) {
      if (!newElt.hasAttribute(name) && !preserveAttrs.includes(name)) {
        oldElt.removeAttribute(name);
      }
    }
    if (shouldDispatchPropChangeEvent) {
      const dispatchElt = oldElt instanceof HTMLOptionElement ? oldElt.closest("select") : oldElt;
      dispatchElt?.dispatchEvent(
        new Event(DATASTAR_PROP_CHANGE_EVENT, { bubbles: true })
      );
    }
    if (shouldScopeChildren && !oldElt.hasAttribute("data-scope-children")) {
      oldElt.setAttribute("data-scope-children", "");
    }
    if (oldElt instanceof HTMLTemplateElement && newElt instanceof HTMLTemplateElement) {
      oldElt.innerHTML = newElt.innerHTML;
    } else if (!oldElt.isEqualNode(newElt)) {
      morphChildren(oldElt, newElt);
    }
    if (shouldScopeChildren) {
      oldElt.dispatchEvent(
        new CustomEvent(DATASTAR_SCOPE_CHILDREN_EVENT, { bubbles: false })
      );
    }
  }
  if (type === 8 || type === 3) {
    if (oldNode.nodeValue !== newNode.nodeValue) {
      oldNode.nodeValue = newNode.nodeValue;
    }
  }
  return oldNode;
};
var populateIdMapWithTree = (root2, elements) => {
  for (const elt of elements) {
    if (ctxPersistentIds.has(elt.id)) {
      let current = elt;
      while (current && current !== root2) {
        let idSet = ctxIdMap.get(current);
        if (!idSet) {
          idSet = /* @__PURE__ */ new Set();
          ctxIdMap.set(current, idSet);
        }
        idSet.add(elt.id);
        current = current.parentElement;
      }
    }
  }
};

// src/plugins/watchers/patchSignals.ts
watcher({
  name: "datastar-patch-signals",
  apply({ error: error2 }, { signals, onlyIfMissing }) {
    if (typeof signals !== "string") {
      throw error2("PatchSignalsExpectedSignals");
    }
    const ifMissing = typeof onlyIfMissing === "string" && onlyIfMissing.trim() === "true";
    mergePatch(jsStrToObject(signals), { ifMissing });
  }
});
export {
  action,
  actions,
  attribute,
  beginBatch,
  computed,
  effect,
  endBatch,
  filtered,
  getPath,
  mergePatch,
  mergePaths,
  root,
  signal,
  startPeeking,
  stopPeeking,
  watcher
};
//# sourceMappingURL=datastar.js.map
