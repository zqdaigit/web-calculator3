(function () {
  const STORAGE_KEY = "ws16-calculator-history";
  const THEME_KEY = "ws16-calculator-theme";
  const operators = ["+", "-", "*", "/"];
  const operatorLabels = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  const formulaDisplay = document.getElementById("formulaDisplay");
  const resultDisplay = document.getElementById("resultDisplay");
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const overlay = document.getElementById("overlay");
  const toast = document.getElementById("toast");
  const decimalKey = document.getElementById("decimalKey");
  const themeIcon = document.getElementById("themeIcon");

  const state = {
    tokens: [],
    current: "0",
    justCalculated: false,
    error: false,
    lastOperation: null,
    history: loadHistory()
  };

  initTheme();
  bindEvents();
  render();
  renderHistory();

  function bindEvents() {
    document.querySelector(".calculator-card").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled || button.classList.contains("icon-button")) return;
      pulse(button);
      if (navigator.vibrate) navigator.vibrate(100);
      handleButton(button);
    });

    document.getElementById("themeToggle").addEventListener("click", toggleTheme);
    document.getElementById("openHistory").addEventListener("click", openHistory);
    document.getElementById("closeHistory").addEventListener("click", closeHistory);
    document.getElementById("clearHistory").addEventListener("click", clearHistory);
    overlay.addEventListener("click", closeHistory);

    let backspaceTimer = null;
    const backspaceButton = document.querySelector('[data-action="backspace"]');
    backspaceButton.addEventListener("pointerdown", () => {
      backspaceTimer = window.setTimeout(() => {
        clearEntry();
        showToast("已长按退格，清除当前输入");
      }, 800);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
      backspaceButton.addEventListener(type, () => window.clearTimeout(backspaceTimer));
    });

    document.addEventListener("keydown", handleKeyboard);
  }

  function handleButton(button) {
    if (button.dataset.number) inputNumber(button.dataset.number);
    if (button.dataset.operator) inputOperator(button.dataset.operator);

    switch (button.dataset.action) {
      case "decimal":
        inputDecimal();
        break;
      case "equals":
        calculate();
        break;
      case "clear":
        clearAll();
        break;
      case "clear-entry":
        clearEntry();
        break;
      case "backspace":
        backspace();
        break;
      case "toggle-sign":
        toggleSign();
        break;
      case "percent":
        percent();
        break;
    }
  }

  function handleKeyboard(event) {
    const key = event.key;
    const virtualKey = findVirtualKey(key);
    if (virtualKey) pulse(virtualKey);

    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      inputNumber(key);
    } else if (key === ".") {
      event.preventDefault();
      inputDecimal();
    } else if (["+", "-", "*", "/", "x", "X"].includes(key)) {
      event.preventDefault();
      inputOperator(key.toLowerCase() === "x" ? "*" : key);
    } else if (key === "Enter" || key === "=") {
      event.preventDefault();
      calculate();
    } else if (key === "Backspace") {
      event.preventDefault();
      backspace();
    } else if (key === "Escape" || key === "Delete") {
      event.preventDefault();
      clearAll();
    }
  }

  function inputNumber(value) {
    if (state.error) return;
    if (state.justCalculated) {
      state.tokens = [];
      state.current = "0";
      state.justCalculated = false;
    }
    state.current = state.current === "0" ? value : state.current + value;
    render();
  }

  function inputDecimal() {
    if (state.error) return;
    if (state.current.includes(".")) {
      decimalKey.classList.remove("invalid");
      void decimalKey.offsetWidth;
      decimalKey.classList.add("invalid");
      showToast("当前数字已包含小数点");
      return;
    }
    if (state.justCalculated) {
      state.tokens = [];
      state.current = "0";
      state.justCalculated = false;
    }
    state.current += ".";
    render();
  }

  function inputOperator(operator) {
    if (state.error) return;

    if (state.justCalculated) {
      state.tokens = [state.current, operator];
      state.justCalculated = false;
      render();
      return;
    }

    const last = state.tokens[state.tokens.length - 1];
    if (operators.includes(last) && state.current === "") {
      state.tokens[state.tokens.length - 1] = operator;
    } else {
      if (state.current !== "") state.tokens.push(state.current);
      state.tokens.push(operator);
      state.current = "";
    }
    render();
  }

  function calculate() {
    if (state.error) return;

    const expressionTokens = [...state.tokens];
    if (state.current !== "") expressionTokens.push(state.current);

    if (operators.includes(expressionTokens[expressionTokens.length - 1])) {
      if (state.lastOperation) {
        expressionTokens.push(state.lastOperation.value);
      } else {
        expressionTokens.pop();
      }
    }

    if (expressionTokens.length === 1 && state.lastOperation) {
      expressionTokens.push(state.lastOperation.operator, state.lastOperation.value);
    }

    if (!expressionTokens.length) return;

    try {
      const result = evaluateExpression(expressionTokens);
      if (result.divideByZero) {
        enterError("不能除以0");
        return;
      }

      const formatted = formatResult(result.value);
      const expression = formatExpression(expressionTokens);
      state.current = formatted;
      state.tokens = [];
      state.justCalculated = true;
      state.lastOperation = extractLastOperation(expressionTokens);

      addHistory(expression, formatted);
      formulaDisplay.textContent = `${expression} =`;
      render();
    } catch (error) {
      enterError("Error");
    }
  }

  function evaluateExpression(tokens) {
    const values = [];
    const ops = [];

    for (const token of tokens) {
      if (operators.includes(token)) {
        while (ops.length && precedence(ops[ops.length - 1]) >= precedence(token)) {
          const applied = applyTop(values, ops);
          if (applied.divideByZero) return applied;
        }
        ops.push(token);
      } else {
        values.push(Number(token));
      }
    }

    while (ops.length) {
      const applied = applyTop(values, ops);
      if (applied.divideByZero) return applied;
    }

    return { value: values[0] || 0 };
  }

  function applyTop(values, ops) {
    const right = values.pop();
    const left = values.pop();
    const operator = ops.pop();

    if (operator === "/" && right === 0) return { divideByZero: true };

    let value = 0;
    if (operator === "+") value = left + right;
    if (operator === "-") value = left - right;
    if (operator === "*") value = left * right;
    if (operator === "/") value = left / right;
    values.push(value);
    return { value };
  }

  function precedence(operator) {
    return operator === "*" || operator === "/" ? 2 : 1;
  }

  function formatResult(value) {
    if (!Number.isFinite(value)) return "数值溢出";
    const rounded = Number.parseFloat(Number(value).toPrecision(12));
    if (!Number.isFinite(rounded)) return "数值溢出";
    if (Math.abs(rounded) >= 1e15) return rounded.toExponential(6);
    return String(rounded);
  }

  function extractLastOperation(tokens) {
    for (let i = tokens.length - 2; i >= 0; i -= 1) {
      if (operators.includes(tokens[i])) {
        return { operator: tokens[i], value: tokens[i + 1] };
      }
    }
    return null;
  }

  function toggleSign() {
    if (state.error) return;
    if (state.current === "0" || state.current === "") return;
    state.current = state.current.startsWith("-") ? state.current.slice(1) : `-${state.current}`;
    render();
  }

  function percent() {
    if (state.error || state.current === "") return;
    state.current = formatResult(Number(state.current) * 0.01);
    state.justCalculated = false;
    render();
  }

  function clearAll() {
    state.tokens = [];
    state.current = "0";
    state.error = false;
    state.justCalculated = false;
    state.lastOperation = null;
    render();
  }

  function clearEntry() {
    state.current = "0";
    state.error = false;
    state.justCalculated = false;
    render();
  }

  function backspace() {
    if (state.error) {
      clearEntry();
      return;
    }
    if (state.current === "" && operators.includes(state.tokens[state.tokens.length - 1])) {
      state.tokens.pop();
      const lastValue = state.tokens.pop();
      state.current = lastValue || "0";
    } else if (state.current.length <= 1 || (state.current.length === 2 && state.current.startsWith("-"))) {
      state.current = "0";
    } else {
      state.current = state.current.slice(0, -1);
    }
    render();
  }

  function enterError(message) {
    state.error = true;
    state.current = message;
    state.tokens = [];
    state.justCalculated = false;
    showToast("发生错误，请清除后继续");
    render();
  }

  function addHistory(expression, result) {
    if (result === "数值溢出" || result === "不能除以0" || result === "Error") return;
    state.history.unshift({
      id: String(Date.now()),
      expression,
      result,
      timestamp: Date.now()
    });
    state.history = state.history.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    renderHistory();
  }

  function render() {
    if (!state.justCalculated) {
      const expression = formatExpression([...state.tokens, state.current].filter(Boolean));
      formulaDisplay.textContent = expression || "准备计算";
    }
    resultDisplay.textContent = state.current || "0";
    resultDisplay.classList.toggle("compact", String(state.current).length > 10);
    resultDisplay.classList.toggle("error", state.error);

    document.querySelectorAll(".operator").forEach((button) => {
      button.classList.toggle("active", button.dataset.operator === state.tokens[state.tokens.length - 1]);
    });

    document.querySelectorAll(".key, .quick-key").forEach((button) => {
      const allowedInError = ["clear", "clear-entry", "backspace"].includes(button.dataset.action);
      button.disabled = state.error && !allowedInError;
    });
  }

  function renderHistory() {
    if (!state.history.length) {
      historyList.innerHTML = '<div class="history-empty">暂无计算历史</div>';
      return;
    }

    historyList.innerHTML = "";
    state.history.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      button.innerHTML = `
        <div class="history-expression">${escapeHtml(item.expression)} =</div>
        <div class="history-result">${escapeHtml(item.result)}</div>
        <div class="history-time">${new Date(item.timestamp).toLocaleString("zh-CN")}</div>
      `;
      button.addEventListener("click", () => {
        state.tokens = [];
        state.current = item.result;
        state.error = false;
        state.justCalculated = false;
        formulaDisplay.textContent = `已载入历史结果：${item.expression}`;
        closeHistory();
        render();
      });
      historyList.appendChild(button);
    });
  }

  function clearHistory() {
    state.history = [];
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showToast("历史记录已清空");
  }

  function formatExpression(tokens) {
    return tokens.map((token) => operatorLabels[token] || token).join(" ").trim();
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
      return [];
    }
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    const preferDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("dark", stored ? stored === "dark" : preferDark);
    updateThemeIcon();
  }

  function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
    updateThemeIcon();
  }

  function updateThemeIcon() {
    themeIcon.textContent = document.body.classList.contains("dark") ? "🌙" : "☀";
  }

  function openHistory() {
    historyPanel.classList.add("open");
    overlay.hidden = false;
  }

  function closeHistory() {
    historyPanel.classList.remove("open");
    overlay.hidden = true;
  }

  function findVirtualKey(key) {
    if (/^[0-9]$/.test(key)) return document.querySelector(`[data-number="${key}"]`);
    if (key === ".") return decimalKey;
    if (key === "Enter" || key === "=") return document.querySelector('[data-action="equals"]');
    if (key === "Backspace") return document.querySelector('[data-action="backspace"]');
    if (key === "Escape" || key === "Delete") return document.querySelector('[data-action="clear"]');
    const mapped = key.toLowerCase() === "x" ? "*" : key;
    if (operators.includes(mapped)) return document.querySelector(`[data-operator="${mapped}"]`);
    return null;
  }

  function pulse(button) {
    button.classList.add("pressed");
    window.setTimeout(() => button.classList.remove("pressed"), 140);
  }

  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1800);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
